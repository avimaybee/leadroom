# Plan 019: Stage 5 QoL — Toast notifications, confirmation dialogs, and draft deletion

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3ea78d2..HEAD -- src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx src/app/actions/outreach.ts src/services/outreach.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx, ui
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

The Outreach Assistant currently provides zero user-visible success feedback after mutations. When a user saves edits, approves, rejects, or marks as sent, the UI updates silently — no toast, no banner, no confirmation. This violates Nielsen's visibility-of-system-status heuristic. Additionally, there's no way to delete drafts (they accumulate permanently), and destructive actions (approve/reject) have no "are you sure?" step, making accidental clicks irreversible.

## Current state

### The component file
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx` — 717-line client component containing the entire outreach UI. Uses inline error display only (a `bg-rose-50` div for error messages, line 422-426). No success feedback mechanism exists.
- `src/app/actions/outreach.ts` — Server actions that return `{ success: true }` or `{ error: string }`.
- `src/services/outreach.ts` — Service layer with all DB operations.

### The two channels / tabs (OutreachAssistant.tsx lines 364-378)
```tsx
<div className="flex bg-slate-100 p-1 rounded-xl w-fit">
  {(['EMAIL', 'LINKEDIN', 'CALL', 'MEETING'] as const).map((ch) => (
    <button key={ch} onClick={() => handleChannelChange(ch)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
        selectedChannel === ch
          ? 'bg-white text-indigo-700 shadow-sm'
          : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {ch === 'EMAIL' ? 'Email' : ch === 'LINKEDIN' ? 'LinkedIn' : ch === 'CALL' ? 'Call Prep' : 'Meeting Prep'}
    </button>
  ))}
</div>
```

### The error message display (OutreachAssistant.tsx lines 422-426)
```tsx
{errorMsg && (
  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-bold">
    {errorMsg}
  </div>
)}
```

### Mutation handlers in OutreachAssistant.tsx — each follows this pattern:
- `handleSaveEdits` (lines 271-288): calls action, checks for `res.error`, updates local state, calls `router.refresh()`. No success feedback.
- `handleApproval` (lines 290-310): same pattern.
- `handleMarkAsSent` (lines 312-329): same pattern.
- `handleDuplicate` (lines 205-232): same pattern.
- `handleGenerate` (lines 242-269): same pattern.

### No draft deletion
- There is no `deleteDraft` method in `OutreachService`.
- There is no `deleteDraftAction` server action.
- There is no delete button in the UI.
- The only way to remove drafts is to leave them in the database.

### No confirmation dialogs
- Approve/Reject buttons fire immediately on click (lines 641-655):
```tsx
<button onClick={() => handleApproval('REJECTED')} ...>Reject</button>
<button onClick={() => handleApproval('APPROVED')} ...>Approve</button>
```

### Repo conventions
- This project uses Next.js 16 + React 19, Tailwind CSS v4, and Cloudflare D1 via Drizzle ORM.
- No toast library is installed (check `package.json`). This plan must implement a lightweight custom toast system — do NOT install a third-party toast library.
- Error messages follow the pattern: `bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-bold`.
- Server actions return `{ success: true, ... }` or `{ error: string }`.
- Client components use `'use client'` and `useState`/`useEffect` from React.
- The existing `error.tsx` at `src/app/(dashboard)/leads/[id]/error.tsx` is a page-level error boundary. Do not modify it.

## Commands you will need

| Purpose   | Command                                                       | Expected on success |
|-----------|---------------------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                                           | exit 0, no errors   |
| Tests     | `npx tsx --test src/db/__tests__/outreach.integration.test.ts`| all pass            |
| Actions   | `npx tsx --test src/db/__tests__/outreach.actions.test.ts`    | all pass            |

## Scope

**In scope**:
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx` — add toast system, confirmation dialogs, delete button, success feedback
- `src/app/actions/outreach.ts` — add `deleteDraftAction` server action
- `src/services/outreach.ts` — add `deleteDraft` method to `OutreachService`
- `src/db/__tests__/outreach.integration.test.ts` — add delete draft tests
- `src/db/__tests__/outreach.actions.test.ts` — add delete draft action tests

**Out of scope**:
- Installing third-party toast libraries (react-hot-toast, sonner, etc.)
- Modifying any other UI components or pages
- Changes to the data model/schema
- Any other feature work

## Git workflow

- Branch: `advisor/019-stage-5-qol`
- No commits needed — the reviewer will handle version control.

## Steps

### Step 1: Add `deleteDraft` method to `OutreachService`

Open `src/services/outreach.ts`. Add the following method after the `getDraftById` method (after line 85, before `createDraft`):

```typescript
  /**
   * Deletes a draft by its ID. Only DRAFT-status drafts can be deleted.
   * Returns true if deleted, false if not found.
   */
  async deleteDraft(draftId: string): Promise<boolean> {
    const draft = await this.getDraftById(draftId);
    if (!draft) return false;

    if (draft.status !== 'DRAFT') {
      throw new Error(`Only DRAFT status drafts can be deleted. Current status: ${draft.status}`);
    }

    await this.db.delete(outreachDrafts).where(eq(outreachDrafts.id, draftId));

    // Log activity
    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId: draft.leadId,
      type: 'Outreach draft deleted',
      summary: `Deleted outreach draft for ${draft.channel}`,
      timestamp: new Date(),
    });

    return true;
  }
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Add `deleteDraftAction` server action

Open `src/app/actions/outreach.ts`. Add this new action after `markAsSentAction` (before the closing of the file):

```typescript
export async function deleteDraftAction(draftId: string) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  try {
    const outreachService = new OutreachService(db);
    const deleted = await outreachService.deleteDraft(draftId);

    if (!deleted) {
      return { error: 'Draft not found' };
    }

    try {
      // We don't have the leadId anymore, so revalidate the path generically
      revalidatePath('/leads');
    } catch (e) {}

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete draft';
    return { error: msg };
  }
}
```

Now add `deleteDraftAction` to the imports of `OutreachAssistant.tsx` later (Step 4 handles this).

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Build a lightweight toast system

In `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`, add a toast system. This must be implemented as local component state — no external library.

Add these state variables near the top of the component function (after line 63):

```tsx
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
```

Then add a `useEffect` to auto-dismiss toasts (add after line 84):

```tsx
  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
