# DATA_MODEL.md — Core Entities and Relationships

## Document status

- Status: Draft v1.
- Scope: Conceptual and logical data model for AI Agency Growth OS.
- Companion docs: `AGENTS.md`, `PRD.md`, `PLAN.md`, `ARCHITECTURE.md`.
- Audience: founder, coding agents, future engineering contributors.

This document defines the core entities, key fields, and relationships for the system.

It is intentionally minimal but opinionated: it should be enough to implement Stage 1–3 and be safe to extend.

---

## 1. Modeling intent

The data model should:

- support the lead-centric workflow.
- be simple enough for a small team and internal usage.
- preserve important history.
- tolerate incomplete data.
- keep AI outputs structured where they affect workflow.
- be evolvable without breaking everything.

The model is closer to an internal CRM tailored to lead research, audits, and outreach prep, not a full sales cloud.

---

## 2. Core entity list

Canonical entities for v1–v3:

- User
- Lead
- Contact
- DiscoveryScope
- CandidateLead
- ResearchSnapshot
- Audit
- LeadScore
- OutreachDraft
- Task
- Activity
- Approval
- JobRun

These match common CRM building blocks (company/lead/contact/activity) with additional vertical-specific entities for research, audits, and AI-assisted workflows.

---

## 3. Entity overviews

This section describes each entity at a high level.

### 3.1 User

Represents a person who can log into the system.

Even if v1 has a single operator, modeling User cleanly avoids rework later.

### 3.2 Lead

Represents a business or opportunity that may become a client.

The Lead is the central anchor entity.

### 3.3 Contact

Represents a person or general contact channel (e.g. role-based email) as part of a Lead.

### 3.4 DiscoveryScope

Represents a saved definition of targeting criteria used to find new CandidateLeads.

> [!NOTE]
> In the user interface, the **DiscoveryScope** entity is presented to the operator as a **Campaign** (or Outreach Campaign) to align with a linear, folder-based workspace workflow.

### 3.5 CandidateLead

Represents a business discovered through a DiscoveryScope or manual import before it is promoted to a Lead.

### 3.6 ResearchSnapshot

Represents a time-bound summary of what the system (or user) found about a Lead from public sources.

### 3.7 Audit

Represents a structured evaluation of a Lead's website, branding, and digital presence quality.

### 3.8 LeadScore

Represents a priority score for a Lead with rationale and optional history.

### 3.9 OutreachDraft

Represents a draft outreach artifact (email, call prep, visit prep, proposal notes) tied to a Lead.

### 3.10 Task

Represents a to-do item or reminder for a User, usually tied to a Lead.

### 3.11 Activity

Represents a historical event for a Lead, used for the activity timeline.

### 3.12 Approval

Represents an approval decision over some target entity (e.g. OutreachDraft).

### 3.13 JobRun

Represents an asynchronous job execution (e.g. enrichment run, research generation, audit generation).

---

## 4. Relationships (conceptual)

High-level relationships between entities:

- User 1–N Lead (owner)
- User 1–N Task (assignee)
- User 1–N Activity (actor)
- User 1–N Approval (approver)

- Lead 1–N Contact
- Lead 1–N ResearchSnapshot
- Lead 1–N Audit
- Lead 1–N LeadScore
- Lead 1–N OutreachDraft
- Lead 1–N Task
- Lead 1–N Activity
- Lead 1–N Approval (via target reference)
- Lead 1–N JobRun (where job is lead-related)

- DiscoveryScope 1–N CandidateLead
- CandidateLead N–1 Lead (optional, when promoted)

- JobRun 1–1 ResearchSnapshot (optional, if job created one)
- JobRun 1–1 Audit (optional)
- JobRun 1–1 LeadScore (optional)

The implementation can use foreign keys; this is the conceptual view.

---

## 5. Entity details

This section lists key fields and constraints per entity.

Names are indicative; adapt to the chosen ORM / framework conventions.

### 5.1 User

Essential fields:

- id (PK)
- name
- email (unique)
- role (enum: OWNER, OPERATOR, COLLABORATOR, ADMIN — can start simple)
- is_active (bool)
- created_at
- updated_at

Notes:

- v1 may treat all users similarly; role is future-proofing.

### 5.2 Lead

Essential fields:

