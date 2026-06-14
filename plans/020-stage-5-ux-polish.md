# Plan 020: Stage 5 UX polish — visual refinements, labels, badges, and readability

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3ea78d2..HEAD -- src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx, ui
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

The Outreach Assistant UI has several visual rough edges that degrade the operator experience: the body textarea uses a monospace font (making prose harder to read), status labels display raw database values ("DRAFT", "APPROVED"), small font sizes (`text-[10px]`, `text-[9px]`) hurt legibility, button styles are visually inconsistent with the rest of the app, the `origin` field exists in the data model but is never shown to the user, and the "Create New Draft" vs "Generate AI Draft" button labels are confusingly different for the same action. Fixing these makes the tool feel polished and professional.

## Current state

### Monospace font on body textarea (line 552)
```tsx
<textarea
  id="body-input"
  rows={10}
  value={bodyInput}
  onChange={(e) => setBodyInput(e.target.value)}
  disabled={activeDraft.status !== 'DRAFT'}
  className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-4 focus:bg-white focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 leading-relaxed font-mono"
/>
```
Note the `font-mono` class — the textarea uses a monospace font. For writing prose content (outreach emails, call scripts), a proportional sans-serif font is more natural and readable.

### Extremely small font sizes used throughout:
- Line 122: `text-[10px]` for "Attachments (Images/PDFs)" label
- Line 125: `text-[9px] text-slate-400` for model info line
- Line 474: `text-[10px]` for status badge
- Line 477: `text-[10px]` for "Last updated" text
- Line 532: `text-[10px]` for form labels ("Subject", "Message Body")
- Line 558: `text-[10px]` for "Attached Files" label
- Lines 684-685: `text-[8px]` for status badges in sidebar
- Line 689: `text-[9px]` for date in sidebar

### Raw status labels in all-caps (line 475)
```tsx
<span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg ${getStatusBadge(activeDraft.status)}`}>
  {activeDraft.status}
</span>
```
This displays "DRAFT", "APPROVED", "REJECTED", "SENT" — database values, not user-facing labels.

### Status badge colors (lines 342-353)
```tsx
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'APPROVED': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'REJECTED': return 'bg-rose-50 text-rose-700 border border-rose-200';
    case 'SENT':     return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    default:         return 'bg-amber-50 text-amber-700 border border-amber-200';
  }
};
```

### Sidebar draft items (lines 670-692) — no origin badge, no rejection reason
```tsx
<button key={d.id} onClick={() => handleSelectDraft(d)}
  className={`w-full text-left p-3 rounded-xl border text-xs transition duration-150 ${
    activeDraftId === d.id
      ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-50'
      : 'bg-white hover:bg-slate-50 border-slate-200/80'
  }`}
>
  <div className="flex items-center justify-between gap-2">
    <span className="font-bold text-slate-800 truncate">
      {d.subject || `${d.channel} Draft`}
    </span>
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${getStatusBadge(d.status)}`}>
      {d.status}
    </span>
  </div>
  <p className="text-[9px] text-slate-400 font-semibold mt-1">
    {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'N/A'}
  </p>
</button>
```
No origin badge (AI_GENERATED vs MANUAL) and no rejection feedback summary shown.

### Button color inconsistency — different visual weights
- "Generate AI Draft" (line 455): `bg-indigo-600 hover:bg-indigo-700` — strong primary color
- "Save Edits" (line 585): `bg-slate-800 hover:bg-slate-900` — dark neutral
- "Reject" (line 644): `bg-rose-50 text-rose-700` — ghost/outline style
- "Approve" (line 651): `bg-emerald-600 hover:bg-emerald-700` — green primary
- "Mark as Sent" (line 520): `bg-indigo-600` — same as Generate, different purpose
- "Duplicate & Edit" (line 597): `bg-indigo-600` — same as Generate
- "Regenerate" (line 486): `text-slate-500 hover:text-indigo-600` — ghost style
- Sidebar "Create New Draft" (line 707): `bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200` — very subtle

The inconsistency: "Save Edits" uses a different primary color (`slate-800`) than every other primary action (`indigo-600`). This makes the save button look less important than generation buttons, even though saving is the most frequent action.