```

Add a helper function to show toasts (add after the `useEffect` blocks, before `handleFileChange`):

```tsx
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };
```

Add the toast UI component. Add it just before the main return statement (before line 356), or after the error banner at line 426. The best position is right after the error banner:

After the errorMsg div (line 422-426), add:
```tsx
      {toast && (
        <div
          role="alert"
          className={`p-4 rounded-xl text-xs font-bold shadow-md transition-all duration-300 animate-fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : toast.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-indigo-50 border border-indigo-200 text-indigo-800'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-current opacity-60 hover:opacity-100 font-bold text-xs"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        </div>
      )}
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 4: Wire toast feedback into all mutation handlers

Replace every mutation handler to show a success toast. For each handler, modify as follows:

**`handleSaveEdits`** (line 271-288): Add `showToast('Draft saved successfully', 'success');` after `setDrafts(...)` and before `router.refresh()`:

```tsx
      // After setDrafts line and before router.refresh():
      showToast('Draft saved successfully', 'success');
```

**`handleApproval`** (line 290-310): Add conditional toast after `setDrafts(...)` and before `router.refresh()`:

```tsx
      showToast(
        decision === 'APPROVED' ? 'Draft approved' : 'Draft rejected',
        'success'
      );
```

**`handleMarkAsSent`** (line 312-329): Add after `setDrafts(...)` and before `router.refresh()`:

```tsx
      showToast('Marked as sent', 'success');
```

**`handleDuplicate`** (line 205-232): Add after `router.refresh()`:

```tsx
      showToast('Draft duplicated', 'success');
```

**`handleGenerate`** (line 242-269): Add after `router.refresh()`:

```tsx
      showToast('Draft generated successfully', 'success');
```

Also update all error handling paths to call `showToast(msg, 'error')` instead of setting `errorMsg`. For example, change the catch blocks from:
```tsx
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save changes');
    }
```
to:
```tsx
    } catch (e: any) {
      showToast(e.message || 'Failed to save changes', 'error');
    }
```

After this change, you can remove the `errorMsg` state variable (line 62) and the errorMsg display div (lines 422-426) — but keep the errorMsg state for the file attachment warning (line 93 uses it for unsupported file types). Only remove the state if nothing references it anymore.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 5: Add confirmation dialog for destructive actions

Create a reusable confirmation dialog within the same component (OutreachAssistant.tsx). Add state:

```tsx
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
  } | null>(null);
