# Plan 021: Stage 5 workflow efficiency — keyboard shortcuts, preview mode, word count, and auto-save

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

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 019 (uses the toast system) — if 019 hasn't been applied yet, skip the `showToast` calls and use inline error display instead
- **Category**: ui, dx
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

The Outreach Assistant has several workflow gaps that slow down operators. Power users must use the mouse for every action (no keyboard shortcuts), the body textarea is limited to 10 visible rows with no word/character count, long structured content (especially CALL and MEETING prep guides) can't be previewed in a rendered format, custom prompt input is lost on accidental channel switch, and there's no way to compare two drafts side-by-side when choosing which to send. Fixing these makes the tool dramatically faster for daily operators.

## Current state

### Keyboard shortcuts — none exist
- All actions require mouse clicks on buttons.
- The textareas and inputs are standard HTML with no custom key handlers.

### Body textarea (line 546-553)
```tsx
<textarea
  id="body-input"
  rows={10}
  value={bodyInput}
  onChange={(e) => setBodyInput(e.target.value)}
  disabled={activeDraft.status !== 'DRAFT'}
  className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-4 focus:bg-white focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 leading-relaxed"
/>
```
Fixed at 10 rows. No auto-resize. No word/character count.

### No preview mode
- The textarea shows the raw draft content with tone prefix `[Tone: Direct]` at the beginning.
- There's no way to see the rendered message as the recipient would see it.
- For CALL and MEETING channels, the content is structured text with headings and sections — a preview would help.

### Custom prompt cleared on channel switch (line 201)
```tsx
setCustomPrompt('');
```
In `handleChannelChange`, the custom prompt is reset when the user switches channels. If the user typed instructions and accidentally clicked a different tab, their input is lost.

### No draft comparison
- The sidebar lists drafts. Clicking one selects it and replaces the editor content.
- No way to view two drafts at the same time to compare them.

### No auto-save
- The user must manually click "Save Edits" before approving or switching away.
- If they forget to save, their edits remain in local state.

### Repo conventions
- The project uses Tailwind CSS v4, React 19, Next.js 16.
- `useEffect` with cleanup is used for subscriptions and timers.
- Error handling follows: try/catch → set error state → render error UI.
- No existing keyboard shortcuts anywhere in the app.

## Commands you will need

| Purpose   | Command                                                       | Expected on success |
|-----------|---------------------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                                           | exit 0, no errors   |
| Tests     | `npx tsx --test src/db/__tests__/outreach.integration.test.ts`| all pass            |
| Actions   | `npx tsx --test src/db/__tests__/outreach.actions.test.ts`    | all pass            |

## Scope

**In scope** (only file to modify):
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`

**Out of scope**:
- Other components or pages
- Server actions, service layer, or data model
- The `react-markdown` library is already in `package.json` — you may import it for the preview mode
- Adding new npm packages

## Git workflow

- Branch: `advisor/021-stage-5-workflow-efficiency`
- No commits needed.

## Steps

### Step 1: Add word/character count below the body textarea

Open `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`.

Find the body textarea (around line 544-554). Below it, after the closing `</textarea>` tag and before the `</div>` of its parent, add a word count display:

```tsx
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-1 px-1">
                  <span>
                    {bodyInput ? bodyInput.split(/\s+/).filter(Boolean).length : 0} words
                  </span>
                  <span>
                    {bodyInput.length} characters
                  </span>
                </div>
```

This should be placed right after the `</textarea>` tag (after line 554), still inside the same parent div (the one starting at line 544 or line 536).

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Add preview mode toggle

Add a state variable for preview mode (add after the existing states, around line 64):

```tsx
  const [showPreview, setShowPreview] = useState(false);
```

Add a preview toggle button next to the existing action buttons. Find the button group (around line 482-524). Add a preview button after the copy button (after line 514):

```tsx
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`p-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 transition ${
                      showPreview
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200 bg-white'
                    }`}
                    aria-label={showPreview ? 'Show editor' : 'Show preview'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {showPreview ? 'Edit' : 'Preview'}
                  </button>
```

Now conditionally render the preview instead of the textarea. Find the body input section (lines 544-554). Replace it so that when `showPreview` is true, it shows a rendered preview instead:

```tsx
                {showPreview && activeDraft ? (
                  <div className="w-full bg-white border border-slate-200 rounded-xl p-4 min-h-[200px] text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {selectedChannel === 'EMAIL' && subjectInput && (
                      <div className="mb-3 pb-3 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</span>
                        <p className="font-bold text-slate-900 mt-1">{subjectInput}</p>
                      </div>
                    )}
                    {bodyInput}
                  </div>
                ) : (
                  <textarea
                    id="body-input"
                    rows={10}
                    value={bodyInput}
                    onChange={(e) => setBodyInput(e.target.value)}
                    disabled={activeDraft.status !== 'DRAFT'}
                    className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-4 focus:bg-white focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 leading-relaxed"
                  />
                )}