### Duplicate button labels for same action
- Line 466: `'Generate AI Draft'` — in empty state
- Line 501: `'Regenerate'` — when a draft exists
- Line 612: `'Duplicate & Edit'` — for rejected drafts
- Line 709: `'Create New Draft'` — in sidebar
All four call the same `handleGenerate` function. The inconsistent labels confuse users about whether "Create New Draft" differs from "Generate AI Draft".

### Repo conventions
- This project uses Tailwind CSS v4 with the default color palette.
- Badge pattern: `text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg` with semantic color variants.
- Button pattern: `text-xs font-bold px-4 py-2.5 rounded-xl` for primary.
- The rest of the app (ClientResearchView, ClientAuditView, etc.) uses `text-xs` (12px) as the minimum readable text size — only OutreachAssistant uses `text-[10px]` and `text-[9px]`.
- Card pattern: `bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm`.

## Commands you will need

| Purpose   | Command                                                       | Expected on success |
|-----------|---------------------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                                           | exit 0, no errors   |
| Tests     | `npx tsx --test src/db/__tests__/outreach.integration.test.ts`| all pass            |

## Scope

**In scope** (only file to modify):
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`

**Out of scope**:
- Other components (ClientResearchView, ClientAuditView, etc.) — even if they have similar font/size issues
- Server actions, service layer, or data model
- Adding new libraries or dependencies
- Modifying any test files
- The global CSS (`globals.css`)

## Git workflow

- Branch: `advisor/020-stage-5-ux-polish`
- No commits needed.

## Steps

### Step 1: Remove monospace font from body textarea

Open `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`. Find the `textarea` with `id="body-input"` (around line 552). Remove `font-mono` from its className. The className string should change from:

Old:
```
"w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-4 focus:bg-white focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 leading-relaxed font-mono"
```

New:
```
"w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-4 focus:bg-white focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 leading-relaxed"
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Replace raw status labels with human-readable labels

Find the `getStatusBadge` function (lines 342-353). Replace it with a function that also returns a human-readable label:

```tsx
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'REJECTED': return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'SENT':     return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      default:         return 'bg-amber-50 text-amber-700 border border-amber-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      case 'SENT':     return 'Sent';
      default:         return 'Draft';
    }
  };
```

Now find the two places that render the status text and replace `{activeDraft.status}` with `{getStatusLabel(activeDraft.status)}`:

1. Line 475: Change `{activeDraft.status}` to `{getStatusLabel(activeDraft.status)}`
2. Line 685 (sidebar): Change `{d.status}` to `{getStatusLabel(d.status)}`

Also keep the uppercase CSS class `uppercase` on the badge span to maintain visual consistency — the CSS `uppercase` combined with human labels ("Approved" → "APPROVED" visually) achieves the same look as the raw values.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Increase minimum font sizes throughout the component

Apply these font size changes to improve readability:

1. **Attachment section label** (line 122): Change `text-[10px]` to `text-xs`
2. **Model info text** (line 125): Change `text-[9px]` to `text-[10px]`
3. **Status badge text** (line 474): The badge already uses `text-[10px]` — keep it (this is consistent with other badges in the app)
4. **"Last updated" text** (line 477): Change `text-[10px]` to `text-xs`
5. **Form labels** ("Subject" at line 532, "Message Body" at line 545, "Attached Files" at line 558): Change `text-[10px]` to `text-xs`
6. **Sidebar status badges** (line 684): Change `text-[8px]` to `text-[10px]` and reduce `px-1.5 py-0.5` to `px-1.5 py-0.5` (keep as is)
7. **Sidebar date text** (line 689): Change `text-[9px]` to `text-[10px]`
8. **Decision section feedback label** (line 625): Change `text-[10px]` to `text-xs`
9. **Attached Files label in sidebar items**: Change `text-[9px]` (line 569) to `text-[10px]`

For each change, find the exact `className` string containing the size and replace just that token. Do NOT change any other properties of the className.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 4: Standardize primary button color

Find the "Save Edits" button (around line 582-589). Change its color classes from `bg-slate-800 hover:bg-slate-900 disabled:bg-slate-500` to `bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400`. Also change `shadow shadow-slate-950/10` to `shadow shadow-indigo-600/10`.

Old:
```tsx
<button
  onClick={handleSaveEdits}
  disabled={isSaving}
  className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow shadow-slate-950/10"
>
  {isSaving ? 'Saving...' : 'Save Edits'}
</button>
```

