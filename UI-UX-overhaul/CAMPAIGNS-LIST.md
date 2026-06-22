# Campaigns List Plan

## Priority

- Rank: 5
- Route: `/scopes`
- Role: portfolio view for discovery campaigns

## Current issues

- The card grid is better than some other pages, but it is still too decorative relative to the actual management job.
- Status is summarized, but cross-campaign prioritization is weak.
- The page does not strongly distinguish campaigns needing review from campaigns that are complete or inactive.

## Main user question

Which campaign needs review, rerun, or attention?

## Target user flow

1. Open the campaign portfolio and quickly identify campaigns with pending candidates or incomplete review.
2. Open the right campaign workspace.
3. Start a new campaign only after understanding current backlog.

## IA and layout

- Header with concise summary and `New campaign` primary action.
- Optional top summary strip: active campaigns, campaigns with pending review, campaigns with zero candidates.
- Main content can stay card-based, but the cards must behave like operational records, not marketing tiles.

## Shadcn composition

- `Card` for campaign records
- `Badge` for review status
- `Empty` for zero-state
- `DropdownMenu` for secondary campaign actions if later needed

## Key redesign decisions

- Promote pending-review state to the strongest visual cue.
- Make each card show:
  - campaign name
  - targeting summary
  - pending review count
  - total candidates
  - last run or creation date
  - clear entry action
- Reduce decorative hover treatment and improve compact scanability.

## Acceptance criteria

- The operator can distinguish active review work from dormant campaigns immediately.
- Card density remains readable at scale.
- The page visually matches the same shell and summary language as dashboard and leads.
