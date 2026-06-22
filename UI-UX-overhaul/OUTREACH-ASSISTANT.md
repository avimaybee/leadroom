# Outreach Assistant Redesign Specification

## Product job

Help an operator prepare one channel-specific outreach asset, review its evidence and history, make an explicit human decision, and record what happened. It is not a prompt playground and never sends automatically.

## Problems to remove

Current evidence in `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`:

- A 1,000+ line component owns server mutations, state synchronization, editor rendering, version history, compare mode, approval, attachments, model display, and dialogs.
- Lines 512–518 add a second tab system immediately inside the page-level tabs.
- Lines 522–648 expose compare and lead context before the editor’s main task is established.
- Lines 697–810 turn versions into an inline expanding region that shifts the editor.
- Lines 968–1011 permanently display a rejection/approval form even before the operator chooses to review.
- Lines 1014–1043 permanently display another generation form below the editor.
- The screenshot shows all of these regions competing vertically, producing a long, cramped workflow with no dominant action.

## Target workflow

```text
Choose channel
  ├─ no draft → Generate first draft
  └─ draft exists → Edit/review draft
                    ├─ save changes
                    ├─ inspect evidence
                    ├─ open version history / compare
                    └─ review decision
                         ├─ reject with required reason
                         └─ approve (does not send)
                              └─ copy/use externally → explicitly Mark as Sent
```

## Page anatomy

### 1. Outreach header

- Title: `Outreach` plus one-line purpose.
- Channel segmented control: Email, LinkedIn, Call Prep, Meeting Prep. Show a small count only when useful.
- State lives in the URL (`view=outreach&channel=email`).
- Model/provider detail is not a persistent headline. Put it inside generation details/help unless an unavailable provider blocks the action.

### 2. Workflow status

Show a compact, read-only sequence for the selected draft:

`Draft → Human review → Approved → Sent`

Use text plus icon; color is supplementary. Rejected is a clear terminal branch with the recorded reason and `Duplicate & edit` recovery action.

### 3. Editor workspace

The editor is the dominant surface.

- Email: Subject + message body.
- LinkedIn: message body with appropriate character guidance.
- Call/Meeting: structured content editor/preview optimized for longer material.
- Editor/Preview is one two-state toggle near the content, not a mode hidden among utility buttons.
- Show word/character count as subdued metadata.
- Show `Saved`, `Unsaved changes`, `Saving…`, or `Save failed` adjacent to the save control.
- `Save changes` is the primary action only while dirty; otherwise it is disabled or replaced by saved status.
- Warn before navigating away with unsaved changes.
- Do not permit server-refreshed props to overwrite unsaved local edits.

### 4. Context/evidence inspector

On wide screens, show a supporting inspector beside the editor with 3 short sections:

- Outreach angle: the selected opportunity hypothesis.
- Evidence: linked audit/research excerpts with source/freshness.
- Contact: intended recipient and available channel.

The inspector is not another accordion stack. Each section shows a concise default and links to the complete Research or Audit view. On smaller screens it opens as a sheet. Missing evidence is stated honestly and does not block manual drafting.

### 5. Action bar

Group actions by frequency and risk:

- Primary: `Save changes` while dirty; otherwise `Review draft` for Draft status or `Mark as sent` for Approved status.
- Secondary: `Preview/Edit`, `Copy`.
- Tertiary overflow: `Version history`, `Generate variation`, `Duplicate`, `Delete draft`.
- Destructive Delete is available only for Draft and requires confirmation.

Do not display Save, Approve, Reject, Generate, Delete, Versions, Compare, Copy, and Preview with equal weight.

## Progressive overlays

### Generate first draft / variation sheet

Open from the empty state or `Generate variation` action.

- Channel is preselected and visible.
- Custom instructions are optional and labeled.
- Attachments are optional; show accepted formats and limits before selection.
- Explain the evidence that will be used.
- One primary button: `Generate email draft` (channel-specific).
- Disable repeat submission while pending and show persistent generation progress.
- Closing with entered content requires confirmation or preserves a draft locally.

### Human review dialog

Opened deliberately from `Review draft`.

- Displays draft identity, current saved state, and the consequence of approval.
- If unsaved, save transactionally before presenting final confirmation or block review until saved.
- Primary: `Approve draft`.
- Secondary: `Reject draft` opens a required reason field in the same dialog.
- Approval copy must explicitly say that approval does not send outreach.

### Version history drawer

- Chronological list with version number, origin, status, author if available, and timestamp.
- Selecting a version previews it without losing unsaved current edits.
- Compare requires selecting exactly 2 versions; the user chooses them. Do not hardcode “2 most recent”.
- Compare opens a full-width dialog with synchronized headings and clear `Use this version`/`Return to editor` actions.

## Required component decomposition

`OutreachAssistant.tsx` becomes the orchestration boundary, not the entire UI. Suggested components under `src/app/(dashboard)/leads/[id]/components/outreach/`:

| Component | Responsibility |
|---|---|
| `OutreachWorkspace` | channel/draft orchestration and server-state boundary |
| `ChannelSwitcher` | URL-synced channel choice |
| `DraftStatusPath` | readable workflow state |
| `DraftEditor` | subject/body, preview, dirty state, counts |
| `DraftActionBar` | state-specific actions only |
| `EvidenceInspector` | research/audit/contact context |
| `GenerationSheet` | custom instruction and attachments |
| `ReviewDialog` | approval/rejection decision |
| `VersionDrawer` | history and version selection |
| `DraftCompareDialog` | user-selected two-version comparison |

Extract state transitions into a reducer or explicit hook. Represent impossible states (e.g. review dialog for SENT draft) as impossible in the component API where practical.

## Business-rule boundaries

- Keep `OutreachService.updateDraftStatus()` as the authority for valid status transitions.
- Do not change AI prompts or provider fallback behavior in this visual overhaul.
- Do not approve and send in one action.
- Do not introduce live sending.
- Keep rejection feedback required.
- Keep Copy/use-external and Mark as Sent separate so the audit trail remains honest.
- Preserve attachments and all existing drafts.

## Outreach acceptance scenarios

1. No drafts: operator sees one explanatory empty state and one channel-specific generation action.
2. Existing Draft: editor dominates; only edit/review-relevant actions are visible.
3. Unsaved edit: status changes immediately; tab/channel/navigation cannot silently discard it.
4. Approve: pending edits are persisted, confirmation states “does not send”, status becomes Approved once.
5. Reject: reason is required, stored, and visible on the rejected version.
6. Approved: editor is read-only unless current business rules allow editing; primary action is Mark as Sent.
7. Sent: content and history remain readable; mutation controls are absent.
8. Version compare: operator chooses any 2 versions; current edits remain intact.
9. Generation failure: entered instructions/attachments remain available and retry guidance is specific.
10. Mobile: subject/body and primary action are usable at 320 px without horizontal scrolling or covered fields.

