# Plan 014: Fix useState misuse and add useEffect sync in OutreachAssistant

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

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

`useState` is being misused as a side-effect-on-mount mechanism. The code at lines 172-178 of `OutreachAssistant.tsx` passes a function to `useState()` which React treats as a **lazy initializer** — it runs exactly once on mount and its return value is discarded (since it returns `undefined`). It does NOT re-run when `activeDraft` changes. This means the subject/body input fields don't sync when the active draft changes via fallback logic (line 48), only when the user explicitly clicks a draft via `handleSelectDraft`. The dead code is confusing to maintainers and the fallback path is subtly broken.

## Current state

- The relevant file: `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx` — the main outreach UI component (710 lines).
- The broken code at lines 172-178:
```tsx
  // Sync inputs when active draft changes
  useState(() => {
    if (activeDraft) {
      setSubjectInput(activeDraft.subject || '');
      setBodyInput(activeDraft.body || '');
      setFeedbackInput('');
    }
  });
```
- `handleSelectDraft` at line 226 already correctly updates `subjectInput`/`bodyInput` for explicit clicks.
- `handleChannelChange` at line 180 also correctly syncs.
- **Convention**: This component uses `'use client'` and imports from `react` (useState, useEffect already imported at line 3).

## Commands you will need

| Purpose   | Command                                    | Expected on success |
|-----------|--------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                         | exit 0, no errors   |
| Build     | `npx next build 2>&1 \| Select-Object -First 30` | no errors   |

## Scope

**In scope** (the only file you should modify):
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`

**Out of scope** (do NOT touch):
- `src/app/actions/outreach.ts`
- `src/services/outreach.ts`
- Any other file

## Git workflow

- Branch: `advisor/014-fix-usestate-misuse`
- Commit message: `fix(outreach): replace useState misuse with useEffect for draft sync`

## Steps

### Step 1: Replace the misused useState with a useEffect

Open `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`.

Find this exact code block (lines 171-178):
```tsx
  // Sync inputs when active draft changes
  useState(() => {
    if (activeDraft) {
      setSubjectInput(activeDraft.subject || '');
      setBodyInput(activeDraft.body || '');
      setFeedbackInput('');
    }
  });
```

Replace it with:
```tsx
  // Sync inputs when active draft changes (e.g. fallback selection after channel switch)
  useEffect(() => {
    if (activeDraft) {
      setSubjectInput(activeDraft.subject || '');
      setBodyInput(activeDraft.body || '');
      setFeedbackInput('');
    }
  }, [activeDraft?.id]);
```

Note: `useEffect` is already imported at line 3 (`import { useState, useEffect } from 'react';`), so no new import is needed.

**Verify**: `npx tsc --noEmit` → exit 0

## Test plan

- **Manual verification**: Open a lead detail page with multiple outreach drafts. Switch between channels. Verify that the subject/body fields correctly populate with the latest draft for each channel, including the fallback case where no explicit click happens.
- **Automated**: No new test file needed — this is a React rendering fix, not business logic.
- Verification: `npx tsc --noEmit` → exit 0

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] The `useState(() => { ... })` pattern at lines 172-178 is replaced with `useEffect`
- [ ] No other files are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- `useEffect` is not already imported from 'react' in this file.
- The `useState` block at lines 172-178 doesn't match the excerpt above (drift).
- The fix causes new TypeScript errors.

## Maintenance notes

- This fix is small and self-contained. The `handleSelectDraft` and `handleChannelChange` functions already handle the main interactive paths. This `useEffect` covers the edge case where `activeDraft` changes via the fallback derivation at line 48.
