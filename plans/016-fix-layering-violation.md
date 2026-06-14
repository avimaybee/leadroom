# Plan 016: Fix layering violation — move draft editing into OutreachService

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3ea78d2..HEAD -- src/services/outreach.ts src/app/actions/outreach.ts src/db/__tests__/outreach.integration.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 015 (transition guards should be in place first)
- **Category**: tech-debt
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

The `updateDraftAction` server action directly calls `db.update(outreachDrafts).set(...)` (lines 162-169 of `src/app/actions/outreach.ts`), bypassing the `OutreachService` abstraction layer. This violates PLAN.md §5.1 ("keep layers separate") and ARCHITECTURE.md §3.2 ("application layer coordinates use cases through services"). Concretely:

1. No activity is logged when a draft's subject/body is edited (unlike create/approve/send which all log).
2. Future service-level validation (e.g., max body length, sanitization) would be bypassed.
3. Inconsistency: some mutations go through the service, some don't.

## Current state

- `src/services/outreach.ts` — Has `createDraft`, `getDraftsForLead`, `getDraftById`, `updateDraftStatus`, `recordApproval`, `cleanOldAttachments`. Does NOT have a method for updating draft content (subject/body).
- `src/app/actions/outreach.ts` lines 142-178 — `updateDraftAction` directly imports and uses `outreachDrafts` table and `eq` from drizzle-orm to mutate the database. The status guard `if (draft.status !== 'DRAFT')` is in the action layer, not the service.
- **Convention**: Other mutations go through service methods that:
  1. Validate preconditions
  2. Perform the mutation
  3. Log an activity event
  4. Return the updated entity
  Pattern example: `createDraft` at lines 90-122 of `src/services/outreach.ts`.

## Commands you will need

| Purpose   | Command                                                       | Expected on success |
|-----------|---------------------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                                           | exit 0, no errors   |
| Tests     | `npx tsx --test src/db/__tests__/outreach.integration.test.ts`| all pass            |

## Scope

**In scope**:
- `src/services/outreach.ts` (add `updateDraftContent` method)
- `src/app/actions/outreach.ts` (refactor `updateDraftAction` to use the new service method)
- `src/db/__tests__/outreach.integration.test.ts` (add test for the new method)

**Out of scope**:
- `src/db/schema/outreach.ts` — no schema changes
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx` — no UI changes

## Git workflow

- Branch: `advisor/016-fix-layering-violation`
- Commit message: `refactor(outreach): move draft editing into OutreachService`

## Steps

### Step 1: Add `updateDraftContent` method to OutreachService

Open `src/services/outreach.ts`. Add a new method after `createDraft` (after line 122):

```typescript
  /**
   * Updates the subject and body of a draft. Only DRAFT-status drafts can be edited.
   */
  async updateDraftContent(draftId: string, subject: string | null, body: string) {
    const draft = await this.getDraftById(draftId);
    if (!draft) {
      throw new Error(`Outreach draft with ID ${draftId} not found`);
    }

    if (draft.status !== 'DRAFT') {
      throw new Error(`Only drafts in DRAFT status can be edited. Current status: ${draft.status}`);
    }

    const now = new Date();
    await this.db
      .update(outreachDrafts)
      .set({
        subject,
        body,
        updatedAt: now,
      })
      .where(eq(outreachDrafts.id, draftId));

    // Log activity for the edit
    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId: draft.leadId,
      type: 'Outreach draft edited',
      summary: `Edited outreach draft for ${draft.channel}`,
      timestamp: now,
    });

    return { ...draft, subject, body, updatedAt: now };
  }
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Refactor `updateDraftAction` to use the service method

Open `src/app/actions/outreach.ts`. Replace the `updateDraftAction` function (lines 142-178) with:

```typescript
export async function updateDraftAction(draftId: string, subject: string | null, body: string) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  try {
    const outreachService = new OutreachService(db);
    await outreachService.updateDraftContent(draftId, subject, body);

    // Get the draft to find the leadId for revalidation
    const draft = await outreachService.getDraftById(draftId);
    try {
      if (draft) revalidatePath(`/leads/${draft.leadId}`);
    } catch (e) {}
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update draft';
    return { error: msg };
  }
}
```

Also remove the now-unused import `import { outreachDrafts } from '@/db/schema';` and `import { eq } from 'drizzle-orm';` from the top of the file — but ONLY if no other code in this file still uses them. Check the file: `markAsSentAction` does not use them, `duplicateDraftAction` does not use them, etc. If they are unused, remove them.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Add a test for `updateDraftContent`

Open `src/db/__tests__/outreach.integration.test.ts`. Add a test after the existing "createDraft" test:

```typescript
  await t.test('updateDraftContent should update subject and body and log activity', async () => {
    const updated = await outreachService.updateDraftContent(draftId, 'New Subject Line', 'Updated body text');
    assert.ok(updated);
    assert.strictEqual(updated.subject, 'New Subject Line');
    assert.strictEqual(updated.body, 'Updated body text');

    // Verify activity logged
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const editActivity = activitiesList.find(a => a.type === 'Outreach draft edited');
    assert.ok(editActivity);
    assert.ok(editActivity.summary.includes('Edited outreach draft for EMAIL'));
  });

  await t.test('updateDraftContent should reject editing non-DRAFT status', async () => {
    // First approve the draft so it's no longer in DRAFT status
    await outreachService.recordApproval(draftId, 'user-admin', 'APPROVED');

    await assert.rejects(
      () => outreachService.updateDraftContent(draftId, 'Should fail', 'body'),
      (err: Error) => {
        assert.ok(err.message.includes('Only drafts in DRAFT status'));
        return true;
      }
    );
  });
```

Note: You will need to reorder or adjust the existing tests so that the `updateDraftContent` test runs before the `recordApproval` test, OR use a separate draft for the negative test. The safest approach is to create a second test draft for the negative case:

```typescript
  await t.test('updateDraftContent should reject editing non-DRAFT status', async () => {
    // Create a fresh draft and approve it
    const tempDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'CALL',
      body: 'Temp draft for rejection test',
      createdByUserId: 'user-admin',
    });
    await outreachService.recordApproval(tempDraft.id, 'user-admin', 'APPROVED');

    await assert.rejects(
      () => outreachService.updateDraftContent(tempDraft.id, 'Should fail', 'body'),
      (err: Error) => {
        assert.ok(err.message.includes('Only drafts in DRAFT status'));
        return true;
      }
    );
  });
```

**Verify**: `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass

## Test plan

- New tests: 2 cases in `outreach.integration.test.ts` — happy path edit, and rejection of edit on non-DRAFT.
- Follow existing test structure using `setupTestDb()`.
- Verification: `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx tsx --test src/db/__tests__/outreach.integration.test.ts` exits 0
- [ ] `updateDraftAction` no longer directly imports or uses `outreachDrafts` table or `eq` from drizzle-orm
- [ ] `OutreachService.updateDraftContent` method exists and logs an activity event
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The `outreachDrafts` or `eq` imports in `outreach.ts` (actions) are still needed by other functions in the same file.
- Plan 015 has not been applied and `recordApproval` doesn't have a guard yet — the negative test depends on `recordApproval` succeeding.
- Drizzle's `update` API behaves differently than expected.

## Maintenance notes

- After this change, ALL draft mutations go through `OutreachService`, making the service layer the single source of truth for draft business logic.
- The activity type `'Outreach draft edited'` is new. If the activity timeline UI filters by type, it may need to include this new type.
