---
plan_id: "008"
title: "Add ErrorBoundary for Audit & Research UI resilience"
status: "Pending"
priority: "Medium"
stage: "Stage 4"
---

# Plan 008: Add ErrorBoundary for Audit & Research UI resilience

## Problem Statement
In `AuditDisplay.tsx`, `score.factors` and `initialAudit.sources` are parsed unconditionally with `JSON.parse`. If the database ever holds malformed JSON, `JSON.parse` will throw synchronously during the render cycle, which causes a React crash. Since there's no Next.js `error.tsx` boundary defined for the `/leads/[id]` route segment, a single malformed lead audit takes down the whole page.

## File targets
- `src/app/(dashboard)/leads/[id]/components/audit/AuditDisplay.tsx`
- `src/app/(dashboard)/leads/[id]/components/research/ResearchDisplay.tsx`
- `src/app/(dashboard)/leads/[id]/error.tsx` (New)

## Step-by-step instructions
1. Open `src/app/(dashboard)/leads/[id]/components/audit/AuditDisplay.tsx`.
2. Wrap `JSON.parse(score.factors)` in a `try/catch` block. If parsing fails, fall back to an empty array `[]` and log a warning to the console.
3. Open `src/app/(dashboard)/leads/[id]/components/research/ResearchDisplay.tsx`.
4. Wrap `JSON.parse(initialSnapshot.sources)` in a `try/catch` block (it actually looks like this is already safely handled in `parseSources`, but double-check `ResearchEditForm.tsx` where similar parse logic occurs).
5. Create `src/app/(dashboard)/leads/[id]/error.tsx`.
6. Implement a standard Next.js error boundary component. It should receive `{ error: Error; reset: () => void }`.
7. Style the error state gracefully (using the app's Tailwind slate/indigo themes) offering a "Try again" (reset) button, so users can recover the UI without a full reload.

## Verification
- Temporarily mock `score.factors` to return an invalid string like `"{ bad json"` in `ClientAuditView`.
- Verify the page loads normally and doesn't crash, defaulting to 0 factors.
- Manually trigger an error in the Lead Details page and verify the custom `error.tsx` catches it.

## Drift check
Check `src/app/(dashboard)/leads/[id]/error.tsx`. If it already exists, verify that `try/catch` wrappers are present in `AuditDisplay.tsx`.
