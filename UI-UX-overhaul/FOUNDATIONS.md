# Foundations

## Design direction

Leadroom should look like a focused operating console for a small agency, not a startup landing page and not a bloated CRM. The visual goal is quiet authority: warm neutrals, restrained accent usage, strong typography hierarchy, honest status colors, and dense but breathable spacing.

## Core UI laws and heuristics

- Hick's Law: reduce visible choices at each decision point. Show one primary action, keep secondary actions in menus or overlays, and avoid multiple competing control bars.
- Miller's Law: chunk information into a few stable groups. Do not present long accordion stacks or giant mixed cards.
- Progressive disclosure: advanced controls, raw diagnostics, and destructive actions stay behind drawers, sheets, menus, or dialogs.
- Fitts's Law: critical actions need stable placement and large enough targets, especially stage changes, approve/reject, promote/discard, and save.
- Jakob's Law: reuse familiar patterns across pages. The user should not relearn filters, table actions, or empty states per screen.
- Tesler's Law: keep irreducible complexity in the right place. Outreach is complex, but the page must still center the primary task instead of exposing every branch at once.
- Gestalt proximity and similarity: related metadata, actions, and statuses should be grouped consistently; stop mixing controls and information in the same visual weight.

## App shell rules

1. Use one global dashboard shell with a stable sidebar, top utility bar, and page content area.
2. Every page starts with:
   - breadcrumb or back link where needed
   - page title
   - single-sentence page purpose or current-state summary
   - primary action area aligned right on desktop, stacked below on mobile
3. Page content should fit one of two patterns:
   - list workspace
   - detail workspace
4. Do not let the shell content area create visual clipping through fixed-height nested panels.

## Page anatomy

### List workspace

- Header
- Filter/action bar
- Primary list or cards
- Optional secondary insight rail below or beside, never as a competing first read

### Detail workspace

- Back link or breadcrumb
- Identity/status header
- Sub-workspace navigation if needed
- Main content area
- Secondary contextual panels only when they support the active task

## Interaction rules

1. URL-sync any primary page tab, filter, or mode that should survive refresh or be shareable.
2. Use drawers or sheets for supporting tasks that currently create vertical clutter:
   - generation forms
   - compare views
   - history/version browsing
   - technical details
3. Use dialogs or alert dialogs for:
   - approvals
   - destructive actions
   - short confirmation flows
4. Inline editing is allowed only when the state change is local, reversible, and obvious.
5. Permanent inline warnings are allowed only for persistent risk states. One-time alerts should not become permanent page furniture.

## Data-density rules

- Prefer fewer, larger layout groups over many tiny cards.
- Avoid card-inside-card composition unless a nested unit has its own separate action boundary.
- Show the most decision-relevant fields first.
- Hide low-value metadata until expansion or hover only if the workflow does not depend on it.
- Use truncation only when the full value is accessible nearby.

## Status system

- Pipeline stage appears once per page header or row, not repeated in multiple badges.
- Async work gets one compact status indicator plus one detailed view where the operator can inspect progress or failure.
- Approval state and sent state must stay separate.
- Score, confidence, and quality labels should remain explainable and subordinate to evidence.

## Shadcn component mapping

| Need | Default primitive |
|---|---|
| Global nav | `Sidebar` patterns already present in app shell |
| Section switching | `Tabs` or linked tab-like nav |
| Dense content groups | `Card` with full composition |
| Structured records | `Table` for desktop, stacked cards for mobile |
| Filters with 2-7 options | `ToggleGroup` |
| Long secondary forms | `Sheet` |
| Mobile-first bottom action overlay | `Drawer` |
| Confirmation/destructive gate | `AlertDialog` |
| Overflow actions | `DropdownMenu` |
| Inline system warnings | `Alert` |
| Empty result states | `Empty` |
| Loading placeholders | `Skeleton` |
| State labels | `Badge` |

## Anti-patterns to remove

- nested independent scrollbars
- long accordion stacks for core workflows
- duplicate state badges and controls
- pages that combine editor, version history, review form, diagnostics, and generation form in one uninterrupted column
- raw dropdown overload for small choice sets
- permanent low-value cards consuming vertical space
- overuse of tiny badges as substitutes for actual structure
- ad hoc page-specific color logic

## Acceptance standard

A page is aligned only if a first-time operator can answer the page's main question within a few seconds, identify the next action without scanning the whole screen, and complete the core action without fighting stacked controls or clipped content.