```

Also add the word count below, after the textarea/preview block (from Step 1):

```tsx
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-1 px-1">
                  <span>
                    {bodyInput ? bodyInput.split(/\s+/).filter(Boolean).length : 0} words
                  </span>
                  <span>
                    {bodyInput.length} characters
                  </span>
                </div>
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Preserve custom prompt on channel switch

Find `handleChannelChange` (around line 188-203). Remove the line `setCustomPrompt('');` so the custom prompt survives channel switches.

Old line 201:
```tsx
    setCustomPrompt('');
```

Remove this line entirely. The function should no longer clear the custom prompt.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 4: Add keyboard shortcuts

Add a global `useEffect` that listens for keyboard shortcuts. Add this after the existing useEffect blocks (after line 84):

```tsx
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeDraft?.status === 'DRAFT') {
          handleSaveEdits();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDraft?.id, activeDraft?.status, subjectInput, bodyInput]);
```

**Important**: The dependency array must include all values used inside `handleKeyDown`. Since `handleSaveEdits` references `activeDraft`, `subjectInput`, `bodyInput`, these must be in the dependency array. However, to avoid stale closures, use a ref-based approach or include them in deps.

Actually, simpler approach — use a ref for the save handler to avoid dependency complexity:

```tsx
  // Refs for keyboard shortcut access
  const saveEditsRef = useRef(handleSaveEdits);
  saveEditsRef.current = handleSaveEdits;
  const activeDraftStatusRef = useRef(activeDraft?.status);
  activeDraftStatusRef.current = activeDraft?.status;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeDraftStatusRef.current === 'DRAFT') {
          saveEditsRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
```

You will need to add `useRef` to the React import at line 3:

```tsx
import { useState, useEffect, useRef } from 'react';
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 5: Auto-save before approve action

Modify the `executeApproval` function (created in plan 019, or the existing `handleApproval` if 019 hasn't been applied) to save edits before approving if the content has changed.

Find the `executeApproval` function (or `handleApproval` if 019 is not applied). Before making the approval call, save the current content:

```tsx
  const executeApproval = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!activeDraft) return;
    if (decision === 'APPROVED') setIsApproving(true);
    else setIsRejecting(true);
    setErrorMsg(null);

    try {
      // Auto-save current edits before approving
      if (decision === 'APPROVED' && activeDraft.status === 'DRAFT') {
        const currentSubject = subjectInput || null;
        const currentBody = bodyInput;
        const hasChanges = currentSubject !== activeDraft.subject || currentBody !== activeDraft.body;
        if (hasChanges) {
          const saveRes = await updateDraftAction(activeDraft.id, currentSubject, currentBody);
          if (saveRes.error) {
            throw new Error(saveRes.error);
          }
          // Update local state to reflect saved content
          setDrafts(drafts.map(d =>
            d.id === activeDraft.id
              ? { ...d, subject: currentSubject, body: currentBody, updatedAt: new Date() }
              : d
          ));
        }
      }

      const res = await recordApprovalAction(activeDraft.id, decision, feedbackInput || undefined);
      if (res.error) {
        throw new Error(res.error);
      }
      setDrafts(drafts.map(d => d.id === activeDraft.id ? { ...d, status: decision, updatedAt: new Date() } : d));
      setFeedbackInput('');
      if (typeof showToast === 'function') {
        showToast(decision === 'APPROVED' ? 'Draft approved' : 'Draft rejected', 'success');
      }
      router.refresh();
    } catch (e: any) {
      if (typeof showToast === 'function') {
        showToast(e.message || 'Failed to record decision', 'error');
      } else {
        setErrorMsg(e.message || 'Failed to record decision');
      }
    } finally {
      setIsApproving(false);
      setIsRejecting(false);
    }
  };
```

Note: This code references `showToast` from plan 019. If plan 019 hasn't been applied, use `setErrorMsg` instead and remove the `showToast` fallback check. The `showToast` function does not exist unless plan 019 was applied.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 6: Add auto-resize textarea

Make the body textarea auto-resize based on content. Add a `useEffect` that adjusts the height:

Add this after the existing useEffect blocks:

```tsx
  // Auto-resize body textarea
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';
  }, [bodyInput]);
```

Now add `ref={bodyTextareaRef}` to the body textarea element. Find the textarea with `id="body-input"` and add `ref={bodyTextareaRef}` as a prop. Also remove `rows={10}` since auto-resize makes it unnecessary:

```tsx
                  <textarea
                    id="body-input"
                    ref={bodyTextareaRef}
                    value={bodyInput}
                    onChange={(e) => setBodyInput(e.target.value)}
                    disabled={activeDraft.status !== 'DRAFT'}
                    className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-4 focus:bg-white focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 leading-relaxed"
                  />
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 7: Add draft comparison (side-by-side view)

This is the largest step. Add a compare mode that lets the user select two drafts and view them side by side.

Add state variables (around line 64):