- id (PK)
- name (business name)
- website_url (nullable)
- primary_email (nullable)
- primary_phone (nullable)
- address_line1 (nullable)
- address_line2 (nullable)
- city (nullable)
- state_region (nullable)
- postal_code (nullable)
- country (nullable)
- industry (nullable, string for now)
- business_summary (nullable, text)
- source_type (enum: MANUAL, IMPORT, DISCOVERY_SCOPE, OTHER)
- source_id (nullable; reference id, e.g. DiscoveryScope or import batch)
- status (enum: ACTIVE, ARCHIVED)
- stage (enum representing pipeline stage; see pipeline docs later)
- triage_priority (enum: HIGH, MEDIUM, SKIP, UNASSESSED)
- triage_reason (nullable, text)
- owner_user_id (FK -> User.id, nullable for now)
- created_by_user_id (FK -> User.id)
- created_at
- updated_at
- deleted_at (soft delete, nullable)

Notes:

- Stage values should align with the pipeline design (new, researching, qualified, etc.).
- `triage_priority` and `triage_reason` store the results of the automated first-pass triage AI.
- Keep Lead focused on stable profile fields and high-level lifecycle flags.

### 5.3 Contact

Essential fields:

- id (PK)
- lead_id (FK -> Lead.id)
- full_name (nullable)
- role_title (nullable)
- email (nullable)
- phone (nullable)
- linkedin_url (nullable)
- other_profile_url (nullable)
- is_primary (bool, default false)
- confidence_level (enum: LOW, MEDIUM, HIGH, UNKNOWN)
- source_type (enum: MANUAL, ENRICHMENT, IMPORT)
- created_by_user_id (FK -> User.id, nullable)
- created_at
- updated_at
- deleted_at (nullable)

Notes:

- A Lead can have 0 or many Contacts.
- primary_email on Lead can mirror a primary Contact or stand alone.

### 5.4 DiscoveryScope

> [!NOTE]
> In the user interface, the **DiscoveryScope** entity is presented to the operator as a **Campaign** (or Outreach Campaign) to provide a linear, folder-based workspace. The underlying database schemas, tables (`discovery_scopes`), and services retain the terminology `Scope` to avoid unnecessary schema migration churn.

Essential fields:

- id (PK)
- name
- description (nullable, text)
- industry_filter (nullable, string or simple list JSON)
- geography_filter (nullable, string or simple list JSON)
- company_size_filter (nullable, string)
- business_type_filter (nullable, string)
- digital_presence_filter (nullable, string — e.g. "weak website", "no social")
- notes (nullable, text)
- created_by_user_id (FK -> User.id)
- created_at
- updated_at

Notes:

- Filters can start as simple text fields; structured filter objects can be introduced later.

### 5.5 CandidateLead

Essential fields:

- id (PK)
- discovery_scope_id (FK -> DiscoveryScope.id, nullable if imported other ways)
- raw_name
- raw_website_url (nullable)
- raw_contact_info (nullable, text/JSON)
- raw_location (nullable)
- notes (nullable)
- status (enum: NEW, REVIEWED, PROMOTED, DISCARDED)
- promoted_lead_id (FK -> Lead.id, nullable)
- created_at
- updated_at

Notes:

- CandidateLead preserves noisy intake before promotion into a structured Lead.

### 5.6 ResearchSnapshot

Essential fields:

- id (PK)
- lead_id (FK -> Lead.id)
- created_by_user_id (FK -> User.id, nullable if AI-generated only)
- origin (enum: MANUAL, AI_GENERATED, IMPORTED)
- snapshot_title (nullable, short label)
- company_summary (nullable, text)
- products_services_summary (nullable, text)
- digital_presence_notes (nullable, text)
- website_notes (nullable, text)
- branding_notes (nullable, text)
- pain_points_hypotheses (nullable, text)
- opportunity_hypotheses (nullable, text)
- sources (nullable, JSON — list of URLs/identifiers)
- confidence_level (enum: LOW, MEDIUM, HIGH, UNKNOWN)
- job_run_id (FK -> JobRun.id, nullable)
- created_at
- updated_at

Notes:

- Use text fields for now; later these can be decomposed further if queries demand it.

### 5.7 Audit

Essential fields:

- id (PK)
- lead_id (FK -> Lead.id)
- created_by_user_id (FK -> User.id, nullable)
- origin (enum: MANUAL, AI_GENERATED)
- website_quality_score (nullable, small int 0–100)
- design_aesthetic_score (nullable, small int 0–100)
- messaging_clarity_score (nullable, small int 0–100)
- social_presence_score (nullable, small int 0–100)
- overall_branding_score (nullable, small int 0–100)
- key_strengths (nullable, text)
- key_weaknesses (nullable, text)
- recommended_improvements (nullable, text)
- opportunity_notes (nullable, text)
- sources (nullable, JSON)
- job_run_id (FK -> JobRun.id, nullable)
- created_at
- updated_at

