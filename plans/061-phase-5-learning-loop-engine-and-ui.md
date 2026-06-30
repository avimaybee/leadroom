# Plan 061: Phase 5 Learning Loop Engine & Suggestions Inbox

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 38561c5..HEAD -- src/db/schema/outreach.ts src/app/actions/outcomes.ts src/lib/domain/outcomes.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/058-sdr-phase-4-outreach-and-learning.md
- **Category**: direction
- **Planned at**: commit `38561c5`, 2026-06-29

## Why this matters
Phase 5 ("Pipeline & Learning Loop") aims to close the loop on sales intelligence by automatically extracting optimization suggestions from outcomes and feeding them back to update ICP Profile configs. Currently, the database schema and mathematical domain checks exist, but they are not executed or connected to the user interface. This plan integrates the learning loop, creating a "Suggestions Inbox" where operators can apply or dismiss recommendations.

## Current state
`src/db/schema/outreach.ts:47-56` defines `learningSuggestions`:
```ts
export const learningSuggestions = sqliteTable('learning_suggestions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  suggestedChange: text('suggested_change'),
  supportingEvidence: text('supporting_evidence'),
  status: text('status', { enum: ['PENDING', 'APPLIED', 'DISMISSED'] }).notNull().default('PENDING'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  reviewedByUserId: text('reviewed_by_user_id').references(() => users.id),
});
```
`src/lib/domain/outcomes.ts:26` exposes `generateLearningSuggestions(workspaceId, outcomes, currentIcp)`.
Both are currently completely un-imported and un-called by the application's runtime code.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope**:
- `src/services/learning.ts` (create)
- `src/app/actions/outcomes.ts` (modify)
- `src/app/actions/learning.ts` (create)
- `src/components/prospects/LearningSuggestionsInbox.tsx` (create)
- `src/app/(dashboard)/settings/pipeline/page.tsx` (modify)

**Out of scope**:
- Automatic application of suggestions without explicit human confirmation (violates Non-Negotiable Product Rule 1).

## Git workflow
- Branch: `advisor/061-phase-5-learning-loop-engine-and-ui`
- Commit per step. Message format: `feat: implement LearningService for Phase 5`

## Steps

### Step 1: Create `LearningService` in `src/services/learning.ts`
Implement core logic:
1. `triggerLearningLoop(workspaceId)`: Query all logged outcomes and the active ICP profile for the workspace. Call `generateLearningSuggestions`. Upsert suggestions to the `learning_suggestions` table if a pending suggestion for that target/type doesn't already exist.
2. `applySuggestion(suggestionId, userId)`: Fetch the suggestion, update the corresponding array (e.g. `positiveSignals`, `negativeSignals`, `disqualifiers`) in the active `ICPProfile`, save to DB, and set suggestion status to `'APPLIED'`.
3. `dismissSuggestion(suggestionId, userId)`: Update suggestion status to `'DISMISSED'`.
**Verify**: `npx tsc --noEmit` -> succeeds.

### Step 2: Trigger learning loop on logged outcomes
Modify `logOutcomeAction` in `src/app/actions/outcomes.ts`:
- After logging the outcome, query the prospect's `workspaceId`.
- Call `LearningService.triggerLearningLoop(workspaceId)` asynchronously.
**Verify**: `npm test` -> succeeds.

### Step 3: Create Server Actions for learning loop
Create `src/app/actions/learning.ts` exporting:
- `applyLearningSuggestionAction(suggestionId: string)`
- `dismissLearningSuggestionAction(suggestionId: string)`
Include authorization and revalidation calls.
**Verify**: `npx tsc --noEmit` -> succeeds.

### Step 4: Build the suggestions inbox UI
Create `src/components/prospects/LearningSuggestionsInbox.tsx`:
- Render a list of pending suggestions for the active workspace.
- Include change details, reasoning, and stats.
- Add "Apply" and "Dismiss" buttons triggering the server actions.
**Verify**: compiles without typescript errors.

### Step 5: Embed inbox in pipeline settings
Modify `src/app/(dashboard)/settings/pipeline/page.tsx`:
- Add an "ICP Optimization" tab.
- Render the `LearningSuggestionsInbox` component inside it.
**Verify**: `npm run build` -> succeeds.

## Test plan
- Add integration tests in `src/db/__tests__/learning.integration.test.ts` to assert that logging outcomes triggers suggestion creation in the database, and that invoking the apply action correctly updates the underlying workspace ICP config.
- Run `npm test`.

## Done criteria
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npm test` passes.
- [ ] Suggestions inbox renders in the settings panel and buttons successfully apply/dismiss.
- [ ] `plans/README.md` status row updated.

## STOP conditions
- Outcome format mismatch in `outcomes` table.
- Updating `ICPProfile` JSON fields fails in Drizzle.
