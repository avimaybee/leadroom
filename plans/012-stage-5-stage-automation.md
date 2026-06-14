# Plan 012: Stage Automation on Outreach Sent

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3ea78d2..HEAD -- src/app/actions/outreach.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: features
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

Currently, when a user marks an Outreach Draft as "SENT", the draft status updates, but the overarching Lead's pipeline stage remains static. To enforce pipeline discipline (Stage 6), sending an outreach should automatically advance a "New" or "Researching" lead into "Outreach in Progress" (or "Meeting / Call" depending on context). This prevents stale pipeline data and reduces manual clicks.

## Current state

- `src/app/actions/outreach.ts`: `markAsSentAction` updates the draft status via `outreachService.updateDraftStatus`, then revalidates the path. It does not touch `leadService.updateStage`.

**Conventions**: 
- `LeadService` handles stage changes and historization (likely via `updateStage`).
- Stages are `['New', 'Researching', 'Qualified', 'Outreach in Progress', 'Meeting / Call']`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/app/actions/outreach.ts`

**Out of scope**:
- Changing stage definitions.
- Other draft status changes (only `SENT`).

## Git workflow

- Branch: `advisor/012-stage-automation`
- Commit message style: `feat(outreach): automate lead pipeline stage update on draft sent`

## Steps

### Step 1: Inject LeadService into `markAsSentAction`

In `src/app/actions/outreach.ts`, locate `markAsSentAction`.
1. Instantiate `LeadService` (`const leadService = new LeadService(db);`).
2. Fetch the current lead: `const lead = await leadService.getLead(draft.leadId);`.
3. Check the lead's current stage. If the stage is `New`, `Researching`, or `Qualified`, automatically update it to `Outreach in Progress` when the draft channel is `EMAIL` or `LINKEDIN`. If the channel is `MEETING` or `CALL`, update to `Meeting / Call`.
4. Call `leadService.updateStage(draft.leadId, newStage, userId)`. (Verify the exact signature of `updateStage` in `src/services/lead.ts` if needed, typically it requires a user context or just the leadId and stage). If it uses `updateLeadAction` instead of service directly, use the service directly.

**Verify**: `npm run typecheck` → passes.

## Test plan

- Manual verify: Change a lead's stage to 'Qualified'. Mark an Email draft as 'Sent'. The lead stage should instantly jump to 'Outreach in Progress'.
- `npm run typecheck && npm run build`

## Done criteria

- [ ] `markAsSentAction` updates the lead stage.
- [ ] `npm run build` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If `LeadService` does not expose an accessible method to cleanly update the stage and log activity, stop and report.

## Maintenance notes

- If pipeline stages are customized per-workspace later, this hardcoded logic must be moved to a configurable workflow rules engine.
