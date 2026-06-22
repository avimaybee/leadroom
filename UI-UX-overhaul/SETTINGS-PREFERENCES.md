# Preferences Plan

## Priority

- Rank: 8
- Route: `/settings/pipeline`
- Role: pipeline rule administration

## Current issues

- The page is narrow and mostly functional, but it lacks the same intentional shell and admin clarity expected from the rest of the system.
- The sub-nav is page-local rather than feeling like part of a small settings workspace.
- Save semantics need to feel more explicit and less fragile.

## Main user question

What pipeline timing rules am I changing, and how risky is the change?

## Target user flow

1. Open settings and understand which section is active.
2. Review threshold rows and edit the intended values.
3. Save with confidence and understand whether changes are per-row or batch.

## IA and layout

- Settings workspace header shared with integrations.
- Left or top settings section switcher depending on available space.
- Main panel dedicated to the threshold table and supporting explanation.

## Shadcn composition

- `Tabs` or linked section nav for settings categories
- `Card` around the main settings table
- `Alert` for validation or save errors
- `Badge` or inline helper text for changed rows

## Key redesign decisions

- Establish one settings shell shared with integrations.
- Clarify save modes and changed-state visibility.
- Keep the page calm and dense, not flashy.

## Acceptance criteria

- Preferences and Integrations feel like two sections of one admin area.
- Save behavior is obvious.
- The page uses the same spacing and header grammar as the rest of the application.
