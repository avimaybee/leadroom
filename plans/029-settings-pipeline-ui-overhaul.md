# [029] Settings / Pipeline Page UI Overhaul

**Category:** UI / UX
**Effort:** M
**Impact:** Transforms the most bare-bones page in the app into a polished settings experience consistent with the rest of the dashboard.

## Context

`src/app/(dashboard)/settings/pipeline/page.tsx` (57 lines) is the least polished page in the app. It renders a flat list of 10 pipeline stages, each with an unstyled `<input type="number">` and a separate `<form>` with its own Save button. Key problems:

1. **10 separate forms** — user must click Save 10 times to configure all stages. No "Save All" button.
2. **Unstyled inputs** — raw HTML inputs, no design-system consistency with the rest of the app.
3. **No visual feedback** — no save confirmation, no loading indicator, no error state.
4. **No differentiation** — default values look identical to custom values; no visual cue for which stages are non-default.
5. **Console action instead of server action import** — the form action is an inline `'use server'` async function, inconsistent with the rest of the app which imports server actions from `@/app/actions/`.
6. **Naming mismatch** — page title says "Preferences", which is also the sidebar label, but the URL is `/settings/pipeline`. This was already changed from "Pipeline Settings" but the page content hasn't caught up.
7. **Padding doubled** — uses `p-6 max-w-2xl mx-auto` while other settings pages let the dashboard layout handle it.
8. **No description per stage** — the subtitle "Alert after X days of inactivity" is auto-generated from the current value, but there's no explanation of what staleness means or how the feed uses it.
9. **No "reset to default"** — if a user changes a value and forgets the original, they can't revert.
10. **Desktop-only layout** — no consideration for smaller screens.

## Done Criteria

- All 10 stages are editable in a single form with a single "Save Changes" button (or auto-save with debounce).
- Input controls use the app's design system (consistent border, radius, focus ring, sizing).
- Save button shows loading state, success toast, and error toast.
- Stages with non-default values are visually distinct (e.g., accent dot or badge).
- Each stage row shows a clear description of what the threshold controls.
- "Reset to default" option per stage.
- No double padding — page fits the dashboard layout seamlessly.
- Mobile-responsive layout.
- No inline `'use server'` function — uses the imported `updateStageThreshold` action.
- TypeScript compiles cleanly.

## Design Direction

Use a single card with a clean form pattern, similar to the integrations page styling. Each stage is a row with:
- Stage name (bold, left-aligned)
- Description text (what staleness means for this stage)
- Number input + days label
- Reset-to-default icon button
- Visual indicator if non-default

A single "Save Changes" button at the bottom (or top + bottom for long scrolls).

## Steps

### 1. Split into client/server components

Keep the server component as a thin shell that fetches thresholds and wraps a new client component:

**`page.tsx`** — server component (async):
- Fetch thresholds from DB.
- Pass `initialThresholds` and `stages` to a new `PipelineSettingsForm` client component.

**`PipelineSettingsForm.tsx`** — new client component:
- Receives `initialThresholds: Record<string, number>` and `stages: string[]`.
- Manages form state locally.
- Handles save via server action.

### 2. Build the form UI

- Render stages in a single `<form>` with one submit button.
- Each row: `<div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">` (same card style as existing).
- Left side: stage name + description.
- Right side: number input + "days" label + reset button.
- Non-default stages: show a small primary-colored dot or "Modified" badge.

### 3. Implement save logic

- On submit: iterate all stages, call `updateStageThreshold(stage, days)` for each changed value only.
- Show `toast.success('Pipeline preferences saved')` on success.
- Show `toast.error('Failed to save: ...')` on failure.
- Disable the button and show a spinner while saving.

### 4. Polish

- Replace the page wrapper `p-6 max-w-2xl mx-auto` with a standard section layout (match `settings/integrations/page.tsx` structure).
- Update page title if needed — confirm "Preferences" is the correct label.
- Add a back link or breadcrumb to navigate between settings pages.
- Add responsive stacking for narrow screens (rows switch to vertical layout).

### 5. Clean up

- Remove the inline `'use server'` function from the old server component.
- Delete any unused imports.
- Run `npm run build` to verify.

## Files to Create

- `src/app/(dashboard)/settings/pipeline/PipelineSettingsForm.tsx`

## Files to Modify

- `src/app/(dashboard)/settings/pipeline/page.tsx`

## Not in Scope

- Changing the pipeline stage model itself (10 stages remain as-is).
- Adding per-stage notification channels or custom alerts.
- Moving this to a multi-tab settings page (keeping it standalone for now).

## Verification

- Navigate to /settings/pipeline after deploy.
- Confirm all 10 stages render with their current DB values.
- Change a value, click Save, see success toast, reload the page — value persists.
- Change a value, click reset — value reverts to default (5).
- Confirm non-default stages are visually distinct.
- Confirm page works on a narrow viewport (≤640px).
- Run `npm run build` — zero TypeScript errors.

## Escape Hatches

- If the threshold table schema has changed or `updateStageThreshold` signature differs, stop and report drift.
- If the design feels too heavy for a simple list, simplify to a polished but flat list (skip the single-form approach and keep per-row saves but with styled controls and toasts).
