# Plan 018: Add rejection flow tests and origin field to outreach schema

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3ea78d2..HEAD -- src/db/schema/outreach.ts src/services/outreach.ts src/db/__tests__/outreach.integration.test.ts src/db/__tests__/outreach.actions.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 015 (transition guards), 016 (layering fix — optional but recommended)
- **Category**: tests + tech-debt
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

Two gaps addressed:

### Missing rejection flow test coverage (TEST-02)
The reject→duplicate→re-edit cycle is a core Stage 5 UX workflow (the UI shows a "Duplicate & Edit" button on rejected drafts). Neither integration test file covers this path. If a regression broke the duplicate-after-reject flow, no test would catch it.

### Missing `origin` field on outreach_drafts schema (DEBT-03)
DATA_MODEL.md §5.9 specifies an `origin` field (enum: `MANUAL`, `AI_GENERATED`) for the outreach draft record. The current schema has no such field. This makes it impossible to distinguish human-written drafts from AI-generated ones, which matters for:
- Audit trail / provenance tracking (AGENTS.md Definition of Done: "AI output is reviewable")
- Future reporting on AI effectiveness
- Compliance with the project's data integrity rules

## Current state

### Tests
- `src/db/__tests__/outreach.integration.test.ts` (221 lines): Tests create→approve→sent happy path. No rejection test.
- `src/db/__tests__/outreach.actions.test.ts` (333 lines): Tests generate→edit→approve→sent→duplicate. No rejection test.

### Schema
- `src/db/schema/outreach.ts` (26 lines): `outreach_drafts` table has no `origin` column.
- `src/services/outreach.ts`: `CreateDraftInput` interface does not include `origin`.
- `src/app/actions/outreach.ts`: `generateOutreachDraftAction` creates drafts via `outreachService.createDraft(...)` without specifying origin. `duplicateDraftAction` also creates without origin.

## Commands you will need

| Purpose   | Command                                                       | Expected on success |
|-----------|---------------------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                                           | exit 0, no errors   |
| Generate  | `npm run db:generate`                                         | exit 0              |
| Tests     | `npx tsx --test src/db/__tests__/outreach.integration.test.ts`| all pass            |
| Actions   | `npx tsx --test src/db/__tests__/outreach.actions.test.ts`    | all pass            |

## Scope

**In scope**:
- `src/db/schema/outreach.ts` (add `origin` column)
- `src/services/outreach.ts` (update `CreateDraftInput` and `createDraft` to accept `origin`)
- `src/app/actions/outreach.ts` (pass `origin` values: `AI_GENERATED` for AI-generated drafts, `MANUAL` for duplicates)
- `src/db/__tests__/outreach.integration.test.ts` (add rejection flow tests)
- `src/db/__tests__/outreach.actions.test.ts` (add rejection→duplicate flow test and update schema)

**Out of scope**:
- UI changes (the UI does not currently display origin — that's a future enhancement)
- `src/lib/ai.ts`

## Git workflow

- Branch: `advisor/018-rejection-tests-and-origin`
- Commit message: `feat(outreach): add origin field and rejection flow test coverage`

## Steps

### Step 1: Add `origin` column to outreach_drafts schema

Open `src/db/schema/outreach.ts`. Add the `origin` field to the `outreachDrafts` table, after the `status` line:

Current:
```typescript
  status: text('status').notNull().default('DRAFT'), // 'DRAFT' | 'APPROVED' | 'REJECTED' | 'SENT'
  createdByUserId: text('created_by_user_id').references(() => users.id),
```

Updated:
```typescript
  status: text('status').notNull().default('DRAFT'), // 'DRAFT' | 'APPROVED' | 'REJECTED' | 'SENT'
  origin: text('origin').notNull().default('AI_GENERATED'), // 'AI_GENERATED' | 'MANUAL'
  createdByUserId: text('created_by_user_id').references(() => users.id),
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Update CreateDraftInput and createDraft

Open `src/services/outreach.ts`. Add `origin` to the `CreateDraftInput` interface:

```typescript
export interface CreateDraftInput {
  leadId: string;
  channel: string;
  subject?: string | null;
  body: string;
  createdByUserId?: string | null;
  attachments?: string | null;
  origin?: 'AI_GENERATED' | 'MANUAL';
}
```

In the `createDraft` method, add origin to the newDraft object:

```typescript
    const newDraft = {
      id,
      leadId: input.leadId,
      channel: input.channel,
      subject: input.subject || null,
      body: input.body,
      status: 'DRAFT' as const,
      origin: input.origin || 'AI_GENERATED',
      createdByUserId: input.createdByUserId || null,
      createdAt: now,
      updatedAt: now,
      attachments: input.attachments || null,
    };
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Set origin in server actions

Open `src/app/actions/outreach.ts`.

In `generateOutreachDraftAction` (around line 86), the `outreachService.createDraft(...)` call should include `origin: 'AI_GENERATED'`:

```typescript
      const newDraft = await outreachService.createDraft({
        leadId: lead.id,
        channel,
        subject: draft.subject || null,
        body: bodyWithTone,
        createdByUserId: userId,
        attachments: attachments && attachments.length > 0 ? JSON.stringify(attachments) : null,
        origin: 'AI_GENERATED',
      });
```

In `duplicateDraftAction` (around line 123), set `origin: 'MANUAL'` since duplicates are human-initiated:

```typescript
    const duplicatedDraft = await outreachService.createDraft({
      leadId: oldDraft.leadId,
      channel: oldDraft.channel,
      subject: oldDraft.subject,
      body: oldDraft.body,
      createdByUserId: userId,
      origin: 'MANUAL',
    });
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 4: Update test database schemas

Both test files create in-memory SQLite databases with manual CREATE TABLE statements. Add the `origin` column to the `outreach_drafts` table in both test files.

In `src/db/__tests__/outreach.integration.test.ts`, find:
```sql
    CREATE TABLE outreach_drafts (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      channel TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'DRAFT' NOT NULL,
      created_by_user_id TEXT REFERENCES users(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      attachments TEXT
    );
```

Add the `origin` column:
```sql
    CREATE TABLE outreach_drafts (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      channel TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'DRAFT' NOT NULL,
      origin TEXT DEFAULT 'AI_GENERATED' NOT NULL,
      created_by_user_id TEXT REFERENCES users(id),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      attachments TEXT
    );
```

Do the same in `src/db/__tests__/outreach.actions.test.ts`.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 5: Add rejection flow tests

Open `src/db/__tests__/outreach.integration.test.ts`. Add the following test cases after the existing tests:

```typescript
  await t.test('recordApproval should handle REJECTED decision correctly', async () => {
    // Create a fresh draft for rejection
    const rejDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'LINKEDIN',
      body: 'Draft to be rejected',
      createdByUserId: 'user-admin',
    });

    const approval = await outreachService.recordApproval(
      rejDraft.id,
      'user-admin',
      'REJECTED',
      'Tone is too aggressive, needs softening.'
    );

    assert.strictEqual(approval.decision, 'REJECTED');
    assert.strictEqual(approval.feedback, 'Tone is too aggressive, needs softening.');

    const updatedDraft = await outreachService.getDraftById(rejDraft.id);
    assert.ok(updatedDraft);
    assert.strictEqual(updatedDraft.status, 'REJECTED');

    // Verify activity logged
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const rejActivity = activitiesList.find(a => a.type === 'Outreach rejected');
    assert.ok(rejActivity);
    assert.ok(rejActivity.summary.includes('Rejected outreach draft for LINKEDIN'));
  });

  await t.test('rejected draft cannot transition to SENT', async () => {
    const rejDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'CALL',
      body: 'Another draft to reject',
      createdByUserId: 'user-admin',
    });
    await outreachService.recordApproval(rejDraft.id, 'user-admin', 'REJECTED', 'Not good enough');

    await assert.rejects(
      () => outreachService.updateDraftStatus(rejDraft.id, 'SENT'),
      (err: Error) => {
        assert.ok(err.message.includes('Invalid status transition'));
        return true;
      }
    );
  });
