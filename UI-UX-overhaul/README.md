# Leadroom UI/UX Overhaul

This folder is the implementation contract for the application-wide UI/UX/IA overhaul. `UI-UX-overhaul` is the filesystem-safe form of the requested “UI/UX overhaul” folder name.

## Read order

1. `APPLICATION-PLAN.md` — authoritative page priority order, rollout sequence, and cross-page dependencies.
2. `FOUNDATIONS.md` — shared design system, IA rules, interaction rules, and shadcn-first component strategy.
3. `LEAD-DETAIL-IA.md` — target information architecture for `/leads/[id]`.
4. `PLAN.md` — detailed execution plan for the first lead-detail overhaul.
5. `OUTREACH-ASSISTANT.md` — detailed redesign for the lead-detail Outreach workspace.
6. `NOTES-ACTIVITY.md` — detailed redesign for lead-detail activity capture and timeline.
7. Page briefs in the exact order listed in `APPLICATION-PLAN.md`.
8. `QUALITY-GATES.md` — cross-page accessibility, responsive, interaction, and visual acceptance matrix.

## Scope

- Main pages only: dashboard, leads list, lead creation, lead detail, campaigns list, campaign creation, campaign detail, preferences, integrations, and login.
- `/discovery` is only a redirect to `/scopes`; it does not need a standalone redesign plan.
- Research, Audit, Outreach, and Activity are not separate routes today. They remain sub-workspaces of the lead-detail page and are covered by the lead-detail documents.

## Authority

- `AGENTS.md`, `docs/PRD.md`, `docs/PLAN.md`, and `docs/ARCHITECTURE.md` remain authoritative for product and architecture.
- These overhaul docs are authoritative for page structure, interaction patterns, visual consistency, and execution order unless they conflict with those higher-level documents.
- This package does not authorize business-rule changes, database changes, AI prompt changes, automatic outbound messaging, or stage-model changes.

## Operating rule for executors

- Use the same calm internal-ops visual language across every page.
- Prefer shadcn primitives and composition over bespoke widgets.
- Do not redesign each page in isolation. Shell, spacing, tables, empty states, forms, filters, drawers, dialogs, badges, and action bars must behave consistently across the app.
- Preserve existing human-in-the-loop boundaries everywhere.

## Ranked page set

1. Lead detail workspace
2. Leads list
3. Dashboard
4. Campaign detail workspace
5. Campaigns list
6. Campaign creation
7. New lead
8. Preferences
9. Integrations
10. Login

The ranking reflects operator frequency, workflow centrality, and stage-first product value, not visual novelty.
