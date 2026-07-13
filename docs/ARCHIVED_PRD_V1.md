# ⚠️ ARCHIVED / DEPRECATED DOCUMENT
This document represents the legacy v1 requirements before the SDR pivot. For active requirements, see [PRD.md](file:///d:/vs%20code/leadroom/docs/PRD.md).

---

# PRD — AI Agency Growth OS, v1 (MVP)

## 0. Document status

- Version: v1.0 (MVP-only)
- Scope: Stage 1 from the main plan — core internal lead workspace, no AI.
- Audience: founder / operator, coding agents, reviewers.
- Goal: Define the smallest real product that makes the agency’s life better today.

---

## 1. Product summary (v1)

v1 is a **lead workspace** for a small creative agency.

It lets the operator:

- store and update leads in one place.
- see pipeline stages and next actions.
- create and complete follow-up tasks.
- capture notes and interaction history.
- get a simple dashboard of pipeline and tasks.

No AI, no enrichment, no audits, no scoring, no outreach generation.

This must already be **better than Notion/Sheets + memory** for weekly ops.

---

## 2. Problem v1 solves

Today the agency:

- tracks leads in scattered spreadsheets, emails, messages, and ad hoc notes.
- forgets to follow up on warm leads.
- has no single view of “what’s in the pipeline.”
- struggles to see what to work on today.
- re-learns context every time they revisit a lead.

v1 solves exactly this:

- unify lead data, notes, and tasks in one app.
- make the next actions for each lead visible.
- provide a simple, truthful snapshot of the pipeline.

---

## 3. v1 goals

### 3.1 Primary goals

- Provide a **single source of truth** for active leads.
- Make it easy to **see and update pipeline stage** for every lead.
- Enable **disciplined follow-up** via tasks and due dates.
- Keep a **clear activity history** for each lead.

### 3.2 Non-goals (v1)

- No AI research or enrichment.
- No website or digital presence audits.
- No automated or generated outreach.
- No lead scoring.
- No discovery scopes or candidate lead intake.
- No integrations with external CRMs or email providers.
- No multi-tenant SaaS; single internal workspace only.

---

## 4. Target users (v1)

### 4.1 Primary user

Agency owner / operator / sales lead.

- Needs one place to manage pipeline.
- Needs to know what to work on today.
- Needs to remember context for each lead.

### 4.2 Secondary users

Internal team members supporting outreach or account management.

- May add notes or tasks on leads.
- May update stages and outcomes.

v1 can assume a **small number of internal users**, without complex permissions.

---

## 5. Core user jobs (v1)

v1 focuses on these jobs only:

1. **Capture lead**  
   - “I met a potential client; I want to quickly add them so I don’t lose them.”

2. **Review pipeline**  
   - “I want to see all my leads by stage and know where each one stands.”

3. **Know what to do today**  
   - “I want to see the tasks and follow-ups due today or overdue.”

4. **Update lead status and notes**  
   - “After a call or email, I want to log what happened and move the lead to the right stage.”

5. **Look back at history**  
   - “I want to quickly see what we last did for this lead and when.”

---

## 6. v1 scope

### 6.1 In-scope features

- Authentication (minimal, internal).
- Lead entity and CRUD.
- Pipeline stage tracking on the lead.
- Notes on leads.
- Tasks linked to leads.
- Simple activity history for leads.
- Dashboard with:
  - leads by stage.
  - tasks due today.
  - overdue tasks.

### 6.2 Out-of-scope features (v1)

- AI features of any kind.
- Discovery scopes and candidate leads.
- Research snapshots.
- Audits.
- Lead scoring.
- Outreach drafts or templates.
- Approvals.
- Background jobs (beyond what’s needed for basic CRUD).
- Reporting beyond the simple dashboard.

---

## 7. v1 functional requirements

### 7.1 Authentication (minimal)

- User can log into the app with a simple, non-public mechanism (e.g. password or invite-only).
- All core screens require authentication.

Acceptance:

- Unauthenticated requests are blocked from lead/task data.
- At least one internal user can sign in and operate the system.

---

### 7.2 Lead management

The user must be able to:

- Create a new lead.
- View a list of leads.
- Filter/sort leads by basic fields.
- Open a lead detail page.
- Edit lead fields.
- Archive a lead.

**Lead fields (v1):**

- Name (required).
- Company name or business name (can be same as name).
- Basic contact:
  - Email (optional).
  - Phone (optional).
- Website (optional).
- City / region (optional).
- Industry (optional, free text).
- Current pipeline stage (required).
- Status (Active / Archived).
- Owner (optional, assigns to a user).
- Created/updated timestamps.

Acceptance:

- New lead can be created with just name + stage; other fields optional.
- Editing a lead updates timestamps.
- Archiving hides leads from default “active pipeline” views but preserves history.

---

### 7.3 Pipeline stages

v1 needs a simple stage model.

Proposed initial stages:

- New
- Researching
- Qualified
- Outreach in Progress
- Meeting / Call
- Proposal
- Won
- Lost
- Paused

Requirements:

- Each lead has exactly one current stage.
- User can change a lead’s stage from the lead detail view.
- Stage is visible in:
  - lead list.
  - lead detail.
- Optionally: certain stage changes can require a note (e.g. moving to Lost or Won).

Acceptance:

- Stage changes are persisted and immediately reflected in the UI.
- Leads can be filtered by stage.

---

### 7.4 Tasks and reminders

The user must be able to:

- Create a task.
- Link a task to a lead (optional but strongly encouraged).
- Set a due date and optional priority.
- Mark tasks as completed.
- View tasks:
  - due today.
  - upcoming.
  - overdue.

**Task fields (v1):**

- Title (required).
- Description (optional).
- Lead (optional FK).
- Due date (optional).
- Status: Open / Completed / Canceled.
- Priority: Low / Medium / High (optional).
- Created/updated timestamps.
- Completed timestamp when status = Completed.

Acceptance:

- Tasks appear in a “My tasks” view grouped by status/due date.
- From a lead detail page, user can see all tasks linked to that lead.
- Completing a task removes it from “Open” / “Overdue” sections, but remains in history.

---

### 7.5 Notes

The user must be able to:

- Add freeform notes on a lead.
- View all notes in reverse chronological order on the lead detail page.

**Note fields (v1):**

- Body (text).
- Author.
- Created timestamp.

Acceptance:

- Notes are always visible on the lead detail page.
- Adding a note does not require editing lead core fields.

---

### 7.6 Activity history

The system must keep a simple activity trail per lead.

v1 activities include at least:

- Lead created.
- Lead updated (basic summary).
- Stage changed (from → to).
- Note added.
- Task created/completed (when linked to the lead).

Requirements:

- Activity is shown in a chronological feed on the lead detail page.
- Each item shows:
  - type (e.g. “Stage changed”).
  - brief summary.
  - timestamp.

Acceptance:

- Viewing a lead shows its activity timeline.
- Recent actions (stage changes, notes, tasks) appear without manual intervention.

---

### 7.7 Dashboard

The dashboard must answer two questions:

1. “What does my pipeline look like right now?”
2. “What should I do next?”

Minimum dashboard content:

- Count of leads by stage (small chart or segmented list).
- List of:
  - Tasks due today.
  - Overdue tasks.

Optional but nice:

- Recently updated leads.
- Recently created leads.

Acceptance:

- After login, user can land on dashboard and understand:
  - pipeline distribution.
  - which tasks need attention.

---

## 8. Experience requirements (v1)

### 8.1 UX tone

The app should feel like:

- a calm, internal business tool.
- not flashy.
- not AI-centric.

### 8.2 Required screens

- Login (simple).
- Dashboard.
- Lead list.
- Lead detail (with notes, tasks, activity).
- Task list.

### 8.3 UX constraints

- Fast to capture a new lead.
- Minimal clicks to:
  - update stage.
  - add a note.
  - add a task.
- Obvious indicator of “what’s next” (tasks / overdue).

---

## 9. Data / quality requirements (v1)

- All entities must store `created_at` and `updated_at`.
- Deleting leads should be **soft delete or archive**; avoid hard deletion in v1.
- System must tolerate:
  - leads without email.
  - incomplete profile fields.
- Activity history must not be lost on lead updates.

No AI-only fields are required in v1, but the schema should not block adding them later.

---

## 10. Non-functional requirements (v1)

- **Reliability:**  
  - Basic CRUD must be stable; errors should be surfaced clearly.
- **Performance:**  
  - Lead list and lead detail should load quickly for small to moderate datasets.
- **Security:**  
  - All lead and task data behind authentication.
  - No public endpoints exposing full lead data.
- **Maintainability:**  
  - Code structured so future AI features can attach to:
    - Lead
    - ResearchSnapshot
    - Audit
    - LeadScore
    - OutreachDraft
  - without rewriting v1.

---

## 11. Definition of done for v1

v1 is done when:

- A real operator can:
  - log in.
  - create leads.
  - move them through stages.
  - add notes.
  - add and complete tasks.
  - see an activity timeline.
  - see at a glance on the dashboard:
    - how many leads are at each stage.
    - what they should work on today.

- The operator prefers using this system over their current spreadsheets / notes for at least one full week of real work.

No AI features are required or implemented in v1.

This is a **production-feeling internal tool** that stands on its own as the base for later AI stages.