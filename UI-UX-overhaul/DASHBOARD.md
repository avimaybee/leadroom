# Dashboard Plan

## Priority

- Rank: 3
- Route: `/`
- Role: daily orientation and attention-routing surface

## Current issues

- The page is a collection of cards rather than a decision surface.
- Metrics and quick links exist, but the operator still has to decide where to go next with limited guidance.
- Pipeline distribution is visually present but not strongly connected to actionable subsets.
- The dashboard duplicates some list-level information without enough workflow intent.

## Main user question

What needs attention right now across the operating system?

## Target user flow

1. Open the dashboard and identify the highest-risk or highest-value work within seconds.
2. Jump directly into the right filtered list or workspace.
3. Review recent operational movement without losing focus.

## IA and layout

- Header with operational summary, not a marketing-style welcome.
- Top band of action-first summary cards:
  - follow-up due
  - leads needing research/audit
  - outreach-ready leads
  - pending campaign candidates
- Main body split:
  - left: attention queues and recent activity
  - right: pipeline health and shortcuts

## Shadcn composition

- `Card` for summary modules
- `Badge` for count severity
- `Table` or compact list for attention queues
- `Separator` to prevent card soup
- `Empty` when no urgent work exists

## Key redesign decisions

- Convert summary cards into navigational launch points with explicit destinations.
- Replace passive “quick start workflows” language with concrete action queues.
- Make pipeline distribution secondary to actionable lists.
- Surface recent activity only if it is useful for operational context, not as feed filler.

## Implementation steps

1. Define the top-priority queue model and corresponding links.
2. Recompose the dashboard into attention-first sections.
3. Align visual language with the redesigned leads list and lead detail header conventions.
4. Verify the dashboard stays useful with sparse or messy data.

## Acceptance criteria

- The operator can identify the top next action from the first viewport.
- Every dashboard card links to a real downstream workflow.
- The page remains useful even when metrics are incomplete or low-volume.