```

Add the dialog UI component. Add it near the toast (after the toast section):

```tsx
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full mx-4 space-y-4">
            <p className="text-sm font-bold text-slate-900">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 transition"
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
```

Now wrap the approve and reject handlers. Modify `handleApproval` to show a confirmation first if the decision is 'APPROVED'. Replace the existing `handleApproval`:

```tsx
  const handleApproval = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!activeDraft) return;

    // Show confirmation for approve
    if (decision === 'APPROVED') {
      setConfirmDialog({
        message: 'Are you sure you want to approve this draft? This action cannot be undone.',
        confirmLabel: 'Approve',
        onConfirm: async () => {
          await executeApproval(decision);
        },
      });
      return;
    }

    // Reject executes immediately
    await executeApproval(decision);
  };
```

Create a new `executeApproval` method that contains the existing approval logic:

```tsx
  const executeApproval = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!activeDraft) return;
    if (decision === 'APPROVED') setIsApproving(true);
    else setIsRejecting(true);
    setErrorMsg(null);

    try {
      const res = await recordApprovalAction(activeDraft.id, decision, feedbackInput || undefined);
      if (res.error) {
        throw new Error(res.error);
      }
      setDrafts(drafts.map(d => d.id === activeDraft.id ? { ...d, status: decision, updatedAt: new Date() } : d));
      setFeedbackInput('');
      showToast(decision === 'APPROVED' ? 'Draft approved' : 'Draft rejected', 'success');
      router.refresh();
    } catch (e: any) {
      showToast(e.message || 'Failed to record decision', 'error');
    } finally {
      setIsApproving(false);
      setIsRejecting(false);
    }
  };
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 6: Add delete button for DRAFT-status drafts in the UI

In `OutreachAssistant.tsx`, add a delete button in the action buttons area. Find the section where action buttons are rendered (lines 482-524, inside the `{activeDraft && (...)}` section).

Add a delete button after the copy button (after line 514):

```tsx
                  {activeDraft.status === 'DRAFT' && (
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          message: `Delete this ${selectedChannel.toLowerCase()} draft? This cannot be undone.`,
                          confirmLabel: 'Delete',
                          onConfirm: async () => {
                            const res = await deleteDraftAction(activeDraft.id);
                            if (res.error) {
                              showToast(res.error, 'error');
                              return;
                            }
                            const updatedList = drafts.filter(d => d.id !== activeDraft.id);
                            setDrafts(updatedList);
                            if (activeDraftId === activeDraft.id) {
                              setActiveDraftId(updatedList.length > 0 ? updatedList[0].id : null);
                            }
                            showToast('Draft deleted', 'success');
                            router.refresh();
                          },
                        });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 bg-white transition text-[10px] font-bold flex items-center gap-1.5"
                      aria-label="Delete draft"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  )}
```

Also add `deleteDraftAction` to the import at the top of the file (line 5-12):

