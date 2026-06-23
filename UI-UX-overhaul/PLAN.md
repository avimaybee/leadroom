# Plan: Rebuild the Lead Detail Experience

> **Executor instructions**: This is the authoritative master plan. Read every document in this folder before editing code. Execute phases in order. Run each phase’s drift check and verification gate. If a STOP condition occurs, stop and report; do not improvise or broaden scope.

## Status

- Priority: P0 product usability
- Scope: first lead-detail page only (`/leads/[id]`)
- Planned at: commit `c983a1d`, 2026-06-22
- Current risk: the worktree contains an unrelated operator change in `src/app/(dashboard)/scopes/[id]/page.tsx`; preserve it and keep it out of this overhaul
- Overall effort: L, split into independently reviewable phases

## Outcome

The lead-detail page becomes a calm, task-oriented workspace with one page scroll, stable information architecture, obvious next actions, a focused Outreach workflow, and a usable Activity history. The change must preserve current data, server actions, status-transition rules, approval boundaries, research lifecycle, and manual override behavior.

## Current-state findings

| # | Finding | Impact | Evidence | Priority |
|---|---|---|---|---|
| 1 | Nested scrolling clips core content | Contacts, tasks, and activity disappear below an internal rail; page and child compete for scroll | `LeadDetailsWorkspace.tsx:238`, `ClientActivityList.tsx:18`, screenshots | P0 |
| 2 | Accordion rail hides frequent jobs | Contacts, tasks, and notes require guessing which panel contains the needed action | `LeadDetailsWorkspace.tsx:287–399` | P0 |
| 3 | Duplicate hierarchy and state | Stage is both badge and select; scoring appears in header, rail, and Audit | `LeadDetailsWorkspace.tsx:199–229`, `304–327`, `450–463` | P0 |
| 4 | Outreach has no dominant task | Channel tabs, compare, context, versions, editor, decision, and generation all compete in one vertical surface | `OutreachAssistant.tsx:509–1043` | P0 |
| 5 | Notes/history are implementation-centric | Frequent note capture is hidden; raw diagnostics receive excessive prominence | `ClientNotesForm.tsx:34–55`, `ClientActivityList.tsx:44–140` | P1 |
| 6 | Component boundaries block safe redesign | `OutreachAssistant.tsx` mixes state, mutations, overlays, and all rendering in 1,000+ lines | file-wide | P1 |
| 7 | Stateful navigation is not shareable | Primary tab and outreach channel use local state; reload/back/share lose context | `LeadDetailsWorkspace.tsx:64`, `OutreachAssistant.tsx:87` | P1 |
| 8 | Responsive strategy is collapse-by-stacking | A wide fixed rail and dense main editor become long stacks rather than task-adapted views | `LeadDetailsWorkspace.tsx:235–238` | P1 |

## Hard scope

### In scope