Notes:

- Scores are optional; they can be added gradually.

### 5.8 LeadScore

Essential fields:

- id (PK)
- lead_id (FK -> Lead.id)
- score_value (int, e.g. 0–100)
- score_label (nullable, e.g. "High", "Medium")
- rationale_summary (nullable, text)
- factors (nullable, JSON — list of factor names/weights)
- origin (enum: RULE_BASED, AI_SUGGESTED, MANUAL_OVERRIDE)
- is_current (bool)  
- created_by_user_id (FK -> User.id, nullable)
- job_run_id (FK -> JobRun.id, nullable)
- created_at
- updated_at

Notes:

- One Lead may have multiple LeadScore records; `is_current` marks the one in effect.

### 5.9 OutreachDraft

Essential fields:

- id (PK)
- lead_id (FK -> Lead.id)
- created_by_user_id (FK -> User.id, nullable)
- channel (enum: EMAIL, WHATSAPP, CALL_PREP, VISIT_PREP, PROPOSAL_NOTES)
- subject_line (nullable, for email-like channels)
- body (text)
- notes_for_sender (nullable, text)
- status (enum: DRAFT, UNDER_REVIEW, APPROVED, REJECTED, USED)
- origin (enum: MANUAL, AI_GENERATED)
- job_run_id (FK -> JobRun.id, nullable)
- created_at
- updated_at

Notes:

- Actual sending is out of scope for early stages; this models preparation only.

### 5.10 Task

Essential fields:

- id (PK)
- lead_id (FK -> Lead.id, nullable for global tasks)
- assignee_user_id (FK -> User.id, nullable)
- title
- description (nullable)
- status (enum: OPEN, IN_PROGRESS, COMPLETED, CANCELED)
- due_at (nullable, datetime)
- completed_at (nullable)
- priority (enum: LOW, MEDIUM, HIGH, CRITICAL)
- created_by_user_id (FK -> User.id)
- created_at
- updated_at

Notes:

- v1 can use simple status; more complex workflows can be layered later.

### 5.11 Activity

Essential fields:

- id (PK)
- lead_id (FK -> Lead.id, nullable for global events)
- actor_user_id (FK -> User.id, nullable)
- type (enum: LEAD_CREATED, LEAD_UPDATED, NOTE_ADDED, TASK_CREATED, TASK_COMPLETED, STAGE_CHANGED, RESEARCH_GENERATED, AUDIT_GENERATED, SCORE_UPDATED, OUTREACH_DRAFT_CREATED, OUTREACH_DRAFT_APPROVED, OUTCOME_LOGGED, OTHER)
- summary (short text)
- details (nullable, text/JSON)
- related_entity_type (nullable, string/enum: LEAD, TASK, RESEARCH_SNAPSHOT, AUDIT, OUTREACH_DRAFT, SCORE, APPROVAL, JOB_RUN, OTHER)
- related_entity_id (nullable)
- created_at

Notes:

- The Activity feed powers the lead timeline.

### 5.12 Approval

Essential fields:

- id (PK)
- target_type (enum: OUTREACH_DRAFT, OTHER)
- target_id
- lead_id (FK -> Lead.id)
- requested_by_user_id (FK -> User.id, nullable)
- approver_user_id (FK -> User.id, nullable)
- status (enum: PENDING, APPROVED, REJECTED)
- decision_reason (nullable, text)
- created_at
- decided_at (nullable)

Notes:

- v1 may only need approvals for OutreachDraft; model is generic for future expansion.

### 5.13 JobRun

Essential fields:

- id (PK)
- job_type (enum: ENRICHMENT, RESEARCH_GENERATION, AUDIT_GENERATION, SCORE_RECALCULATION, REMINDER_PROCESSING, OTHER)
- status (enum: QUEUED, RUNNING, COMPLETED, FAILED, PARTIAL)
- target_lead_id (FK -> Lead.id, nullable)
- triggered_by_user_id (FK -> User.id, nullable)
- error_summary (nullable, text)
- started_at (nullable)
- finished_at (nullable)
- created_at

Notes:

- JobRun connects async work to leads, activities, research snapshots, audits, and scores.

