# Lead Detail Information Architecture

## Primary operator questions

The page must answer these questions in order:

1. Which lead am I viewing?
2. What is its pipeline state?
3. What should I do next?
4. What evidence supports that action?
5. What work has already happened?
6. How do I perform the next action without losing context?

The current layout answers all 6 simultaneously with nested cards, accordions, tabs, and scroll regions. The redesign uses progressive disclosure and one dominant task per view.

## Page-level model

```text
Breadcrumb
Lead identity header                         Stage action
Name · location · industry · primary contact
Next-action strip: recommendation · due state · primary CTA

Overview | Research | Audit | Outreach | Activity
--------------------------------------------------
Active workspace content
```

The selected workspace is URL-addressable, for example `?view=overview`, `?view=outreach&channel=email`. Back/forward navigation and shared links must preserve workspace state.

## Global header rules

- Breadcrumb: `Leads / {Lead name}`; do not use a decorative “Back to Leads” line above a second header block.
- One `h1`: lead name. Long names wrap safely; they never push actions off-screen.
- Metadata row: location, industry, website domain, and primary contact when available. Missing values are omitted rather than rendered as empty labels.
- Stage appears once as a clearly labeled action (`Change stage: Drafting`), not both a badge and an unlabeled native select.
- Remove the priority score badge and Priority Score Driver Breakdown from the header/rail. Audit findings and transparent scoring belong in Audit.
- The header is not sticky. The workspace navigation may become sticky below the app header if it does not create a second scroll container.

## Stable navigation

Use 5 destinations because they map to distinct operator jobs:

| View | Operator job | Default content |
|---|---|---|
| Overview | Orient and choose the next action | next action, lead summary, contacts, open tasks, recent interactions |
| Research | Verify what is known | research snapshot, sources, confidence/freshness, edit/re-run state |
| Audit | Evaluate opportunity evidence | audit findings, opportunity hypotheses, scoring rationale if retained |
| Outreach | Prepare and review contact material | channel-specific draft workspace |
| Activity | Capture and reconstruct history | quick note composer and interaction timeline |

Do not nest another primary tab bar directly below these tabs. Within a view, use segmented controls only for 2–4 mutually exclusive peers, such as outreach channels.

## Overview composition

Desktop uses a 12-column grid inside a centered container with a practical maximum width of 1440 px:

- Main column: 8 spans.
- Supporting column: 4 spans.
- Gap: 24–32 px.
- No child column uses `max-height` plus `overflow-y-auto`.

Main column order:

1. Next action: one recommendation, reason, due state, one primary CTA.
2. Lead summary: high-value business fields in a flat description layout.
3. Open tasks: overdue first, then upcoming; maximum 5 before “View all”.
4. Recent interactions: latest 3 meaningful items with “View activity”.

Supporting column order:

1. Contacts: primary contact first, explicit empty state and `Add contact` action.
2. Opportunity snapshot: 2–3 evidence-linked findings from research/audit; no raw score-driver visualization.
3. Lead controls: edit lead, archive, and other infrequent record operations.

Avoid cards within cards. A surface may contain rows, dividers, or grouped fields; it must not contain another fully bordered/elevated card unless it is an overlay.

## Choice reduction and heuristics

- Hick–Hyman: keep top-level choices stable and limited; move infrequent actions into contextual menus or dialogs. Do not hide primary jobs inside generic accordions.
- Recognition over recall: label navigation by operator job and show current state, unsaved state, evidence source, and next action visibly.
- Jakob’s Law: tabs behave like tabs, links like links, buttons like actions, and destructive actions use confirmation or undo.
- Fitts’s Law: frequent primary targets have at least 44 px effective height and stay near the work they affect.
- Proximity/Common Region: group controls with the object they modify. Do not place approval, generation, and lead-context actions in separate distant cards.
- Tesler’s Law: preserve necessary workflow complexity, but assign it to progressive steps rather than exposing every control simultaneously.
- Doherty Threshold: local actions provide feedback immediately; long AI/research operations show persistent status, cancellation where supported, and recovery guidance.
- Nielsen heuristics: visible system status, user control, consistent language, error prevention, recognition, and recoverable actions take priority over decorative polish.

## Responsive model

### ≥1280 px

- 8/4 overview grid.
- Outreach may use editor plus 320–360 px evidence inspector.
- Page scroll only.

### 768–1279 px

- Single content column.
- Contacts and supporting sections move after the main work.
- Outreach evidence opens as a right sheet or inline panel; never squeeze the editor below a readable width.

### <768 px

- App sidebar uses its existing mobile pattern or is out of this plan.
- Lead header stacks; stage action is full-width or clearly reachable.
- Workspace navigation is horizontally scrollable with visible overflow cue, or uses a compact accessible navigation menu if all labels cannot fit.
- Outreach channels use a 2×2 control or horizontal scroll; editor actions become a stable bottom action area without covering fields.
- No horizontal page overflow at 320 px.

## Empty, loading, error, and long-content requirements

Every section must define:

- empty state with one relevant action;
- loading/skeleton state without layout shift;
- inline recoverable error with a next step;
- partial-data behavior;
- long names, URLs, emails, notes, tasks, and generated text;
- permissions/disabled state where applicable.

No empty state should contain both a header button and a second duplicate CTA inside the empty-state card.