```

**Note**: The "Invalid status transition" error message depends on Plan 015 being applied. If Plan 015 has not been applied yet, this test will fail — see STOP conditions.

**Verify**: `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass

### Step 6: Add rejection→duplicate flow test to actions test

Open `src/db/__tests__/outreach.actions.test.ts`. Add after the existing tests:

```typescript
  await t.test('reject → duplicate → re-edit flow should work end-to-end', async () => {
    // Generate a draft
    const genResult = await generateOutreachDraftAction('lead-client', 'LINKEDIN');
    assert.ok(genResult.success);
    const originalDraftId = genResult.drafts![0].id;

    // Reject it
    const rejResult = await recordApprovalAction(originalDraftId, 'REJECTED', 'Too formal');
    assert.ok(rejResult.success);

    // Duplicate the rejected draft
    const dupResult = await duplicateDraftAction(originalDraftId);
    assert.ok(dupResult.success);
    assert.ok(dupResult.draft);
    assert.strictEqual(dupResult.draft.status, 'DRAFT');
    assert.notStrictEqual(dupResult.draft.id, originalDraftId);

    // Edit the duplicate
    const editResult = await updateDraftAction(dupResult.draft.id, null, 'Less formal body');
    assert.ok(editResult.success);

    // Approve the edited duplicate
    const approveResult = await recordApprovalAction(dupResult.draft.id, 'APPROVED');
    assert.ok(approveResult.success);
  });
```

**Verify**: `npx tsx --test src/db/__tests__/outreach.actions.test.ts` → all pass

### Step 7: Generate migration

Run `npm run db:generate` to create a migration file for the new `origin` column.

**Verify**: `npm run db:generate` → exit 0

## Test plan

- 2 new tests in `outreach.integration.test.ts` (rejection handling, rejected→SENT guard)
- 1 new test in `outreach.actions.test.ts` (reject→duplicate→edit→approve end-to-end)
- All existing tests must continue to pass
- Verification commands in order:
  1. `npx tsc --noEmit` → exit 0
  2. `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass
  3. `npx tsx --test src/db/__tests__/outreach.actions.test.ts` → all pass

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run db:generate` exits 0
- [ ] `npx tsx --test src/db/__tests__/outreach.integration.test.ts` exits 0 with rejection tests passing
- [ ] `npx tsx --test src/db/__tests__/outreach.actions.test.ts` exits 0 with rejection flow test passing
- [ ] `outreach_drafts` schema has an `origin` column
- [ ] AI-generated drafts have `origin: 'AI_GENERATED'`
- [ ] Duplicated drafts have `origin: 'MANUAL'`
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- Plan 015 status transition guards have not been applied — the "rejected→SENT guard" test will fail without them. In that case, remove that specific test case and note the dependency.
- The `npm run db:generate` command fails because of schema conflicts.
- Existing tests break after adding the `origin` column.

## Maintenance notes

- The `origin` field defaults to `'AI_GENERATED'` to maintain backwards compatibility with existing data.
- The UI does not yet display the origin field. A future plan can add a badge (e.g., "AI" vs "Manual") on draft cards in the sidebar.
- If a third origin value is needed (e.g., `'TEMPLATE'` for template-based drafts), the schema supports it since the column is a text field, not a strict enum.
