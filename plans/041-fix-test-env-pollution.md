# Plan 041: Fix test process.env mutation without backup/restore

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 691a737..HEAD -- src/db/__tests__/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Category**: tests
- **Depends on**: none
- **Planned at**: commit `691a737`, 2026-06-24

## Why this matters

Test files that mutate `process.env` directly (e.g., `process.env.SESSION_SECRET = 'test'`) without saving and restoring the original value can leak state into subsequent tests. Because Node's test runner runs test files in parallel by default (via `--test`), one file's mutation can cause spurious failures in another file that reads the same env var. This is a known source of flaky CI runs.

## Current state

Two test files mutate `process.env` directly:

- `src/db/__tests__/auth.integration.test.ts` — sets `process.env.SESSION_SECRET = 'test-secret-key-that-is-exactly-32-chars-long!'` to control the JWT signing key
- `src/db/__tests__/settings.integration.test.ts` — sets `process.env.SESSION_SECRET` similarly

Neither file saves the original value nor restores it in a `after` hook. Example pattern:

```ts
// auth.integration.test.ts (approximate location)
process.env.SESSION_SECRET = 'test-secret-key-that-is-exactly-32-chars-long!';
// ... tests ...
// no cleanup
```

The repo already uses `describe` and `it` / `test` blocks with `before`/`after` hooks (standard Node test runner pattern). Existing tests in `src/db/__tests__/` use `after` for cleanup in other cases (e.g., closing DB connections).

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Tests     | `npm test`         | all pass            |

## Scope

**In scope**:
- `src/db/__tests__/auth.integration.test.ts`
- `src/db/__tests__/settings.integration.test.ts`

**Out of scope**:
- Any other test files — only these two mutate `process.env`
- `src/lib/auth.ts` — the code that reads `SESSION_SECRET` is correct

## Git workflow

- Branch: `advisor/041-fix-test-env-pollution`
- Single commit: `test: save and restore process.env.SESSION_SECRET in test files`

## Steps

### Step 1: Add backup/restore to `auth.integration.test.ts`

Find the `process.env.SESSION_SECRET =` assignment. Before it, save the original:

```ts
const ORIGINAL_SESSION_SECRET = process.env.SESSION_SECRET;
```

Add an `after` hook (or add to an existing one) to restore:

```ts
after(() => {
  if (ORIGINAL_SESSION_SECRET === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = ORIGINAL_SESSION_SECRET;
  }
});
```

If the file uses a `describe` block, add `after` inside it.

**Verify**: `npm test` (or `node --import tsx --test src/db/__tests__/auth.integration.test.ts`) → all pass

### Step 2: Add backup/restore to `settings.integration.test.ts`

Same pattern as step 1.

**Verify**: `npm test` (or `node --import tsx --test src/db/__tests__/settings.integration.test.ts`) → all pass

### Step 3: Run full test suite

**Verify**: `npm test` → all tests pass (no cross-file leakage)

## Test plan

The fix is itself about test hygiene. Verification is running the full suite and confirming no cross-contamination.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0
- [ ] Each in-scope test file has an `after` hook that restores `process.env.SESSION_SECRET`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- The test file has no `describe`/`after` hooks at all (unlikely — but if so, stop and report the structure).

## Maintenance notes

- Future test files that set `process.env` should follow this pattern from the start.
- If the test runner is ever switched to `--test --test-concurrency=1` (single-thread), this becomes less critical but is still good practice.
