# Plan 068: Remove Vestigial Mock Drafting Code

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 38561c5..HEAD -- src/lib/domain/drafting.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech debt
- **Planned at**: commit `38561c5`

## Why this matters

During Phase 4 of the SDR Pivot, `src/lib/domain/drafting.ts` was created with a naive, string-concatenation mock function (`generateDraft()`). Later, true AI drafting was wired up through `src/app/actions/outreach.ts` calling `generateOutreachDraft()` in `src/lib/ai.ts`. As a result, `generateDraft()` is dead code that is never invoked. Removing dead domain logic prevents future developers from attempting to fix or test the mock behavior, reducing technical debt.

## Current state

- `src/lib/domain/drafting.ts` contains `generateDraft`, `buildBody`, and `generateSubjectLine`.
- None of these functions are imported or used anywhere in `src/`.
- The file also exports useful shared interfaces like `DraftInput`, `DraftOutput`, `Contact`, and `CitedEvidence` that might be relied upon.

## Steps to execute

1. **Delete Dead Functions**:
   - In `src/lib/domain/drafting.ts`, delete `generateDraft()`, `buildBody()`, and `generateSubjectLine()`.
   
2. **Preserve Interfaces**:
   - Keep the type definitions (`Contact`, `DraftInput`, `CitedEvidence`, `DraftOutput`) if they are imported elsewhere (e.g., in `schemas.ts` or `scoring.ts`).
   - If a quick `grep` confirms the interfaces are also completely unused across the entire codebase, you may optionally delete the entire file and remove its exports from index files.

3. **Verify Integrity**:
   - Run `npx tsc --noEmit` to ensure no active code was implicitly relying on `generateDraft()`.
   - Ensure the build succeeds via `npm run build`.

## Done criteria

- `generateDraft()` is completely removed from the codebase.
- `npx tsc --noEmit` exits 0.
- `npm test` passes.

## STOP conditions
- If `generateDraft` is magically being called via some dynamic require or edge case (extremely unlikely), STOP and document the finding.