- `src/app/(dashboard)/leads/[id]/page.tsx`
- `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx`
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`
- Lead-detail client components and new components under `src/app/(dashboard)/leads/[id]/components/`
- Shared UI primitives only when a missing primitive is necessary for this page and does not alter other pages unexpectedly
- Focused tests for view-state logic and existing lead/outreach business flows
- Documentation updates required by the final implementation

### Out of scope

- Other pages, global navigation redesign, dashboard redesign, lead-list redesign
- Database migrations or schema changes
- Changes to outreach prompts, AI providers, research/audit generation logic, scoring algorithms, stage definitions, or automatic stage advancement
- Live outbound messaging
- New paid services or dependencies
- Broad global design-system replacement
- Deleting historical data or drafts

## Execution order

| Phase | Title | Depends on | Status |
|---|---|---|---|
| 0 | Establish behavior and visual baseline | — | DONE |
| 1 | Build URL-synced lead workspace shell | 0 | DONE |
| 2 | Recompose Overview and remove score-driver UI | 1 | DONE |
| 3 | Rebuild Notes & Activity | 1 | DONE |
| 4 | Decompose Outreach without changing behavior | 0 | DONE |
| 5 | Reimagine Outreach workflow | 1, 4 | DONE |
| 6 | Integrate Research and Audit into the new IA | 1, 2 | DONE |
| 7 | Responsive, accessibility, and regression hardening | 2, 3, 5, 6 | DONE |

Phases 1 and 4 may run in parallel after Phase 0 because Phase 4 stays inside the outreach boundary. Phase 3 begins after Phase 1. Phase 5 must not begin until both Phases 1 and 4 land and Phase 4 preserves all existing outreach behavior.

## Phase 0 — Establish behavior and visual baseline

### Goal

Prevent a visual rewrite from silently dropping working behavior.

### Tasks

1. Record `git status --short` and preserve all existing operator edits. If `LeadDetailsWorkspace.tsx` or `OutreachAssistant.tsx` differs from this plan’s evidence, reconcile manually and document the drift.
2. Capture reference screenshots at 320, 768, 1280, 1440, and 1920 px for Overview/current default, Research, Audit, Outreach for all statuses, and Notes/Activity expanded.
3. Inventory every current lead-detail action and map it to a target destination. At minimum: edit lead, change stage, add/edit/delete contact, add/toggle task, add note, research run/cancel/edit, audit edit/override, generate/edit/save/copy/preview/delete/duplicate/compare/approve/reject/mark-sent outreach.
4. Run baseline TypeScript and focused tests. Record pre-existing failures; do not attribute them to the redesign.
5. Add characterization tests for pure view-state/status helpers before extracting them. Do not snapshot the entire page.

### Verify

- `npx tsc --noEmit` exits 0 or baseline failures are recorded.
- Focused tests in `QUALITY-GATES.md` pass or baseline failures are recorded.
- Action inventory has a target location for every action; no action is silently removed.

## Phase 1 — Build URL-synced lead workspace shell

### Goal

Replace the split-pane accordion architecture with stable task-oriented views and one document scroll.

### Tasks

1. Create a typed lead workspace view model: `overview | research | audit | outreach | activity`.
2. Read the selected view from `searchParams`; default invalid/missing values to `overview`.
3. Render accessible navigation using the existing Tabs primitives only if they support links/history correctly; otherwise use `Link` navigation styled as tabs. Preserve Cmd/Ctrl-click semantics.
4. Remove `max-h-[calc(100vh-140px)] overflow-y-auto` and the fixed 320 px context rail.
5. Implement the header, navigation, and content container in `LEAD-DETAIL-IA.md`.
6. Keep old content inside the new destinations temporarily so this phase changes IA without rewriting every feature.

### Verify

- Reload, back, forward, and copied URLs preserve the selected view.
- Normal lead-detail use has one scrollbar.
- Keyboard order follows header → workspace navigation → active content.
- 320 px has no horizontal page overflow.

## Phase 2 — Recompose Overview and remove score-driver UI

### Goal

Make Overview answer identity, state, next action, contacts, tasks, and recent history without accordions.

### Tasks

1. Build the 8/4 desktop grid and responsive single-column layout specified in `LEAD-DETAIL-IA.md`.
2. Move lead profile fields into a flat summary component with a single `Edit lead` action.
3. Show contacts directly; cap preview length and link to management UI when long.
4. Show open tasks directly, overdue first, with compact add-task disclosure/dialog. Replace the task Priority select with an accessible 3-choice radio/segmented control if it can be done without altering data semantics.
5. Show the latest 3 meaningful interactions and link to Activity.
6. Remove the header priority badge, rail Priority Score Drivers section, duplicate Audit rendering, `ClientScoreDrivers` imports, and all lead-detail render calls. Delete `ClientScoreDrivers.tsx` only after confirming no other import exists.
7. Preserve scoring data/services and transparent rationale within `ClientAuditView` if that component already provides it. If removing `ClientScoreDrivers` would eliminate the only scoring explanation, STOP and report the documentation conflict instead of deleting explainability.

### Verify

- Search confirms no lead-detail render/import of `ClientScoreDrivers`.
- Scoring business tests still pass.
- Missing contacts/tasks/audit/research render compact honest empty states.
- Stage appears and can be changed in exactly one place.

## Phase 3 — Rebuild Notes & Activity

### Goal

Make note capture immediate and history reconstructable.

### Tasks

1. Implement `NOTES-ACTIVITY.md` as a dedicated Activity destination.
2. Refactor `ClientNotesForm` into a quick composer without an outer nested card.
3. Refactor `ClientActivityList` into a semantic timeline with user-facing filters and no fixed-height scroll.
4. Move raw stack/payload/batch details behind an explicit Technical details overlay.
5. Preserve verified timestamps and activity types; never invent actors or sources.
6. Add tests for filter classification and note submission behavior at the lowest stable layer.

### Verify

- Adding a note produces one timeline entry after refresh.
- No `max-h-[420px] overflow-y-auto` activity container remains.
- Empty, filtered-empty, long-note, and system-error states meet the spec.
- Keyboard and screen-reader labels pass the accessibility gates.

## Phase 4 — Decompose Outreach without changing behavior

### Goal

Create safe component boundaries before changing the workflow.

### Tasks

1. Extract the components listed in `OUTREACH-ASSISTANT.md` incrementally.
2. Centralize selected channel, active draft, dirty editor values, overlay state, and async operation state in an explicit reducer/hook.
3. Preserve current action calls and service-enforced status transitions.
4. Prevent `initialDrafts` refresh from overwriting dirty editor state. Define server reconciliation explicitly: clean state may sync; dirty state must surface a conflict/reload choice.
5. Add unit tests for state transitions: channel switch, select version, dirty edit, save success/failure, generation success/failure, approval/rejection, sent/rejected read-only state.

### Verify

- Existing focused outreach integration/action tests pass unchanged.
- Action inventory from Phase 0 still maps 1:1.
- `OutreachAssistant.tsx` is an orchestration boundary; no extracted presentation component performs unrelated server mutations.
- No visual redesign is accepted in this phase unless required for extraction.

## Phase 5 — Reimagine Outreach workflow

### Goal

Implement the focused outreach experience in `OUTREACH-ASSISTANT.md`.

### Tasks

1. URL-sync channel state and render the channel switcher once.
2. Make the editor and workflow state the dominant surface.
3. Replace permanent Decision & Feedback and Generate New Draft cards with review and generation overlays.
4. Replace inline expanding Versions with a drawer; allow selecting any 2 versions for comparison.
5. Move lead context into the evidence inspector/sheet with source and freshness cues.
6. Implement a state-specific action bar with one primary action.
7. Add unsaved-change protection and explicit save state. Approval must not race with stale client state.
8. Keep approval separate from sending and preserve rejection feedback.
9. Implement all 10 outreach acceptance scenarios.

### Verify

- Draft, Approved, Rejected, and Sent each show only valid actions.
- Approval confirmation explicitly says it does not send.
- Generate variation, versions, compare, and rejection reason no longer occupy permanent vertical cards.
- User-selected comparison works for non-adjacent versions.
- Unsaved edits survive harmless server refreshes and are never discarded silently.

## Phase 6 — Integrate Research and Audit

### Goal

Fit existing Research/Audit workflows into the new IA without redesigning their business logic.

### Tasks

1. Render Research and Audit as dedicated workspaces, not rail context plus duplicate tab content.
2. Keep research progress/cancel/error state visible inside Research and as a compact cross-page status only when active.
3. Ensure Outreach evidence links navigate to the relevant Research/Audit view and preserve channel state where reasonable.
4. Verify scoring rationale remains explainable after score-driver removal; do not duplicate it elsewhere.

### Verify

- Run/cancel/retry/edit research still works and exposes status.
- Audit editing/override behavior remains intact.
- No Critical Audit Weaknesses card is duplicated outside Audit/evidence inspector.

## Phase 7 — Responsive, accessibility, and regression hardening

### Goal

Meet every gate in `QUALITY-GATES.md` and prevent recurrence of clipping/cramping.

### Tasks

1. Execute the full viewport and data matrices.
2. Verify keyboard-only and screen-reader interaction for navigation and overlays.
3. Fix form labels, accessible icon names, live regions, focus restoration, reduced motion, long-content wrapping, and 24/44 px target rules.
4. Run all verification commands and capture final screenshots beside the baseline.
5. Update relevant product/setup docs only if final behavior changes documented workflows.

### Verify

- All quality gates pass.
- `npm run build` exits 0.
- `npm test` passes or only documented pre-existing failures remain.
- Git diff contains no files outside approved scope except necessary documentation/test fixtures.

## STOP conditions

- Relevant files have uncommitted changes that cannot be safely reconciled.
- A phase requires a database migration, new vendor, paid dependency, stage-model change, or live send capability.
- Removing score-driver UI would leave no transparent scoring rationale anywhere.
- Outreach behavior cannot be preserved without changing server business rules.
- A proposed shared primitive causes visual or behavioral changes outside lead detail.
- Typecheck/build/test failures appear outside the touched scope and cannot be proven pre-existing.

## Definition of done

- [x] One document scroll; no clipped rail or nested activity scrollbar.
- [x] Stable URL-synced Overview, Research, Audit, Outreach, Activity navigation.
- [x] Overview exposes identity, stage, next action, contacts, tasks, and recent history without accordions.
- [x] Priority score driver component is absent from lead detail; scoring data remains intact.
- [x] Notes and activity meet `NOTES-ACTIVITY.md`.
- [x] Outreach meets every requirement and acceptance scenario in `OUTREACH-ASSISTANT.md`.
- [x] All viewport, data, accessibility, interaction, and visual gates pass.
- [x] Current business rules and human approval boundaries are unchanged.
- [x] Final report lists changed files, verification results, remaining risks, and screenshots.