### 5.14 ChatThread (Future Stage)

Essential fields:

- id (PK)
- user_id (FK -> User.id)
- title (nullable, string)
- lead_id (FK -> Lead.id, nullable)
- created_at
- updated_at

Notes:
- Represents an active or historical conversational pilot session.

### 5.15 ChatMessage (Future Stage)

Essential fields:

- id (PK)
- thread_id (FK -> ChatThread.id)
- role (enum: USER, ASSISTANT, SYSTEM)
- content (text)
- tool_calls (nullable, JSON - tracks intent execution)
- created_at

Notes:
- Only supervisor-level interactions are stored. Sub-agent reasoning logs are discarded after completion to save memory and token count.

---

## 6. Pipeline stage model (data view)

The pipeline stage is stored on Lead.stage.

Initial enum suggestion (can be refined later in workflow docs):

- NEW
- RESEARCHING
- QUALIFIED
- OUTREACH_READY
- CONTACTED
- FOLLOW_UP_DUE
- MEETING_SCHEDULED
- PROPOSAL
- WON
- LOST
- PAUSED
- DISQUALIFIED

Supporting table:

- StageHistory (optional separate entity if needed early) with:
  - id (PK)
  - lead_id (FK -> Lead.id)
  - from_stage (nullable)
  - to_stage
  - changed_by_user_id (FK -> User.id, nullable)
  - reason (nullable, text)
  - created_at

If StageHistory is not implemented in v1, plan it early to avoid losing critical lifecycle history.

---

## 7. Data integrity rules

### 7.1 General

- Every entity should include `created_at` and `updated_at`.
- Most mutable entities should support soft delete via `deleted_at` where sensible.
- Foreign keys should enforce referential integrity (cascades chosen carefully).

### 7.2 Human vs machine data

- Prefer not to overwrite human-entered values with machine-generated values.
- When enriching, only fill nulls or store machine values separately.

### 7.3 Activity coverage

- Any major change to Lead, Stage, ResearchSnapshot, Audit, LeadScore, OutreachDraft, and Approval should create an Activity row.

### 7.4 Job run linkage

- ResearchSnapshot, Audit, and LeadScore should link back to the JobRun that produced them when applicable.

---

## 8. AI-related fields

The model needs to capture AI origin and uncertainty without bloating every table.

Patterns used:

- `origin` enum on ResearchSnapshot, Audit, LeadScore, OutreachDraft.
- `confidence_level` on ResearchSnapshot, Contact.
- `sources` JSON on ResearchSnapshot and Audit.
- `job_run_id` FKs to connect generated artifacts to async runs.

This keeps AI awareness where it matters operationally, without making the core profile tables AI-centric.

---

## 9. Minimal Stage 1–3 subset

To execute Stage 1–3, the minimal viable entity set is:

- Stage 1 (Core workspace): User, Lead, Task, Activity (+ StageHistory if added).
- Stage 2 (Discovery): DiscoveryScope, CandidateLead.
- Stage 3 (Research & enrichment): ResearchSnapshot, Contact, JobRun.

Audit, LeadScore, OutreachDraft, Approval can be introduced at Stage 4–5.

---

## 10. Extension guidelines

When extending the data model:

- Add entities only when a real workflow needs them.
- Prefer adding fields over new entities for minor attributes.
- Keep enum values stable; add new values rather than renaming existing ones.
- Use JSON only for genuinely flexible or provider-specific data.
- Avoid premature polymorphic complexity; start simple and refactor when patterns stabilize.

The goal is to keep the schema boring, explicit, and predictable while still supporting the AI-assisted workflows the product needs.

---

## 11. Vector Schema Definitions (Cloudflare Vectorize) (Future Stage)

To support similarity search and RAG retrieval over lead activity records and notes, Vectorize indexes should conform to the following metadata structure:

- **vector_id (PK):** A unique uuid string format (e.g. `lead_note_[uuid]`).
- **values:** Floating-point array matching the embedding model dimension (e.g., 768 for `@cf/baai/bge-large-en-v1.5` or 1536 for Gemini embeddings).
- **metadata:** JSON object storing indexing provenance:
  - `lead_id` (FK -> Lead.id, absolute string reference)
  - `content_type` (enum: `RESEARCH_SUMMARY`, `AUDIT_NOTES`, `ACTIVITY_LOG`, `USER_NOTE`)
  - `raw_text_snippet` (truncated preview string for UI rendering)
  - `indexed_at` (timestamp)
