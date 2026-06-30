# Plan 066: Fix SQL Array Interpolation Bug in LearningService

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 38561c5..HEAD -- src/services/learning.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness / bug
- **Planned at**: commit `38561c5`

## Why this matters

In `src/services/learning.ts`, the `triggerLearningLoop` method contains a bug when querying for research tasks using an array of `prospectIds`. It attempts to interpolate a JavaScript array directly into a raw SQL template literal: `sql\`${researchTasks.prospectId} IN ${prospectIds}\``. 

Drizzle's `sql` helper does not automatically expand arrays into a list of query parameters for the SQLite driver. This causes the query to crash or silently fail (evaluating as `IN ('[object Object]')` or comma-separated strings instead of parameterized lists). Consequently, the learning loop fails to match any signals, breaking Phase 5's AI outcome learning entirely.

## Current state

- The relevant file: `src/services/learning.ts`
- Code excerpt:
```typescript
    const signalRows = await this.db
      .select({
        prospectId: researchTasks.prospectId,
        extractedSignals: researchTasks.extractedSignals,
      })
      .from(researchTasks)
      .where(sql`${researchTasks.prospectId} IN ${prospectIds}`);
```

## Steps to execute

1. **Refactor using `inArray`**:
   - In `src/services/learning.ts`, replace the raw `sql` snippet with Drizzle's `inArray` helper.
   - Example:
     ```typescript
     import { eq, and, sql, inArray } from 'drizzle-orm';
     // ...
     .where(inArray(researchTasks.prospectId, prospectIds));
     ```

2. **Add a guard for empty arrays**:
   - `inArray` can throw an error if the passed array is completely empty. Although the function already checks `if (outcomeRows.length < 3) return;`, ensure that `prospectIds.length > 0` before making the query just to be resilient.

3. **Verify the change via tests**:
   - Run `npm test` to ensure existing coverage passes.
   - (Optional but recommended) Manually test or write a quick integration test ensuring `LearningService.triggerLearningLoop()` successfully retrieves research tasks without throwing a SQLite syntax error.

## Done criteria

- The `sql\` IN \`` clause is replaced with `inArray()`.
- `npx tsc --noEmit` exits 0.
- `npm test` passes.

## STOP conditions
- If Drizzle throws type errors indicating `inArray` is not exported or incompatible with the current version, STOP and resolve the package dependencies.
