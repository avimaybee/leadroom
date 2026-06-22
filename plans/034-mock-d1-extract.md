# Plan 034: Extract Duplicated MockD1Database Into Shared Test Helper

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat dc8430a..HEAD -- src/db/local-mock.ts src/db/__tests__/`
> If the mock class has already been extracted, skip this plan and update the
> index as DONE.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `dc8430a`, 2026-06-22

## Why this matters

The `MockD1Database` class is defined independently in 4 test files:

- `src/app/api/__tests__/routes.test.ts:17`
- `src/db/__tests__/functions.test.ts:14`
- `src/db/__tests__/outreach.actions.test.ts:11`
- `src/db/__tests__/settings.integration.test.ts:13`

The canonical mock already lives at `src/db/local-mock.ts:60` but it's not exported. Each test file's copy is ~70 lines of identical code. When the mock needs a new method or its constructor changes, all 4 copies must be updated in lockstep.

## Current state

`src/db/local-mock.ts` contains the authoritative `MockD1Database` class but does not export it. The file already has other exports. The `class MockD1Database` is defined at a specific line — read the file to find it.

Each test file has a local definition like:

```ts
class MockD1Database {
  private store = new Map<string, any[]>();

  // ... ~70 lines of mock implementation
}
```

The existing shared test helper at `src/db/__tests__/test-helpers.ts` provides `setupTestDb()` but does not export the mock class.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | `Compiled successfully` |
| Tests     | `npm test`               | All pass |

## Scope

**In scope**:
- `src/db/local-mock.ts` — add `export` to the `MockD1Database` class
- `src/app/api/__tests__/routes.test.ts` — remove local class, import from `@/db/local-mock`
- `src/db/__tests__/functions.test.ts` — remove local class, import from `@/db/local-mock`
- `src/db/__tests__/outreach.actions.test.ts` — remove local class, import from `@/db/local-mock`
- `src/db/__tests__/settings.integration.test.ts` — remove local class, import from `@/db/local-mock`

**Out of scope**:
- Any other test fixtures or helpers
- The `test-helpers.ts` file (it already exists and is fine)

## Steps

### Step 1: Export MockD1Database from `src/db/local-mock.ts`

Read the file to find the `class MockD1Database` definition. Add `export` before `class`:

```ts
export class MockD1Database {
```

**Verify**: `npm run build` → `Compiled successfully`.

### Step 2: Update each test file

For each of the 4 test files:
1. Delete the local `class MockD1Database { ... }` block (find the start `class MockD1Database` line and delete through the closing `}`)
2. Add an import at the top of the file: `import { MockD1Database } from '@/db/local-mock';`
3. Check that the import alias `@/db/local-mock` resolves — the test files already use `@/` imports for other modules, so this should work.

Files to update:
- `src/app/api/__tests__/routes.test.ts`
- `src/db/__tests__/functions.test.ts`
- `src/db/__tests__/outreach.actions.test.ts`
- `src/db/__tests__/settings.integration.test.ts`

**Verify for each file**: `node --import tsx --test <file>` runs and passes.

### Step 3: Full test run

```bash
node --import tsx --test src/db/__tests__/functions.test.ts src/db/__tests__/outreach.actions.test.ts src/db/__tests__/settings.integration.test.ts src/app/api/__tests__/routes.test.ts
```

All should pass.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] All 4 test files pass when run individually
- [ ] `grep -n "class MockD1Database" src/app/api/__tests__/routes.test.ts src/db/__tests__/functions.test.ts src/db/__tests__/outreach.actions.test.ts src/db/__tests__/settings.integration.test.ts` returns no matches (local definitions removed)
- [ ] `grep -n "export class MockD1Database" src/db/local-mock.ts` returns a match
- [ ] Only the 5 listed files are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The `MockD1Database` in `local-mock.ts` has a different interface than the test-file copies. Compare them carefully — if they've diverged, don't just export one; reconcile the interface first.
- An import from `@/db/local-mock` doesn't resolve in a test file (unlikely since `@/db` resolves to `src/db/`).

## Maintenance notes

- When adding new methods to `MockD1Database`, only update `local-mock.ts` — all tests automatically get the new method.
- When a test needs a mock method for a specific edge case, add it to `MockD1Database` with a sensible default rather than re-implementing it locally.
