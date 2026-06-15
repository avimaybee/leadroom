# Plan 002: Fix bypassed timeout in enricher.ts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b2fa80d..HEAD -- src/lib/triage/enricher.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: perf / correctness
- **Planned at**: commit `b2fa80d`, 2026-06-15

## Why this matters

A recent commit removed `Promise.race()` from `enrichCandidate` in favor of just an `AbortController`. However, the `browser.quickAction` bindings do not automatically reject when the signal is aborted. Because `Promise.race` is gone, the 12-second timeout no longer forces `enrichCandidate` to return early! It will now block indefinitely if the browser run hangs. We must use `Promise.race()` **AND** the `AbortController` together so that we enforce the hard timeout boundary while also attempting to clean up the background fetch tasks.

## Current state

- `src/lib/triage/enricher.ts`

Excerpts:
`src/lib/triage/enricher.ts:33-38`
```typescript
  try {
    return await enrichCandidateInner(website, db, browserBinding, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |

## Scope

**In scope**:
- `src/lib/triage/enricher.ts`

**Out of scope**:
- Modifying `src/lib/scraper.ts`.

## Git workflow

- Branch: `advisor/002-fix-dangling-promises`
- Commit message style: `fix: restore Promise.race to enforce enrichment timeout`

## Steps

### Step 1: Restore Promise.race
In `src/lib/triage/enricher.ts` inside `enrichCandidate`, keep the `AbortController` and `setTimeout`.
Modify the `try` block to use `Promise.race`:
```typescript
  try {
    return await Promise.race([
      enrichCandidateInner(website, db, browserBinding, controller.signal),
      new Promise<null>((resolve) => {
        // We reuse the existing timeout to also resolve the race
        const originalTimeout = timeout;
        timeout = setTimeout(() => {
          controller.abort();
          resolve(null);
        }, ENRICH_TIMEOUT_MS);
        clearTimeout(originalTimeout); // Clean up the old one
      })
    ]);
  } finally { ... }
```
Actually, simply wrapping it cleanly:
```typescript
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);

  try {
    return await Promise.race([
      enrichCandidateInner(website, db, browserBinding, controller.signal),
      new Promise<null>((resolve) => {
        // Wait for the abort event to trigger our null return
        controller.signal.addEventListener('abort', () => resolve(null), { once: true });
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
```
This guarantees the function returns `null` exactly when the 12s timeout hits, even if `enrichCandidateInner` is stuck awaiting `browser.quickAction`.

**Verify**: `npx tsc --noEmit` -> ensure the build passes.

## Test plan
- Run `npx tsc --noEmit`

## Done criteria
- [ ] `npx tsc --noEmit` exits 0
- [ ] `Promise.race` is restored in `enrichCandidate`
- [ ] `plans/README.md` status row updated

## STOP conditions
Stop and report back (do not improvise) if:
- `enrichCandidateInner` has been completely removed.
