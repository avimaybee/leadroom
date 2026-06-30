# Plan 067: Add Test Coverage for SDR Domain Logic

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 38561c5..HEAD -- src/lib/domain/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: testing
- **Planned at**: commit `38561c5`

## Why this matters

The SDR Pivot introduced critical domain logic under `src/lib/domain/` (specifically `outcomes.ts` for learning loop rules and `drafting.ts` for mock/fallback drafting logic). Currently, these modules have zero unit tests.

The project maintains a strict standard for domain validation (as seen in `scoring.test.ts`). Leaving core features like `generateLearningSuggestions` untested introduces risks that configuration changes will break deterministic logic without CI/CD detection. Adding comprehensive unit tests ensures safety for future refactoring and builds confidence in the pipeline.

## Current state

- The relevant files:
  - `src/lib/domain/outcomes.ts` (Contains `generateLearningSuggestions` which triggers based on >= 3 positive/negative outcomes)
  - `src/lib/domain/drafting.ts` (Contains `generateDraft`, unused in prod but forms the domain fallback)
- Test files missing:
  - `src/lib/domain/__tests__/outcomes.test.ts`
  - `src/lib/domain/__tests__/drafting.test.ts`

## Steps to execute

1. **Create `outcomes.test.ts`**:
   - Write tests for `generateLearningSuggestions`.
   - Test case 1: Returns empty when `< 3` total outcomes exist.
   - Test case 2: Successfully suggests an `increase_weight` when a signal has `> 80%` positive appearance rate across `>= 3` positive outcomes and its current weight is `< 5`.
   - Test case 3: Ignores signals that do not meet the volume threshold (e.g., `< 3` appearances).

2. **Create `drafting.test.ts`**:
   - Write tests for `generateDraft` (or just `buildBody` internal behavior if exposed).
   - Test case 1: Verify correct placeholder population when no signals are provided, generating a generic draft.
   - Test case 2: Verify `riskFlags` are added when the input lacks signals (`"No prospect signals available"`).
   - Test case 3: Verify the generated draft strictly includes `citedEvidence` matching the `sourceUrl`s provided.

3. **Verify and run suite**:
   - Run `npx tsc --noEmit` to ensure type bindings in the tests are correct.
   - Run `npm test` or specifically `npm run test -- src/lib/domain/__tests__/` and verify 100% pass rate for the new files.

## Done criteria

- `outcomes.test.ts` and `drafting.test.ts` exist with multiple assertions matching edge cases.
- `npx tsc --noEmit` exits 0.
- `npm test` passes completely and the total test count increases.

## STOP conditions
- If mocking DB access becomes necessary inside these domain tests, STOP. Domain libraries should be pure functions receiving inputs and returning deterministic outputs.
