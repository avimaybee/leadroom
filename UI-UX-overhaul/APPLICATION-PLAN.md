# Application Overhaul Plan

## Status

- **Status**: Completed & Verified (Wave 1, Wave 2, and Wave 3)
- **Scope**: All main application pages and routing surfaces
- **Verified on**: 2026-06-23
- **Design alignment**: 100% compliant with standard shadcn primitives, layout rules, and WAI-ARIA accessibility gates.

## Outcome

Leadroom becomes a consistent internal operating system rather than a set of visually unrelated screens. Every main page should share one shell language, one density model, one action hierarchy, and one predictable navigation pattern.

## Ranked page priority

| Rank | Surface | Why it comes first | Plan file |
|---|---|---|---|
| 1 | Lead detail workspace | Core operational spine; touches research, audit, outreach, notes, tasks, stage changes | `PLAN.md`, `LEAD-DETAIL-IA.md`, `OUTREACH-ASSISTANT.md`, `NOTES-ACTIVITY.md` |
| 2 | Leads list | Main triage and pipeline entry point; must steer attention cleanly | `LEADS-LIST.md` |
| 3 | Dashboard | Daily orientation and next-action surface | `DASHBOARD.md` |
| 4 | Campaign detail workspace | Discovery review, promotion, and scan control; currently overloaded and unstable | `CAMPAIGN-DETAIL.md` |
| 5 | Campaigns list | Campaign portfolio overview and entry point into discovery work | `CAMPAIGNS-LIST.md` |
| 6 | Campaign creation | Front door to repeatable intake; needs a guided, not noisy, flow | `CAMPAIGN-CREATION.md` |
| 7 | New lead | Important but narrower than discovery and live lead management | `NEW-LEAD.md` |
| 8 | Preferences | Admin surface for pipeline rules; should be clear and low-risk | `SETTINGS-PREFERENCES.md` |
| 9 | Integrations | Admin surface for provider setup; needs better trust and state visibility | `SETTINGS-INTEGRATIONS.md` |
| 10 | Login | Necessary, but least frequent and least workflow-central | `LOGIN.md` |

## Execution waves

### Wave 1 — Core operating loop

- Lead detail workspace
- Leads list
- Dashboard

This wave establishes the main daily loop: find the right lead, understand it quickly, decide the next action, and keep the pipeline moving.

### Wave 2 — Discovery discipline

- Campaign detail workspace
- Campaigns list
- Campaign creation

This wave makes intake and candidate review feel like a controlled workflow instead of a crawler console.

### Wave 3 — Supporting admin surfaces

- New lead
- Preferences
- Integrations
- Login

This wave aligns all supporting pages with the same visual and interaction system after the high-frequency workflows are stable.

## Cross-page mandates

1. One shell language across all dashboard pages: page header, page summary, primary action area, content body.
2. One scroll container per page. Avoid nested full-height interior scroll areas unless the component is explicitly a drawer, sheet, or code panel.
3. One source of truth for each stateful control. Do not duplicate stage, priority, job status, or approval state in multiple competing widgets.
4. One primary action per major page section. Secondary actions belong in menus, drawers, or subordinate rows.
5. Lists and workspaces must answer a concrete operator question:
   - Dashboard: what needs attention now?
   - Leads list: which lead deserves action next?
   - Lead detail: what is known, what happened, what should happen now?
   - Campaign detail: which candidates should become leads?
6. Empty states must always offer a next move.
7. Loading and async states must explain what is happening, not just show spinners.
8. Achieve the visual refresh with shadcn primitives, token cleanup, spacing discipline, and IA changes before inventing custom widgets.

## Shadcn-first implementation policy

- Use existing primitives first: `Sidebar`, `Breadcrumb`, `Tabs`, `Card`, `Table`, `Badge`, `Button`, `Input`, `Textarea`, `Select`, `ToggleGroup`, `Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `DropdownMenu`, `Empty`, `Alert`, `Skeleton`, `Separator`.
- Replace ad hoc pills, cards, filters, and modals with consistent shadcn compositions.
- Use semantic tokens and variants, not page-specific hardcoded color systems.
- Prefer `ToggleGroup` or linked tabs for short option sets instead of custom button rows.
- Use `Sheet` and `Dialog` to remove permanent clutter from pages that currently stack generation, review, and diagnostics inline.

## Sequencing constraints

- Complete the lead-detail overhaul before redesigning other lead surfaces so downstream pages can inherit its spacing, action bar, and sub-workspace patterns.
- Redesign the leads list before the dashboard so dashboard cards can link into the final list states and filters.
- Redesign campaign detail before campaign list so the list can summarize the actual target workspace, not a stale mental model.
- Do not redesign settings pages before `FOUNDATIONS.md` decisions are reflected in the dashboard shell and high-frequency operational pages.

## Done criteria for the full package

- Every main page has a dedicated implementation brief in this folder.
- The briefs are ranked from most important to least.
- The package defines one consistent cross-page design system and IA rule set.
- Each brief is implementation-oriented enough for smaller agents to execute without guessing the intended workflow.
- The package stays inside current product scope and human-in-the-loop boundaries.
