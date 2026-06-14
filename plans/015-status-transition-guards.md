# Plan 015: Add status transition guards to outreach service and actions

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
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

The outreach draft lifecycle has no server-side status transition guards. Three concrete problems:

1. **`updateDraftStatus`** in the service layer accepts any status transition unconditionally — SENT→DRAFT, REJECTED→SENT, etc. are all allowed.
2. **`markAsSentAction`** does not verify that the draft is in APPROVED status before marking it SENT. A direct API call can bypass the human approval gate, violating `AGENTS.md` rule #2: "The system must never send outreach automatically without explicit approval."
3. **`updateDraftAction`** (editing subject/body) checks `draft.status !== 'DRAFT'` in the action layer, but the same guard is absent in the service layer.

The valid transition map should be:
- `DRAFT` → `APPROVED`, `REJECTED`
- `APPROVED` → `SENT`
- `REJECTED` → (no transitions; user must duplicate to create a new DRAFT)
- `SENT` → (terminal state)

## Current state

- `src/services/outreach.ts` — `OutreachService` class (206 lines).
  - `updateDraftStatus` at lines 127-154: fetches draft, sets new status, logs activity if SENT. No transition validation.
  - `recordApproval` at lines 159-203: inserts approval record, updates draft status, logs activity. No pre-check that draft is in DRAFT status.
- `src/app/actions/outreach.ts` — Server actions (243 lines).
  - `markAsSentAction` at lines 208-242: no check that `draft.status === 'APPROVED'`.
- `src/db/__tests__/outreach.integration.test.ts` — Integration tests (221 lines).
  - Tests only happy path: create → approve → sent. No negative test cases.
- **Convention**: Services throw errors for invalid states (e.g., `throw new Error('Outreach draft with ID ... not found')` at line 130).

## Commands you will need

| Purpose   | Command                                                       | Expected on success |
|-----------|---------------------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                                           | exit 0, no errors   |
| Tests     | `npx tsx --test src/db/__tests__/outreach.integration.test.ts`| all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/services/outreach.ts`
- `src/app/actions/outreach.ts`
- `src/db/__tests__/outreach.integration.test.ts`

**Out of scope** (do NOT touch):
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx` — the UI already hides invalid buttons; this plan is about server-side enforcement.
- `src/db/schema/outreach.ts` — no schema changes.

## Git workflow

- Branch: `advisor/015-status-transition-guards`
- Commit message: `fix(outreach): enforce status transition guards in service layer`

## Steps

### Step 1: Add transition validation to `updateDraftStatus` in OutreachService

Open `src/services/outreach.ts`. Find the `updateDraftStatus` method (lines 127-154).

Add a `validTransitions` map and a guard after the draft lookup. The method currently looks like:

```typescript
  async updateDraftStatus(draftId: string, status: 'DRAFT' | 'APPROVED' | 'REJECTED' | 'SENT') {
    const draft = await this.getDraftById(draftId);
    if (!draft) {
      throw new Error(`Outreach draft with ID ${draftId} not found`);
    }

    const now = new Date();
    await this.db
      .update(outreachDrafts)
      ...
```

Add, immediately after the null check:

```typescript
    // Enforce valid status transitions
    const validTransitions: Record<string, string[]> = {
      'DRAFT': ['APPROVED', 'REJECTED'],
      'APPROVED': ['SENT'],
      'REJECTED': [],
      'SENT': [],
    };

    const allowed = validTransitions[draft.status] || [];
    if (!allowed.includes(status)) {
      throw new Error(
        `Invalid status transition: cannot move from ${draft.status} to ${status}`
      );
    }
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Add pre-check to `recordApproval` in OutreachService

In the same file, find `recordApproval` (lines 159-203). After the draft null check (line 166), add:

```typescript
    if (draft.status !== 'DRAFT') {
      throw new Error(
        `Cannot record approval: draft is in ${draft.status} status, expected DRAFT`
      );
    }
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Add pre-check to `markAsSentAction` in the action layer

Open `src/app/actions/outreach.ts`. Find `markAsSentAction` (lines 208-242).

After fetching the draft (line 218-221), add a guard:

```typescript
    if (draft.status !== 'APPROVED') {
      return { error: 'Only APPROVED drafts can be marked as sent.' };
    }
```

Note: The `updateDraftStatus` service method (modified in Step 1) will also enforce this, but returning a user-friendly error from the action is better UX than letting the service throw.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 4: Add negative test cases to the integration test

Open `src/db/__tests__/outreach.integration.test.ts`. Add these test cases after the existing tests (before the closing `});` of the main test suite):

```typescript
  await t.test('updateDraftStatus should reject invalid transition DRAFT -> SENT', async () => {
    // Create a fresh draft
    const freshDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'LINKEDIN',
      body: 'Test transition guard',
      createdByUserId: 'user-admin',
    });

    await assert.rejects(
      () => outreachService.updateDraftStatus(freshDraft.id, 'SENT'),
      (err: Error) => {
        assert.ok(err.message.includes('Invalid status transition'));
        return true;
      }
    );
  });

  await t.test('updateDraftStatus should reject transition from SENT to DRAFT', async () => {
    // Use the original draftId which was already moved to SENT in earlier test
    await assert.rejects(
      () => outreachService.updateDraftStatus(draftId, 'DRAFT'),
      (err: Error) => {
        assert.ok(err.message.includes('Invalid status transition'));
        return true;
      }
    );
  });

  await t.test('recordApproval should reject if draft is not in DRAFT status', async () => {
    // The original draftId is in SENT status
    await assert.rejects(
      () => outreachService.recordApproval(draftId, 'user-admin', 'APPROVED', 'Should fail'),
      (err: Error) => {
        assert.ok(err.message.includes('expected DRAFT'));
        return true;
      }
    );
  });
```

**Verify**: `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass, including 3 new tests

## Test plan

- **New tests to write**: 3 negative test cases in `src/db/__tests__/outreach.integration.test.ts` as described in Step 4.
- **Existing test pattern**: Follow the same `setupTestDb()` and assertion pattern already in the file.
- **Verification**: `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass (existing 4 + 3 new = 7)

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx tsx --test src/db/__tests__/outreach.integration.test.ts` exits 0 with 7+ passing tests
- [ ] DRAFT→SENT transition throws an error
- [ ] SENT→DRAFT transition throws an error
- [ ] Recording approval on a non-DRAFT draft throws an error
- [ ] `markAsSentAction` returns an error for non-APPROVED drafts
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The `updateDraftStatus` method signature or the `draft.status` field type doesn't match the excerpts.
- Drizzle ORM's `update` method behaves differently than expected with the guards.
- Existing tests break unexpectedly.

## Maintenance notes

- If new status values are added (e.g., `UNDER_REVIEW`, `ARCHIVED`), the `validTransitions` map in `updateDraftStatus` must be updated.
- The `recordApproval` method now only accepts DRAFT→APPROVED/REJECTED. If future requirements allow re-approval of rejected drafts, the guard must be updated.
- The UI already hides invalid buttons, so users should never encounter these errors in normal use. They protect against programmatic misuse.
