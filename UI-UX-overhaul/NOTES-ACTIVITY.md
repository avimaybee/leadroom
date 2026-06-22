# Notes & Activity Redesign Specification

## Decision

Replace the `Notes & Activities` rail accordion with a dedicated Activity workspace. Notes are a type of interaction and should enter the same chronological history instead of appearing as a separate card nested above another scrolling card.

## Current problems

- `LeadDetailsWorkspace.tsx:381–399` hides a frequent workflow inside the last accordion of an independently scrolling rail.
- `ClientNotesForm.tsx:34` creates a bordered card inside the already bordered accordion.
- `ClientActivityList.tsx:18` adds another `max-height` scroll region inside the rail.
- Activity items switch between flat note rows and expandable system rows, making hierarchy depend on implementation metadata rather than operator relevance.
- Raw error stacks, payloads, and batch entities (`ClientActivityList.tsx:75–137`) compete with business history.
- The search field at `ClientActivityList.tsx:99–105` has no persistent label and searches batch internals, not the activity history operators need.

## Target anatomy

### Quick note composer

- First item in Activity.
- Clear visible label: `Add note`.
- One textarea, optional lightweight timestamp/context hint, and one `Add note` action.
- Placeholder uses an ellipsis and a useful example, but the visible label carries the meaning.
- Submit shows `Adding note…`; error appears next to the field and is announced.
- Successful submit clears the composer, adds the item to the timeline, and moves focus to a short success status or the new item.
- Future interaction types may be added later, but this phase must not add a generic type dropdown merely for extensibility.

### Timeline toolbar

- Result count and optional search across operator-facing summaries.
- Filters: All, Notes, Tasks, Stage changes, Outreach, System. Use chips/buttons; hide zero-count categories.
- Default All prioritizes meaningful operator activity. Low-level system diagnostics appear only under System or Technical details.
- Filter/search state is URL-addressable when practical.

### Interaction timeline

- Reverse chronological, grouped by Today, Yesterday, and earlier dates.
- Each row shows icon, human-readable event label, summary, actor/source, and timestamp.
- Notes display full readable text up to a sensible line clamp with `Show more` for long entries.
- System events are concise by default. Error stack/payload/batch details open in a `Technical details` dialog or drawer and never render inline in the primary history.
- Use one timeline container with dividers, not one card per event.
- Do not cap the list at 420 px. The document owns scrolling. If the list becomes large, add pagination or incremental loading, not another nested scrollbar.

## Content rules

- Prefer `Stage changed from Researching to Drafting` over raw event codes.
- Prefer actor names or `System` over unattributed events.
- Use `Intl.DateTimeFormat` through the project date utilities; do not add new hardcoded date formatting.
- Distinguish AI-generated, system-generated, and human-authored interactions where data permits.
- Never expose sensitive payload values by default.

## Empty states

- No activity: `No activity yet. Add a note to start the lead history.` plus the composer already visible; do not add a duplicate button.
- No filtered results: preserve filters and offer `Clear filters`.
- Activity load failure: show retry and preserve any unsent note draft.

## Scope guard

This phase may reshape the UI around existing `activities` and `addNoteAction` data. If the requested actor, source, or rejection-reason fields are unavailable, render only verified fields and document the missing data. Do not invent values or expand the database schema without a separate approved plan.

## Acceptance scenarios

1. A note can be added without opening an accordion or scrolling a nested rail.
2. Adding a note creates one visible timeline item and no duplicate presentation.
3. Long notes wrap and expand without horizontal overflow.
4. System errors show a safe summary; technical details require an explicit action.
5. Filters can be operated by keyboard and have visible selected state beyond color.
6. Timeline remains usable with 0, 1, 20, and 100 interactions.
7. On mobile, composer action and timeline metadata wrap without overlap.

