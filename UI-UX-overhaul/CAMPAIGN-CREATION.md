# Campaign Creation Plan

## Status

- **Status**: Completed & Verified
- **Priority Rank**: 6
- **Route**: `/scopes/new`
- **Role**: Guided intake for repeatable discovery

## Current issues

- The page mixes setup, auth/session dependency, historical market hints, and launch logic in a single form stack.
- The market-metrics block can be useful, but it currently risks overshadowing the core setup flow.
- Native selects and ad hoc spacing break consistency with the intended modern shadcn-first system.

## Main user question

What campaign should I launch, and is the scope specific enough to avoid waste?

## Target user flow

1. Enter niche and location.
2. Review lightweight guidance or recommendations.
3. Choose a lead limit.
4. Launch the campaign with confidence about what will happen next.

## IA and layout

- Single-column guided form.
- `Campaign basics` section first.
- `Decision support` section second, shown only when useful.
- `Launch summary` footer showing generated campaign name and what the system will do after submission.

## Shadcn composition

- form layout using consistent shadcn field patterns
- `Alert` for credit, auth, or error states
- `Card` or `Alert` for market recommendations
- `Select` or `ToggleGroup` for limit choices depending on final component availability

## Key redesign decisions

- Treat recommendations as optional support, not as the headline of the page.
- Replace random-state fallback wording with a calmer explicit explanation.
- Make post-submit behavior obvious: create campaign, start discovery, route to workspace.
- Avoid making this page feel like a data science console.

## Acceptance criteria

- The operator understands required inputs and launch consequences before submitting.
- The metrics/recommendation block helps without hijacking the flow.
- Errors and session problems are explained clearly.
