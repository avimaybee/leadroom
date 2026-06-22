# New Lead Plan

## Priority

- Rank: 7
- Route: `/leads/new`
- Role: manual lead intake

## Current issues

- The page is serviceable but generic.
- The form reads as a flat field list rather than an intentional intake workflow.
- Stage selection and source/campaign context need clearer framing.

## Main user question

How do I add a usable lead quickly without overfilling the form?

## Target user flow

1. Enter the minimum viable identity and contact information.
2. Add optional context only if known.
3. Set the initial stage deliberately.
4. Save and move into the lead workspace.

## IA and layout

- Guided form grouped into:
  - business identity
  - contact paths
  - market context
  - pipeline context
- Supporting copy should clarify what is optional and what can be edited later.

## Shadcn composition

- standardized field layout
- `Alert` for submission errors
- `Select` or `ToggleGroup` for initial stage if feasible
- sticky or clearly separated action footer

## Key redesign decisions

- Reduce cognitive load by grouping fields into meaningful chunks.
- Make optionality explicit.
- Keep the primary action singular: `Create lead`.
- Preserve manual speed; do not bloat the form with discovery-era metadata.

## Acceptance criteria

- The form feels faster and clearer than a generic admin form.
- The operator can complete a manual lead quickly with partial data.
- The page inherits the same page-header and form-spacing language as campaign creation.
