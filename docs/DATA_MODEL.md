# DATA_MODEL.md

## 1. Domain Entities & Schema Overview

The database schema is structured around a multi-tenant Workspace model, separating the configuration of the sales strategy (Offers, ICPs) from the operational execution (Prospects, Research, Outreach).

Database Engine: Cloudflare D1 (SQLite). ORM: Drizzle.

### 1.1 Strategy & Configuration

- `workspaces`
  - Defines an isolated agency or founder instance.
  - Fields: `id`, `name`, `created_at`, `updated_at`.

- `offers`
  - Defines the value proposition the Workspace is selling.
  - Fields: `id`, `workspace_id`, `name`, `target_pain`, `desired_outcome`, `proof_points`, `forbidden_claims`.

- `icp_profiles`
  - Defines what a "good fit" prospect looks like.
  - Fields: `id`, `workspace_id`, `name`, `positive_signals` (JSON array with weights), `negative_signals` (JSON array with weights), `disqualifiers` (JSON array).

- `markets`
  - The segments being targeted for exploration.
  - Fields: `id`, `workspace_id`, `name`, `icp_profile_id`, `offer_id`, `status`.

### 1.2 Execution & Leads

- `prospects` (Replaces legacy `leads`)
  - A potential customer account.
  - Fields: `id`, `market_id`, `company_name`, `domain`, `status`, `fit_score` (Int), `confidence_score` (Int), `priority_tier` (Enum), `disqualified_reason` (Text), `owner_id`.

- `contacts`
  - People associated with a prospect.
  - Fields: `id`, `prospect_id`, `name`, `role`, `confidence_level`, `source_url`.

### 1.3 Agentic Research Engine

- `research_tasks`
  - A discrete job executed by Cloudflare Workflows.
  - Fields: `id`, `prospect_id`, `task_type` (Enum: WEBSITE_ANALYST, ICP_FIT, PAIN_EXTRACTOR), `status` (PENDING, RUNNING, COMPLETED, FAILED), `raw_artifacts` (JSON), `extracted_signals` (JSON arrays linking claims to source evidence).

- `signals` (Can be a table or JSON embedded in `research_tasks`/`prospects`)
  - Extracted evidence that influences the Fit Score.
  - Fields: `prospect_id`, `signal_name`, `matched_icp_rule`, `evidence_quote`, `source_url`.

### 1.4 Outreach & Approvals

- `outreach_drafts`
  - AI-generated messages pending human approval.
  - Fields: `id`, `prospect_id`, `contact_id`, `draft_content` (Text), `cited_evidence` (JSON array of references), `risk_flags` (JSON array of warnings), `approval_status` (DRAFT, NEEDS_REVIEW, APPROVED, REJECTED), `rejection_reason` (Text).

- `approval_logs`
  - Immutable audit trail of human actions on drafts.
  - Fields: `id`, `draft_id`, `user_id`, `action` (APPROVED, REJECTED), `timestamp`, `notes`.

### 1.5 Pipeline & Learning

- `outcomes`
  - Tracks the real-world result of an approved outreach.
  - Fields: `id`, `prospect_id`, `outcome_type` (Enum: REPLIED, MEETING_BOOKED, BOUNCED, NOT_INTERESTED), `timestamp`.

- `learning_suggestions`
  - System-generated recommendations to adjust the ICP Profile based on outcomes.
  - Fields: `id`, `workspace_id`, `suggested_change` (JSON), `supporting_evidence` (Text), `status` (PENDING, APPLIED, DISMISSED).

---

## 2. Key Relationships

- A `workspace` has many `offers` and `icp_profiles`.
- A `market` binds an `offer` and an `icp_profile` together to define a campaign.
- `prospects` belong to a `market`.
- A `prospect` has many `research_tasks` running asynchronously.
- The output of `research_tasks` populates the `fit_score` and `outreach_drafts` for the `prospect`.
- An `outreach_draft` must have an associated `approval_log` before its content can be transmitted.
- An `outcome` feeds back into `learning_suggestions` for the `workspace`.

---

## 3. Storage Patterns

- **Raw Data vs. Structured Data:** HTML snapshots or raw LLM completions are stored in `raw_artifacts` (JSON blob) in the `research_tasks` table. Clean, validated data (e.g., specific pain points) are stored in `extracted_signals` for direct UI rendering and deterministic scoring.
- **Traceability:** Every `outreach_draft` explicitly stores the `cited_evidence` JSON array locally, so even if the underlying `research_tasks` are pruned, the draft's justification remains historically intact.
