# Plan 059: Enforce Server Action Authorization Checks (IDOR Prevention)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 38561c5..HEAD -- src/app/actions/outreach.ts src/app/actions/leads.ts src/app/actions/research.ts src/app/actions/tasks.ts src/app/actions/reminders.ts src/app/actions/triage.ts src/app/actions/audits.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/058-sdr-phase-4-outreach-and-learning.md
- **Category**: security
- **Planned at**: commit `38561c5`, 2026-06-29

## Why this matters
Server Actions in `leads.ts`, `research.ts`, `outreach.ts`, `tasks.ts`, `reminders.ts`, `triage.ts`, and `audits.ts` mutate or read data using entity IDs without confirming that the current user owns the target prospect. This exposes the system to Insecure Direct Object Reference (IDOR) vulnerabilities, enabling any authenticated user to inspect, modify, or delete another user's prospects, tasks, drafts, or notes simply by changing the IDs in the payloads. This plan resolves the vulnerability by centralizing access checks.

## Current state
A local `verifyProspectAccess` helper exists in `src/app/actions/outcomes.ts:11-18`:
```ts
async function verifyProspectAccess(db: ReturnType<typeof getDb>, leadId: string, userId: string): Promise<boolean> {
  const [prospect] = await db
    .select({ ownerId: prospects.ownerId })
    .from(prospects)
    .where(eq(prospects.id, leadId))
    .limit(1);
  return prospect ? prospect.ownerId === userId : false;
}
```
All other Server Actions only verify `if (!userId) { return { error: 'Unauthorized' } }` but do not perform the secondary ownership check.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope**:
- `src/lib/auth.ts`
- `src/app/actions/outcomes.ts`
- `src/app/actions/leads.ts`
- `src/app/actions/research.ts`
- `src/app/actions/outreach.ts`
- `src/app/actions/tasks.ts`
- `src/app/actions/reminders.ts`
- `src/app/actions/triage.ts`
- `src/app/actions/audits.ts`

**Out of scope**:
- Direct updates to client-side UI files (the server action contracts remain identical, returning `{ error: ... }` strings on authorization failure).

## Git workflow
- Branch: `advisor/059-sec-auth-IDOR-prospect-actions`
- Commit per file updated. Message format: `security: enforce verifyProspectAccess in outcomes.ts`

## Steps

### Step 1: Centralize verification utility in `src/lib/auth.ts`
Move and export the `verifyProspectAccess` function from `src/app/actions/outcomes.ts` to `src/lib/auth.ts`.
```ts
import { Db } from '@/db';
import { prospects } from '@/db/schema/core';
import { eq } from 'drizzle-orm';

export async function verifyProspectAccess(db: Db, prospectId: string, userId: string): Promise<boolean> {
  if (!prospectId || !userId) return false;
  const [prospect] = await db
    .select({ ownerId: prospects.ownerId })
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  return prospect ? prospect.ownerId === userId : false;
}
```
**Verify**: `npx tsc --noEmit` -> compiles without error.

### Step 2: Update outcomes actions to use centralized utility
Import `verifyProspectAccess` in `src/app/actions/outcomes.ts` from `@/lib/auth` and delete the local `verifyProspectAccess` helper.
**Verify**: `npm test` -> all tests pass.

### Step 3: Apply authorization checks to `src/app/actions/leads.ts`
Import `verifyProspectAccess`. Verify prospect ownership for:
- `archiveLeadAction(id)`
- `updateStageAction(formData)` (extract `leadId` from formData)
- `updateLeadAction(prevState, formData)` (extract `leadId` from formData)
- `addNoteAction(prevState, formData)`
If check fails, return `{ error: 'Forbidden: you do not own this prospect' }` (or throw an error if matching existing patterns).
**Verify**: `npx tsc --noEmit` -> success.

### Step 4: Apply authorization checks to `src/app/actions/research.ts`
Verify prospect ownership for:
- `saveResearchSnapshotAction`
- `addContactAction`
- `deleteContactAction`
- `updateContactAction`
**Verify**: `npm test` -> success.

### Step 5: Apply authorization checks to `src/app/actions/outreach.ts`
Lookup prospect ID from draft ID where applicable, and verify ownership for:
- `generateOutreachDraftAction(leadId, ...)`
- `duplicateDraftAction(draftId)`
- `updateDraftAction(draftId, ...)`
- `recordApprovalAction(draftId, ...)`
- `deleteDraftAction(draftId)`
- `markAsSentAction(draftId)`
**Verify**: `npm test` -> success.

### Step 6: Apply authorization checks to `src/app/actions/tasks.ts`, `reminders.ts`, `triage.ts`, and `audits.ts`
Verify prospect ownership for:
- `createTaskAction` and `toggleTaskStatusAction` (lookup task first to get prospectId)
- `createReminderAction`
- `toggleTriageStatusAction` (lookup task/draft first to extract prospectId if entityType is task/draft)
- `triggerAuditAction` and `manualOverrideScoreAction`
**Verify**: `npm test` -> success.

## Test plan
- Add unit tests in `src/app/api/__tests__/auth-actions.test.ts` mocking a second user and attempting to invoke `duplicateDraftAction`, `toggleTriageStatusAction`, and `manualOverrideScoreAction` on User B's prospects. Assert that actions reject the requests with `{ error: 'Forbidden: you do not own this prospect' }`.
- Verify using `npm test`.

## Done criteria
- [ ] `npx tsc --noEmit` exits 0 with no errors.
- [ ] `npm test` runs all integration and unit tests successfully.
- [ ] No plaintext IDOR vulnerabilities remain in prospect-facing Server Actions.
- [ ] `plans/README.md` status row updated.

## STOP conditions
- Excerpts in `Current state` differ from the codebase.
- Rebuilding mock databases fails to run locally.

## Maintenance notes
- When creating new server actions in `src/app/actions/`, always check user authorization by matching their `userId` against the prospect's `ownerId` using `verifyProspectAccess`.