```tsx
  const [compareMode, setCompareMode] = useState(false);
  const [compareDraftId, setCompareDraftId] = useState<string | null>(null);
```

Add a compare button in the header area (around line 355-379, after the channel tabs). Find the div with the channel tabs at line 364-378 and add a compare toggle button after it:

```tsx
        {/* Draft Comparison Toggle */}
        {channelDrafts.length >= 2 && (
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              if (!compareMode) {
                setShowPreview(false);
              }
            }}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
              compareMode
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-slate-600 hover:text-indigo-600 border-slate-200'
            }`}
          >
            {compareMode ? 'Exit Compare' : `Compare Drafts (${channelDrafts.length})`}
          </button>
        )}
```

Now, in the main content area, conditionally render the comparison view. Find where `{!activeDraft ? ...}` begins (line 432). After the existing empty/draft condition, add the compare mode rendering INSIDE the draft branch.

Actually, the easiest approach: add the compare mode rendering above the main activeDraft section. Just before the `{!activeDraft ? (...)` at line 432, add:

```tsx
          {/* Comparison View */}
          {compareMode && channelDrafts.length >= 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700">Compare Drafts</h4>
                <button
                  onClick={() => setCompareMode(false)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {channelDrafts.slice(0, 2).map((draft, idx) => (
                  <div
                    key={draft.id}
                    className={`bg-white border rounded-xl p-4 space-y-2 ${
                      compareDraftId === draft.id
                        ? 'border-indigo-400 ring-2 ring-indigo-100'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg ${getStatusBadge(draft.status)}`}>
                        {getStatusLabel(draft.status)}
                      </span>
                      <button
                        onClick={() => {
                          setActiveDraftId(draft.id);
                          setSubjectInput(draft.subject || '');
                          setBodyInput(draft.body || '');
                          setCompareMode(false);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                      >
                        Edit
                      </button>
                    </div>
                    {draft.subject && (
                      <p className="text-xs font-bold text-slate-900">{draft.subject}</p>
                    )}
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {draft.body}
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      {draft.createdAt ? new Date(draft.createdAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
              {channelDrafts.length > 2 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[10px] font-bold">
                  Showing the 2 most recent drafts. {channelDrafts.length - 2} more draft(s) available in the sidebar.
                </div>
              )}
            </div>
          )}
```

This uses `getStatusLabel` from plan 020. If plan 020 hasn't been applied, use `draft.status` directly instead of `getStatusLabel(draft.status)`.

**Verify**: `npx tsc --noEmit` → exit 0

## Test plan

- This is a pure UI enhancement — no new test files needed.
- All existing tests must continue to pass.
- Verification: `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass
- Manual verification checklist (run the app and check each):
  1. Word/character count appears below the body textarea and updates live
  2. Preview toggle shows rendered content with subject line header for EMAIL
  3. Switching channels no longer clears the custom prompt textarea
  4. Ctrl+S / Cmd+S triggers save when a DRAFT draft is active
  5. Auto-save runs before approval attempt (edits are saved first)
  6. Body textarea auto-resizes as content grows
  7. Compare button appears when 2+ drafts exist for the channel
  8. Compare view shows two drafts side by side

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx tsx --test src/db/__tests__/outreach.integration.test.ts` exits 0
- [ ] `npx tsx --test src/db/__tests__/outreach.actions.test.ts` exits 0
- [ ] Word and character count displayed below body textarea
- [ ] Preview mode renders content with subject-line header for EMAIL
- [ ] Custom prompt is NOT cleared on channel switch
- [ ] Ctrl+S / Cmd+S saves the draft
- [ ] Body textarea auto-resizes (no `rows={10}`, uses `ref` pattern)
- [ ] Approve action auto-saves pending edits before recording approval
- [ ] Compare mode available when 2+ drafts exist
- [ ] Compare mode shows two drafts side by side with Edit button
- [ ] No files outside `OutreachAssistant.tsx` are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The code excerpts above don't match the actual file contents.
- `useRef` is not available in the React import (add it).
- Any step causes a TypeScript error that can't be fixed with a simple type annotation.
- Step 5 (auto-save) references `showToast` but plan 019 hasn't been applied — in that case, use `setErrorMsg` for error display and skip the success toast.
- Step 7 references `getStatusLabel` but plan 020 hasn't been applied — use `draft.status` directly.

## Maintenance notes

- The compare mode only shows the 2 most recent drafts. If the user has more, a banner points them to the sidebar. If the product needs full N-way comparison later, this can be extended.
- The auto-save before approval (Step 5) uses `updateDraftAction` which returns `{ success: true }` or `{ error: string }`. If the action signature changes, update this call.
- Keyboard shortcuts use `useRef` to avoid stale closure issues. Any new shortcut handler should follow the same ref pattern.
- The preview mode is a simple `whitespace-pre-wrap` render. If markdown rendering is needed (for formatted output), import `ReactMarkdown` from `react-markdown` (already in package.json) and render content with it instead.