```tsx
import { 
  generateOutreachDraftAction, 
  updateDraftAction, 
  recordApprovalAction, 
  markAsSentAction,
  duplicateDraftAction,
  deleteDraftAction,
  getModelInfoAction
} from '@/app/actions/outreach';
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 7: Add tests for delete draft

Open `src/db/__tests__/outreach.integration.test.ts`. Add these test cases before the closing `});`:

```typescript
  await t.test('deleteDraft should remove a DRAFT-status draft and log activity', async () => {
    const delDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'EMAIL',
      body: 'Draft to delete',
      createdByUserId: 'user-admin',
    });

    const deleted = await outreachService.deleteDraft(delDraft.id);
    assert.ok(deleted);

    const fetched = await outreachService.getDraftById(delDraft.id);
    assert.strictEqual(fetched, null);

    // Verify activity logged
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const deleteActivity = activitiesList.find(a => a.type === 'Outreach draft deleted');
    assert.ok(deleteActivity);
  });

  await t.test('deleteDraft should reject deleting non-DRAFT status', async () => {
    // Use the original draft which is now in SENT status
    await assert.rejects(
      () => outreachService.deleteDraft(draftId),
      (err: Error) => {
        assert.ok(err.message.includes('Only DRAFT status drafts can be deleted'));
        return true;
      }
    );
  });

  await t.test('deleteDraft should return false for non-existent draft', async () => {
    const result = await outreachService.deleteDraft('non-existent-id');
    assert.strictEqual(result, false);
  });
```

**Verify**: `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass (15 total)

Open `src/db/__tests__/outreach.actions.test.ts`. Add a test for the delete action before the closing `});`:

```typescript
  await t.test('deleteDraftAction should delete a DRAFT draft', async () => {
    const genResult = await generateOutreachDraftAction('lead-client', 'EMAIL');
    assert.ok(genResult.success);
    const delId = genResult.drafts![0].id;

    const deleteResult = await deleteDraftAction(delId);
    assert.ok(deleteResult.success);
  });
```

**Note**: You need to import `deleteDraftAction` in the actions test file. Find the import section at lines 235-241 and add it:
```typescript
import {
  generateOutreachDraftAction,
  updateDraftAction,
  recordApprovalAction,
  markAsSentAction,
  duplicateDraftAction,
  deleteDraftAction,
} from '../../app/actions/outreach';
```

**Verify**: `npx tsx --test src/db/__tests__/outreach.actions.test.ts` → all pass (9 total)

## Test plan

- 3 new integration tests in `outreach.integration.test.ts`: delete happy path, reject non-DRAFT delete, return false for missing draft.
- 1 new action test in `outreach.actions.test.ts`: delete draft via action.
- All existing tests must continue to pass.
- Verification commands in order:
  1. `npx tsc --noEmit` → exit 0
  2. `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass (15 tests)
  3. `npx tsx --test src/db/__tests__/outreach.actions.test.ts` → all pass (9 tests)

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx tsx --test src/db/__tests__/outreach.integration.test.ts` exits 0 with 15 passing tests
- [ ] `npx tsx --test src/db/__tests__/outreach.actions.test.ts` exits 0 with 9 passing tests
- [ ] Toast notifications appear after save/approve/reject/send/duplicate/generate operations
- [ ] Toast auto-dismisses after 3 seconds
- [ ] Approving a draft shows a confirmation dialog first
- [ ] DRAFT-status drafts have a delete button in the action toolbar
- [ ] Deleting a draft removes it from the sidebar and shows a success toast
- [ ] Non-DRAFT drafts cannot be deleted (service throws error)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The code excerpts above don't match the actual file contents (drift).
- Step 1 verification fails because `outreachDrafts` or `activities` or `eq` imports are missing from `src/services/outreach.ts`.
- Step 3-6 TypeScript verification fails with import errors.
- The confirmation dialog overlay breaks other interactive elements (z-index conflicts).
- Existing tests break after the changes.

## Maintenance notes

- The toast system implemented here is lightweight component-local state. If the app later needs toasts in multiple components, extract a shared `ToastProvider` using React Context.
- The confirmation dialog is also component-local. If needed elsewhere, extract to `src/components/ConfirmDialog.tsx`.
- When other features add new mutation handlers, they should follow the same pattern: show a success toast and handle errors via `showToast(msg, 'error')`.
- The overlay uses `z-50` which is high enough to overlay the sidebar (`z-40` range). If new UI layers are added above `z-50`, this must be raised.
