# [053] Stage 6 Enhancement — Polish & Connect

**Category:** UI/UX / Feature Integration
**Effort:** M (Medium)
**Impact:** Improves operational clarity by making background systems (Playbooks, NBA Simulator, Stage Requirements, Calendar) highly visible on the core Lead Detail and Pipeline views.

---

## Context

Recent Stage 6 features—Playbooks, NBA Simulator, Stage Requirements, and Calendar Sync—have been successfully implemented as functional backend systems or localized UI modules. However, they lack strong cross-linking on the primary operator surfaces. To ensure these features drive daily workflows, their status and outputs need to be surfaced more obviously on the Lead Detail page and the Pipeline view.

## Goal

Create visual connections between these standalone systems so the operator has full context without switching tabs or digging into settings.

---

## Design & Implementation

### 1. Database Schema Additions (Prerequisite)
To support playbook and calendar features, we must first update the `tasks` schema in [core.ts](file:///d:/vs%20code/leadroom/src/db/schema/core.ts):
- Add `playbookId` (text) referencing `playbooks.id` to track task origin.
- Add `googleCalendarEventId` (text) to map tasks to external calendar items.
- Add `googleCalendarSyncStatus` (text) defaulting to `'PENDING'` (values: `'PENDING' | 'SYNCED' | 'ERROR'`).
- Add `googleCalendarSyncError` (text) to display troubleshooting tooltips.

*Run a migration to add these columns to the database.*

### 2. Playbook Tasks on Lead Detail
**Problem:** Playbooks spawn tasks automatically, but it's not always visually clear to the operator that a task belongs to an automated sequence.
**Solution:**
- Update task creation services (`src/services/lead.ts` or stage transition logic) to populate `playbookId` when spawning tasks.
- Update the `TaskItem` or `TasksList` component on the Lead Detail page.
- Display a small badge or icon (e.g., `[Playbook: Outreach]`) next to tasks that carry a `playbookId`.

### 3. Stage Requirement Indicators
**Problem:** Stage Requirements prevent a lead from moving forward, but operators currently only find out when they try to change the stage and hit a validation error.
**Solution:**
- **Optimization:** To avoid client-side CPU overhead on the board view, compute unmet stage requirements server-side inside `getPipelineBoard()` and Lead queries, returning a list of unmet requirement strings on the Lead DTO.
- Update the `StageDropdown` and `PipelineBoard` components.
- Show a subtle indicator (e.g., a small lock icon or a progress ring) next to pipeline stages that currently have unmet requirements for the active lead.
- On hover, display a tooltip listing the missing requirements (e.g., "Missing: Contact Email, Website Audit").

### 4. Calendar Sync Status Indicator
**Problem:** Calendar sync runs in the background. Operators don't know if a scheduled meeting is successfully synced or if the sync failed.
**Solution:**
- Update `syncTasksToCalendar` in `src/services/calendar.ts` to capture the return payload from the Google Calendar API, update `googleCalendarEventId` on successful sync, and write the appropriate `googleCalendarSyncStatus` and `googleCalendarSyncError` details to the DB.
- On the Lead Detail page (Timeline/Tasks feed), add a calendar sync status icon next to events mapped to external calendars based on their sync status.
  - **States to represent:** `Synced` (green check/calendar icon), `Pending` (spinner), `Error` (red warning with error tooltip containing the sync error message).

### 5. NBA Simulator (Next Best Action) Prominence & Dismissal
**Problem:** The NBA Simulator generates prioritization signals, but they might be buried in the UI or require manual triggering.
**Solution:**
- Feature the highest-priority Next Best Action prominently at the top of the Lead Detail page (e.g., an "NBA: Recommended Action" callout above the activity feed).
- Provide a one-click button to execute, schedule, or dismiss the action.
- **Dismissal Logic:** Clicking "Dismiss" must write an `nba_action_logs` record with the signal and a `resultStageTarget: 'DISMISSED'` or similar muted status to prevent the action from reappearing.

---

## Edge Cases & Considerations

- **Performance (Pipeline Board):** Ensure server-side pre-computation of unmet requirements is optimized and doesn't run duplicate queries for each lead on the board.
- **Task Origin Data:** If existing playbook tasks lack origin metadata, the UI must gracefully fall back to a standard task display without breaking.
- **Calendar Failures:** Ensure the error tooltip provides a clear reason (e.g., "Invalid calendar credentials") so the operator knows how to fix it.

---

## Verification

1. **Database Schema:** Confirm migration runs successfully and database schemas reflect new fields.
2. **Playbook UI:** Verify that tasks spawned by playbooks display the correct source badge.
3. **Requirements Hover:** Verify that hovering over a locked stage in the dropdown correctly evaluates and lists the specific unmet requirements.
4. **Calendar Iconography:** Ensure sync status accurately reflects the database state for a mock meeting, showing errors when the sync status is `'ERROR'`.
5. **NBA Placement & Dismissal:** Confirm the top Recommended Action is clearly visible, and dismissing it correctly mutes the action.
