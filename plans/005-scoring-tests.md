# Plan 005: Add scoring service test coverage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `d6c7ea6`, 2026-06-14

## Why this matters

The `ScoringService` (`src/services/scoring.ts`) contains the most business-critical logic in the system: it defines the math that prioritizes leads. It handles base calculations, audit penalty modifiers, triage boosts/penalties, clamping, and label assignments (High/Medium/Low). However, it currently has 0% test coverage. Any future changes to the formula risk breaking lead prioritization silently. We need integration tests mirroring `audits.integration.test.ts`.

## Scope

**In scope**:
- `src/db/__tests__/scoring.integration.test.ts` (NEW)

## Steps

### Step 1: Create the test file

Create `src/db/__tests__/scoring.integration.test.ts`.

Structure it using the `node:test` runner, similar to `audits.integration.test.ts`. Use the in-memory SQLite mock DB.

Include the following test suites:

1. **Base Scoring**: Test that a new lead without an audit or triage gets the default base score (e.g., checking standard company/website existence points).
2. **Triage Modifiers**: Create a lead with `triagePriority = 'HIGH'` and verify it gets the +15 point boost.
3. **Audit Modifiers**: Create a lead, then create an audit for it with low scores (e.g., 20/100). Verify the score is correctly reduced by the audit penalty logic.
4. **Manual Override**: Test `manualOverride(leadId, 99, 'Because I said so')`. Verify the score becomes 99, origin is `MANUAL_OVERRIDE`, and the old score is set to `isCurrent = 0`.
5. **Labels**: Verify thresholds (>= 75 is High, >= 45 is Medium, < 45 is Low).

### Step 2: Run tests

Ensure `node --import tsx --test src/db/__tests__/scoring.integration.test.ts` passes.

## Done criteria

- [ ] New test file created and passes.
- [ ] Covers triage modifier, audit modifier, and manual overrides.
- [ ] `plans/README.md` status row updated.