New:
```tsx
<button
  onClick={handleSaveEdits}
  disabled={isSaving}
  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow shadow-indigo-600/10"
>
  {isSaving ? 'Saving...' : 'Save Edits'}
</button>
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 5: Standardize "Create New Draft" button labels

Find the sidebar "Create New Draft" button (around line 704-710). Change its label from `'Create New Draft'` to `'Generate AI Draft'` so it matches the empty state button.

Old:
```tsx
{isGenerating ? 'Generating...' : 'Create New Draft'}
```

New:
```tsx
{isGenerating ? 'Generating...' : 'Generate AI Draft'}
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 6: Add origin badge to sidebar draft items

In the sidebar draft list (around line 670-692), add an origin badge next to the status. Find the status badge span (line 684):

```tsx
<span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${getStatusBadge(d.status)}`}>
  {getStatusLabel(d.status)}
</span>
```

Change to:
```tsx
<div className="flex items-center gap-1">
  {d.origin === 'MANUAL' && (
    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
      Manual
    </span>
  )}
  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${getStatusBadge(d.status)}`}>
    {getStatusLabel(d.status)}
  </span>
</div>
```

Note: After Step 3 changes `text-[8px]` to `text-[10px]` for the status badges, use the current size after that step. If Step 3 changed sidebar badges to `text-[10px]`, use `text-[10px]` for the origin badge too.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 7: Show rejection feedback in the sidebar

Modify the sidebar draft item to show a truncated feedback line when the draft has been rejected. The draft approval data is not in the draft object itself (it's in the approvals table), so instead, look for the `origin` and show the feedback if the status is REJECTED.

Actually, the rejection feedback is stored in the `approvals` table and is NOT available in the sidebar draft objects. The only way to show rejection reason inline is to either:
  (a) Join approvals data into the drafts query (out of scope — data model change), or
  (b) Add a one-line callout in the main editor panel when viewing a rejected draft.

For this plan, implement option (b): In the main draft editor area, when the active draft has status 'REJECTED', show the feedback inline. But since the feedback is not on the draft object, we need a different approach.

**Simpler approach**: In the sidebar, show a small indicator on rejected drafts. The feedback text itself can't be shown without a data model change, but we can add a visual cue. Find the sidebar date paragraph (line 688-690):

```tsx
<p className="text-[9px] text-slate-400 font-semibold mt-1">
  {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'N/A'}
</p>
```

Change to:
```tsx
<p className="text-[9px] text-slate-400 font-semibold mt-1">
  {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'N/A'}
  {d.status === 'REJECTED' && (
    <span className="text-rose-400 ml-1">(Rejected)</span>
  )}
</p>
```

After Step 3 changes `text-[9px]` to `text-[10px]`, use whichever size is current.

**Verify**: `npx tsc --noEmit` → exit 0

## Test plan

- This is a pure visual/UI change — no new tests needed.
- All existing tests must continue to pass.
- Verification: `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass (12+ tests)
- Manual verification: `npx tsc --noEmit` → exit 0

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx tsx --test src/db/__tests__/outreach.integration.test.ts` exits 0
- [ ] Body textarea uses proportional sans-serif font (no `font-mono`)
- [ ] Status badges display "Draft", "Approved", "Rejected", "Sent" — not raw DB values
- [ ] All `text-[9px]` and `text-[10px]` form labels are bumped to `text-xs` where appropriate (Step 3 list)
- [ ] "Save Edits" button uses indigo color (consistent with other primary buttons)
- [ ] Sidebar "Create New Draft" button now says "Generate AI Draft"
- [ ] Origin badge ("Manual") appears on duplicated drafts in the sidebar
- [ ] Rejected drafts show "(Rejected)" text in the sidebar
- [ ] No files outside `OutreachAssistant.tsx` are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The code excerpts above don't match the actual file contents.
- Any change causes a TypeScript error.
- A change accidentally removes or breaks a Tailwind class (verify by visually inspecting the component after each step).

## Maintenance notes

- The origin badge currently only shows "Manual" — AI_GENERATED is the default and is not shown (to avoid visual noise). If the product later needs to distinguish between the two, add a badge for AI_GENERATED as well.
- The rejection annotation in the sidebar only shows "(Rejected)" text, not the actual feedback. To show the feedback, a future plan should join the `approvals` table data into the `getDraftsForLead` service method.
- The `getStatusLabel` function should be updated if new status values are added in the future.
