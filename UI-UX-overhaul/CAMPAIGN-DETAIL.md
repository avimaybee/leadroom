# Campaign Detail Plan

## Priority

- Rank: 4
- Route: `/scopes/[id]`
- Role: discovery review and candidate-to-lead promotion workspace

## Current issues

- The page is overloaded with tabs, collapsible sections, inline progress, candidate cards, run history, rename controls, and modals.
- Core candidate-review work competes with crawler diagnostics and campaign metadata.
- The page feels like an operational log plus a review queue plus a setup page at once.
- Important actions are present, but the visual hierarchy makes the workflow harder than it should be.

## Main user question

Which candidates from this campaign should become real leads?

## Target user flow

1. Land on the campaign and understand scan state, review backlog, and campaign intent.
2. Review pending candidates in a stable queue ordered by triage usefulness.
3. Promote or discard efficiently.
4. Access discovery history and campaign configuration without polluting the main review surface.

## IA and layout

- Header with campaign identity, short spec summary, and one primary action based on state:
  - `Find more leads` when idle
  - `View running scan` or `Cancel scan` when active
- Sub-workspace navigation:
  - `Review`
  - `Promoted`
  - `Discarded`
  - `Run history`
- `Review` is the default and must dominate the page.
- Campaign specifications and rename move into a `Sheet`, not a permanent page block.

## Shadcn composition

- linked tabs or `Tabs` for sub-workspaces
- `Sheet` for campaign specifications and rename
- `Dialog` for manual candidate add
- `AlertDialog` for bulk discard
- `Card` for candidate rows only where table layout is not viable
- `Badge` for triage status and review state

## Key redesign decisions

- Separate candidate review from crawl history and campaign metadata.
- Replace long mixed-content scrolling with focused workspace sections.
- Keep scan progress compact at the top when active, with detailed history in its own destination.
- Preserve manual candidate creation and credit-protection warnings, but move them into cleaner overlays.
- Reduce color noise in candidate cards; use structure and ordering more than chromatic emphasis.

## Implementation steps

1. Split the page into stable sub-workspaces.
2. Move campaign settings and discovery history out of the main candidate review column.
3. Recompose candidate rows for faster promote/discard decisions.
4. Align actions, empty states, and job-state patterns with the lead-detail redesign.

## Acceptance criteria

- Pending review is the obvious default task.
- Active scans are visible without drowning the page.
- Campaign metadata is accessible without permanently occupying the main reading path.
- Candidate promotion feels faster and less visually exhausting.
