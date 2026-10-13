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
  - RETAINED IN DB FOR COMPATIBILITY ONLY. No UI since Oct 2026 (routes deleted, redirects to `/scopes`).
  - Do not build new features on it. `prospects.market_id` and `discovery_scopes.market_id` are optional legacy metadata.
  - Fields: `id`, `workspace_id`, `name`, `icp_profile_id`, `offer_id`, `status`.

### 1.2 Execution & Leads

- `prospects` (Replaces legacy `leads`; canonical detail page `/prospects/[id]`)
  - A potential customer account.
  - Fields: `id`, `name`, `company`, `website`, `stage`, `status`, `workspace_id`, `market_id` (optional), `fit_score` (Int), `confidence_score` (Int), `priority_tier` (tier1/tier2/tier3/disqualified), `disqualified_reason` (Text), `fit_reasoning` (JSON), `owner_id`.
  - List defaults to newest-first with a Top Fit toggle; filters (tier/stage/search/sort) are applied server-side with Load More pagination.

- `contacts`
  - People associated with a prospect.
  - Fields: `id`, `prospect_id`, `name`, `role`, `confidence_level`, `source_url`.

### 1.2b Discovery & Lead Sourcing

- `discovery_scopes`
  - Defines a search criteria for finding new prospects. Surfacing UI: `/scopes` (Discovery).
  - Fields: `id`, `name`, `description`, `industry_filter`, `geography_filter`, `company_size_filter`, `business_type_filter`, `digital_presence_filter`, `notes`, `workspace_id`, `market_id` (legacy, nullable), `auto_research_promoted_leads` (boolean), `created_by_user_id`, `created_at`, `updated_at`.

- `candidate_leads`
  - Raw, unprocessed leads returned by a discovery search (e.g., Apify Google Maps).
  - Fields: `id`, `discovery_scope_id`, `raw_name`, `raw_website_url`, `raw_contact_info`, `raw_location`, `notes`, `status` (NEW, REVIEWED, PROMOTED, DISCARDED), `discard_reason` (captured when user discards a candidate), `promoted_lead_id`, `created_at`, `updated_at`.
  - Candidates are reviewed by the user and either promoted (converted to a `prospect` with 4 research tasks) or discarded (with an optional reason for the learning loop).

### 1.3 Agentic Research Engine

- `research_tasks`
  - A discrete job executed by Cloudflare Workflows (via the simulation shim).
  - Fields: `id`, `prospect_id`, `task_type` (Enum: WEBSITE_ANALYST, ICP_FIT, PAIN_EXTRACTOR, DISQUALIFIER_CHECK), `status` (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED), `raw_artifacts` (JSON), `extracted_signals` (JSON arrays linking claims to source evidence).
  - The Research Queue UI groups the (up to 4) tasks per prospect into one row. Cancelling writes CANCELLED, never FAILED.

- `signals` (Can be a table or JSON embedded in `research_tasks`/`prospects`)
  - Extracted evidence that influences the Fit Score.
  - Fields: `prospect_id`, `signal_name`, `matched_icp_rule`, `evidence_quote`, `source_url`.

### 1.4 Outreach & Approvals

- `outreach_drafts`
  - AI-generated messages pending human approval.
  - Fields: `id`, `prospect_id` (column name `lead_id`, legacy), `contact_id`, `channel`, `subject`, `draft_content` (Text), `cited_evidence` (JSON array of references), `risk_flags` (JSON array of warnings), `approval_status` (DRAFT, APPROVED, REJECTED, SENT), `rejection_reason` (Text).
  - The Outreach Drafts queue (`/approvals`) lists DRAFT + APPROVED + REJECTED; marking SENT fires an outcome-logging nudge.

- `approvals`
  - Immutable audit trail of human actions on drafts.
  - Fields: `id`, `draft_id`, `user_id`, `action` (APPROVED, REJECTED), `timestamp`, `notes`.

### 1.5 Pipeline & Learning

- `outcomes`
  - Tracks the real-world result of an approved outreach.
  - Fields: `id`, `prospect_id`, `outcome_type` (Enum: REPLIED, MEETING_BOOKED, BOUNCED, NOT_INTERESTED, WON, LOST), `timestamp`.

- `learning_suggestions`
  - System-generated recommendations to adjust the ICP Profile based on outcomes.
  - Fields: `id`, `workspace_id`, `suggested_change` (JSON), `supporting_evidence` (Text), `status` (PENDING, APPLIED, DISMISSED).

---

## 2. Key Relationships

- A `workspace` has many `offers` and `icp_profiles`.
- `prospects` optionally carry a legacy `market_id`; nothing requires it.
- Candidates are reviewed in Discovery and either promoted (converted to a `prospect` with 4 research tasks + auto-started research when a website exists) or discarded with a reason.
- A `prospect` has many `research_tasks` running asynchronously.
- The output of `research_tasks` populates the `fit_score` and `outreach_drafts` for the `prospect`.
- An `outreach_draft` must have an associated `approvals` record before its content can be transmitted.
- An `outcome` feeds back into `learning_suggestions` for the `workspace`.

---

## 3. Storage Patterns

- **Raw Data vs. Structured Data:** HTML snapshots or raw LLM completions are stored in `raw_artifacts` (JSON blob) in the `research_tasks` table. Clean, validated data (e.g., specific pain points) are stored in `extracted_signals` for direct UI rendering and deterministic scoring.
- **Traceability:** Every `outreach_draft` explicitly stores the `cited_evidence` JSON array locally, so even if the underlying `research_tasks` are pruned, the draft's justification remains historically intact.
