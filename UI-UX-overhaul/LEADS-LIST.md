# Leads List Plan

## Priority

- Rank: 2
- Route: `/leads`
- Role: primary triage and pipeline management surface

## Current issues

- The table is functional but visually generic and operationally thin.
- Filtering is underpowered and visually secondary.
- Priority, stage, and campaign context exist, but they do not guide next action strongly enough.
- Actions are too limited for a page that should be the main control tower for active leads.

## Main user question

Which lead deserves attention next, and what should I do with it?

## Target user flow

1. Arrive on the page and immediately understand pipeline volume and current filter context.
2. Narrow by campaign, stage, urgency, or stale status without opening leads blindly.
3. Scan a compact but meaningful row structure that surfaces why a lead matters.
4. Open the chosen lead directly into the relevant workspace when needed.

## IA and layout

- Header with title, result summary, and one primary action: `New lead`.
- Filter/action bar beneath header using URL-synced controls.
- Desktop: dense table.
- Tablet/mobile: stacked lead cards with the same information hierarchy.
- Optional compact batch insight strip above the table for overdue, unassessed, and outreach-ready counts.

## Required columns or row zones

1. Lead identity: name, website or company, contact path
2. Campaign/source
3. Current stage
4. Priority and scoring rationale summary
5. Next action or stale indicator
6. Updated or next-follow-up date
7. Overflow actions

## Shadcn composition

- `Table` for desktop
- `ToggleGroup` for quick filters such as stage buckets
- `DropdownMenu` for row actions
- `Badge` for stage, score, stale states
- `Sheet` for advanced filters on smaller screens
- `Empty` for zero-result and zero-data states

## Key redesign decisions

- Add quick filters for `All`, `Needs research`, `Needs audit`, `Drafting`, `Follow-up due`, `Stale`.
- Replace archive-only row actions with a small but focused action set: open lead, open outreach, open activity, archive.
- Make stale or overdue follow-up status visible at row level.
- Preserve campaign filter but make it part of a broader filter model, not a lone control.
- Keep rows scannable; do not add decorative cards or wide paragraph cells.

## Implementation steps

1. Define the target filter model and URL parameter scheme.
2. Redesign the header and filter bar.
3. Recompose the table row hierarchy and supporting mobile card layout.
4. Add next-action and stale-state summaries without changing lead business logic.
5. Verify empty, filtered-empty, long-name, missing-email, and missing-score states.

## Acceptance criteria

- The page clearly communicates what subset of leads the operator is seeing.
- The operator can isolate action-worthy leads in one or two interactions.
- Stage, priority, and next action can be read without opening every lead.
- Mobile does not fall back to a horizontally broken table.
