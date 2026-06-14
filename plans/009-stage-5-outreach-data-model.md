# Plan 009: Implement Stage 5 - Outreach Data Model and Service Layer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0ee6b79..HEAD -- src/db/schema/outreach.ts src/services/outreach.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `0ee6b79`, 2026-06-14

## Why this matters

The project has successfully completed Stages 1 through 4, verified by tests passing for Lead Workflows, Enrichment, and Audits/Scoring. It is now time to begin Stage 5: **Outreach Assistant and Approvals**. The first step is to establish the relational schema (`outreach_drafts`, `approvals`) and the corresponding Drizzle ORM service layer. This creates the reliable, versioned foundation for AI-generated drafts and human-in-the-loop approvals required by the `AGENTS.md` and `PLAN.md` core rules.

## Current state

- The database schemas are structured by domain in `src/db/schema/` (e.g., `core.ts`, `audits.ts`, `research.ts`).
- Service layers are placed in `src/services/` and use Drizzle ORM (e.g., `AuditService` in `src/services/audits.ts`).
- **Convention to match**: `src/services/audits.ts` for how to inject the database instance and structure methods.
- **Constraints**: "The system must never send outreach automatically without explicit approval." - `AGENTS.md`. Thus, drafts need an explicit status field (`DRAFT`, `APPROVED`, `REJECTED`, `SENT`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Generate  | `npm run db:generate`    | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm test -- outreach`   | all pass            |

## Scope

**In scope**:
- `src/db/schema/outreach.ts` (create)
- `src/db/schema/index.ts` (update)
- `src/services/outreach.ts` (create)
- `src/services/__tests__/outreach.test.ts` (create)

**Out of scope**:
- UI components (Lead Detail page updates).
- AI prompt generation workflows (this plan is purely operational data layer).

## Git workflow

- Branch: `advisor/009-stage-5-outreach-data-model`
- Commit per step or per logical unit.

## Steps

### Step 1: Define Outreach Schema

Create `src/db/schema/outreach.ts`.
It must define two tables: `outreachDrafts` and `approvals`.

`outreachDrafts`:
- `id` (text, PK)
- `leadId` (text, references leads.id)
- `channel` (text: 'EMAIL', 'LINKEDIN', 'CALL', etc.)
- `subject` (text, nullable)
- `body` (text)
- `status` (text: 'DRAFT', 'APPROVED', 'REJECTED', 'SENT')
- `createdByUserId` (text, references users.id)
- `createdAt` / `updatedAt` (integer timestamps)

`approvals`:
- `id` (text, PK)
- `draftId` (text, references outreachDrafts.id)
- `userId` (text, references users.id)
- `decision` (text: 'APPROVED', 'REJECTED')
- `feedback` (text, nullable)
- `createdAt`

**Verify**: `npx tsc --noEmit`

### Step 2: Export Schema

Update `src/db/schema/index.ts` (or equivalent file that exports all schemas) to export `outreachDrafts` and `approvals`.

**Verify**: `npm run db:generate` creates a new migration file.

### Step 3: Implement OutreachService

Create `src/services/outreach.ts` mimicking `AuditService`.
Methods required:
- `createDraft(data)`: inserts a new draft.
- `getDraftsForLead(leadId)`: returns all drafts.
- `updateDraftStatus(draftId, status)`: updates status.
- `recordApproval(draftId, userId, decision, feedback?)`: inserts an approval record AND updates the draft status.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 4: Write Tests

Create `src/services/__tests__/outreach.test.ts`.
Test the service methods (creating a draft, approving it, fetching drafts).
Use `src/services/__tests__/audits.test.ts` as the template for mocking or using an in-memory SQLite DB.

**Verify**: `npm test -- outreach` passes.

## Test plan

- Test creating a draft.
- Test that recording an approval successfully updates both the `approvals` table and the `outreachDrafts.status` field.
- Model after `src/services/__tests__/audits.test.ts`.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run db:generate` succeeds and generates a new migration
- [ ] `npm test -- outreach` exits 0 with all new tests passing
- [ ] No files outside the in scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- If Drizzle ORM generation fails due to schema conflicts, STOP.
- If existing schema exports are handled differently than `src/db/schema/index.ts`, STOP and adjust based on existing codebase convention.

## Maintenance notes

- This schema is designed for human-in-the-loop workflows. Future multi-agent workflows must still pass through this `outreachDrafts` table and be gated by the `APPROVED` status before any actual sending mechanism is implemented.
