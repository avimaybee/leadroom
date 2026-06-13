# ARCHITECTURE.md — System Architecture

## Document status

- Status: Draft v1.
- Scope: Baseline architecture for internal-first implementation of AI Agency Growth OS.
- Companion docs: `AGENTS.md`, `PRD.md`, `PLAN.md`.
- Audience: founder, coding agents, future engineering contributors.

This document defines the system shape, module boundaries, data flow, runtime responsibilities, and architectural constraints for the product.

It is intentionally biased toward a practical, low-risk architecture that supports staged delivery.

***

## 1. Architectural intent

The architecture must support a product that is:

- internal-first.
- workflow-driven.
- AI-assisted but not AI-dependent.
- traceable.
- incrementally extensible.
- safe to evolve.

The architecture must make it easy to:

- ship small working stages.
- store business-critical state reliably.
- run slow enrichment or AI tasks asynchronously.
- preserve history and approvals.
- maintain human control over sensitive actions.

The architecture must not optimize prematurely for:

- massive scale.
- external multi-tenancy.
- aggressive automation.
- distributed service sprawl.

***

## 2. Architectural principles

### 2.1 Modular monolith first

The application should be implemented as a **modular monolith**.

Reason:

- the product is early and evolving.
- the operational workflow matters more than infrastructure complexity.
- module boundaries are important now, network boundaries are not.
- the team is small and agent-driven.
- distributed systems would add unnecessary operational risk.

### 2.2 Explicit workflow state

Critical business processes must be modeled through explicit states and transitions, not ad hoc flags scattered through the codebase.

### 2.3 Human authority over external action

AI may recommend, draft, summarize, classify, and prioritize.

Humans must approve sensitive actions.

### 2.4 Structured outputs over freeform output

Whenever an AI or background process produces business-critical information, it should produce structured data plus human-readable explanation where possible.

### 2.5 Historical trace over overwrite bias

The architecture should preserve meaningful history for research, audits, approvals, and stage changes.

### 2.6 Async for uncertain and slow operations

Enrichment, research generation, audits, reminders, and future orchestration flows should run in background jobs.

### 2.7 Replaceability by boundary

External dependencies such as model providers, enrichment sources, email providers, and search providers must sit behind adapter boundaries.

***

## 3. High-level system view

The system should have five architectural layers.

### 3.1 Presentation layer

Purpose:

- render dashboard, lists, detail pages, forms, review screens, and task views.
- capture operator input.
- show system state, job status, and evidence.

Examples:

- lead list UI.
- lead detail page.
- research view.
- audit review UI.
- outreach draft review UI.
- task/reminder views.
- dashboard.

### 3.2 Application layer

Purpose:

- coordinate use cases.
- enforce workflow steps.
- validate permissions and approvals.
- orchestrate domain services and repositories.
- dispatch background jobs.

Examples:

- create lead.
- move lead stage.
- request research snapshot generation.
- create outreach draft.
- approve outreach draft.
- add note.
- complete task.

### 3.3 Domain layer

Purpose:

- contain business rules and core concepts.
- model state transitions.
- express scoring logic.
- express approval requirements.
- define invariants.

Examples:

- lead lifecycle rules.
- task status rules.
- approval transition rules.
- scoring rationale rules.
- activity creation rules.

### 3.4 Infrastructure layer

Purpose:

- database access.
- background job execution.
- model provider calls.
- external API access.
- logging and observability.
- auth/session integration.

Examples:

- lead repository.
- research snapshot repository.
- queue handlers.
- LLM adapter.
- enrichment provider adapter.
- email provider adapter if later introduced.

### 3.5 Persistence layer

Purpose:

- durable storage of business records and system events.

Examples:

- relational tables.
- job records.
- activity records.
- generated artifact records.
- audit trail records.

***

## 4. Top-level runtime components

The architecture should be implemented with these major runtime components.

### 4.1 Web application

Responsibilities:

- authenticated operator access.
- UI rendering.
- request handling.
- invoking application services.
- surfacing job state and business state.

### 4.2 Database

Responsibilities:

- persistence of all core records.
- transactional consistency for workflow operations.
- query support for dashboard and lead views.
- historical trace storage.

### 4.3 Background job worker (Cloudflare Workflows)

Responsibilities:

- execute long-running tasks via durable `@cloudflare/workflows`.
- break complex operations (e.g., fetch site -> call LLM) into isolated `step()` functions using `step.sleep()` for polling and `step.waitForEvent()` for approvals.
- run native edge scraping using Cloudflare Browser Run for deep website research and audits.
- retry safe operations where appropriate without failing the entire job.
- update run status in the `job_runs` table.
- persist partial and final outputs.
- record failures cleanly and ensure the UI can poll for completion.

### 4.4 AI service adapter layer

Responsibilities:

- centralize model invocation.
- define prompt/input contracts.
- validate structured outputs.
- normalize provider responses.
- isolate the rest of the system from provider changes.

### 4.5 Integration adapter layer

Responsibilities:

- connect to external enrichment or communication providers.
- use Apify for broad candidate discovery and list generation (Stage 2).
- use Cloudflare Browser Run (Playwright) for deep individual website fetching and rendering (Stage 3 & 4).
- enforce provider-specific constraints.
- normalize outputs into internal shapes.

### 4.6 Observability subsystem

Responsibilities:

- logs.
- job status records.
- error tracking.
- audit-friendly event capture.

***

## 5. Recommended module map

These are the recommended internal modules of the modular monolith.

### 5.1 Identity module

Responsibilities:

- internal authentication.
- session/user context.
- future role support if needed.

### 5.2 Leads module

Responsibilities:

- lead creation.
- lead profile updates.
- lead listing and filtering.
- lead ownership.
- lead archival.

### 5.3 Contacts module

Responsibilities:

- contact records linked to leads.
- contact methods.
- role or title fields where available.
- verification/confidence indicators later.

### 5.4 Discovery module

Responsibilities:

- discovery scopes.
- candidate lead intake.
- source attribution.
- candidate-to-lead promotion.

### 5.5 Research module

Responsibilities:

- enrichment runs.
- research snapshots.
- source references.
- run timestamps.
- generated summary storage.

### 5.6 Audit module

Responsibilities:

- website and digital presence audits.
- issue/opportunity findings.
- audit versioning over time.

### 5.7 Scoring module

Responsibilities:

- lead score calculation.
- rationale storage.
- manual overrides.
- score history.

### 5.8 Outreach module

Responsibilities:

- outreach drafts.
- channel-specific preparation.
- draft regeneration.
- approval linkage.
- future send-prep boundaries.

### 5.9 Pipeline module

Responsibilities:

- stage definitions.
- stage transitions.
- transition rules.
- lost/paused/disqualified logic.

### 5.10 Tasks module

Responsibilities:

- tasks.
- reminders.
- due dates.
- completion state.
- future next-best-action suggestions.

### 5.11 Notes and Activity module

Responsibilities:

- operator notes.
- activity feed.
- chronological history of important actions.
- cross-module event recording.

### 5.12 Approval module

Responsibilities:

- approval state.
- approval decisions.
- review checkpoint logic.
- future policy hooks.

### 5.13 AI module

Responsibilities:

- prompt assembly.
- model requests.
- response parsing.
- schema validation.
- shared AI generation policies.

### 5.14 Job module

Responsibilities:

- job dispatch.
- job state persistence.
- retries.
- worker coordination.

### 5.15 Reporting module

Responsibilities:

- dashboard queries.
- KPI rollups.
- funnel metrics.
- workload visibility.

***

## 6. Primary data flow

The main architecture revolves around the lead.

### 6.1 Lead-centric flow

1. A lead is created manually or promoted from discovery.
2. The lead becomes the anchor record.
3. Supporting records attach to the lead over time.
4. History accumulates rather than being lost.
5. Recommendations and drafts are generated from the current and historical lead context.
6. Human actions push the lead through the pipeline.

### 6.2 Attached record families

A lead can accumulate:

- contacts.
- notes.
- tasks.
- stage history.
- research snapshots.
- audits.
- scores.
- outreach drafts.
- approvals.
- activity events.

### 6.3 Design implication

Most business screens and operations should be centered around a lead record, not around abstract AI sessions or isolated outputs.

***

## 7. Request-response vs background execution

### 7.1 Synchronous operations

These should usually happen in request-response flow:

- create lead.
- edit lead.
- add note.
- create task.
- complete task.
- move stage.
- approve draft.
- archive lead.

### 7.2 Asynchronous operations

These should usually happen as background jobs:

- enrichment.
- research snapshot generation.
- website audit generation.
- score recalculation when expensive.
- reminder processing.
- future outbound preparation workflows.

### 7.3 Why this split exists

It prevents the UI from blocking on slow, failure-prone, or provider-dependent work.

It also makes retries, observability, and partial success handling more tractable.

***

## 8. Core entity architecture

This section defines the architectural role of each major entity family.

### 8.1 Lead

The lead is the central business object.

It represents a business opportunity under evaluation or pursuit.

Architectural rules:

- every major workflow should anchor to a lead.
- a lead should remain meaningful even with incomplete enrichment.
- the current lead state should be easy to query.
- important lifecycle changes should be historized.

### 8.2 Contact

A contact represents a person or reachable channel associated with a lead.

Architectural rules:

- contacts may be partial.
- multiple contacts may exist per lead.
- contact confidence and verification may evolve later.

### 8.3 Discovery scope and candidate lead

A discovery scope defines targeting intent.

A candidate lead represents a business discovered before full promotion.

Architectural rules:

- do not collapse early discovery noise directly into active leads without a review step.
- source attribution should be preserved.

### 8.4 Research snapshot

A research snapshot is a time-bound summary of what the system found.

Architectural rules:

- snapshots should be historical.
- they should store creation time.
- they should preserve evidence links where possible.
- they should be editable or annotatable by humans.

### 8.5 Audit

An audit is a structured evaluation of website, brand, messaging, and digital presence.

Architectural rules:

- audits should support multiple findings.
- audits should be versionable over time.
- audit findings should be usable by scoring and outreach modules.

### 8.6 Score record

A score record captures a priority assessment.

Architectural rules:

- score rationale should be visible.
- score history should be preserved at least for material recalculations.
- manual override should not destroy machine rationale.

### 8.7 Outreach draft

An outreach draft is a prepared communication artifact.

Architectural rules:

- drafts must be editable.
- drafts must be linked to a channel and lead.
- drafts should preserve approval state.
- drafts should never imply a sent state unless integrated sending exists later.

### 8.8 Task

A task represents a required operator action.

Architectural rules:

- tasks should be first-class records, not embedded text reminders.
- due dates and completion state should be queryable.

### 8.9 Activity event

An activity event is the trace record of something meaningful that happened.

Architectural rules:

- use activity events for cross-cutting traceability.
- activity should be chronological and attributable.
- not every UI micro-event needs activity logging, only business-significant actions.

### 8.10 Approval record

An approval record captures a review decision.

Architectural rules:

- approvals should be durable and attributable.
- approval should be modeled separately from the object being approved.
- approval status changes should be historical.

### 8.11 Job run

A job run captures async execution state.

Architectural rules:

- jobs need target record linkage.
- jobs need status, timestamps, and error summaries.
- jobs should support retries where safe.

***

## 9. State architecture

### 9.1 Why explicit state matters

The product is workflow-driven.

Therefore state must be modeled clearly rather than spread across many inferred conditions.

### 9.2 Core state families

The architecture should expect explicit state for at least:

- lead stage.
- task status.
- outreach draft status.
- approval status.
- job status.
- enrichment status.
- audit status if generation is asynchronous.

### 9.3 State transition guidance

Transitions should be handled through application services, not random field edits from anywhere in the system.

Examples:

- `moveLeadStage(...)`
- `approveOutreachDraft(...)`
- `markTaskComplete(...)`
- `requestResearchSnapshot(...)`
- `recordResearchFailure(...)`

### 9.4 Historical transition rule

When state changes matter operationally, the system should preserve the transition history, not only the current value.

***

## 10. AI architecture

AI is an internal capability layer composed of generation workflows plus validation and storage.

### 10.1 AI responsibilities

The AI layer may:

- summarize public business information.
- generate research snapshots.
- produce audit suggestions.
- generate opportunity hypotheses.
- draft outreach content.
- propose next-best actions.

### 10.2 AI non-responsibilities

The AI layer must not:

- own final lead qualification.
- silently mutate important business records without trace.
- send external communications automatically.
- bypass approval logic.
- create fake confidence where data is weak.

### 10.3 AI invocation pattern

Recommended pattern:

1. application service validates the request.
2. application service creates a job or invokes an AI service directly if fast and safe.
3. AI module assembles structured input.
4. provider adapter performs model call.
5. response is validated against expected schema.
6. result is stored in domain-specific tables.
7. activity and job status are updated.
8. UI surfaces result for review.

### 10.4 Structured output rule

AI outputs should be mapped into typed fields whenever business logic depends on them.

Freeform text may accompany structured output, but should not replace it.

### 10.5 Prompt boundary rule

Prompt construction belongs in the AI module or dedicated generation services.

It must not be duplicated across UI routes or components.

### 10.6 Conversational Pilot Interface (Future Stage)

To support natural language operations while retaining consistency:
- **"Chat + Canvas" Hybrid:** The UI renders a conversational chat panel side-by-side with a traditional, structured dashboard. Chat commands drive deterministic mutations via existing backend services rather than mutating database tables directly.
- **Explicit Gating:** The supervisor agent can propose mutations or data entries (e.g. outreach templates, status adjustments), but they must be rendered as reviewable cards in the UI requiring explicit operator confirmation before they are committed to the relational database.

### 10.7 Multi-Provider Orchestration & Memory Pruning (Future Stage)

To remain highly cost-efficient and limit token rate limit (RPM/TPM) bottlenecks on free/low-cost tiers:
- **Hierarchical Routing:** A central, highly intelligent Supervisor model (e.g. Gemini Pro or DeepSeek Chat) handles user intent classification and plans workflow steps.
- **Task Farm Execution:** Specific jobs (such as triage checks, website audits, or copy generation) are farmed out to dedicated sub-agents running on fast, free, or hyper-cheap endpoints (Groq, Nvidia NIM, OpenRouter free models).
- **Sub-Agent Context Discarding:** To prevent massive token accumulation in the Supervisor's chat history, sub-agents run in isolated, single-turn sessions. Once a sub-agent completes a task and returns its structured output to the Supervisor, its entire raw context (scraped content, intermediate thinking logs) is discarded. Only the final structured data is appended to the main Supervisor history.
- **Provider Redundancy/Failover:** If an active provider (e.g. Gemini API) hits its free-tier rate limits, the orchestrator service automatically routes subsequent task requests to backup providers (e.g. Groq or DeepSeek) using configured API failover priorities.

### 10.8 Vector Embeddings Layer (Cloudflare Vectorize) (Future Stage)

To support semantic query capability and contextual grounding:
- **Cloudflare Vectorize Binding:** Store high-dimensional embeddings for lead details, activity timelines, research notes, and website audit findings.
- **Workers AI Embedding Model:** Utilize a lightweight, free-tier embedded model (e.g. `@cf/baai/bge-large-en-v1.5`) or Gemini Embeddings to generate vectors asynchronously.
- **Grounding retrieval (RAG):** The conversational pilot uses Vectorize to perform similarity searches over historical lead records and appends matching entries to the Supervisor's context during complex reasoning turns.

***

## 11. Integration architecture

External integrations must be treated as replaceable adapters.

### 11.1 Integration classes

Expected classes of integrations:

- enrichment or public data providers.
- website/content fetchers if approved.
- email or communication providers later.
- file/document generation later.
- analytics or observability tools.

### 11.2 Adapter rule

Each external integration should have:

- a narrow interface.
- normalized internal output shape.
- error mapping.
- retry policy where appropriate.
- configuration boundary.

### 11.3 Anti-coupling rule

No domain module should depend directly on raw provider response formats.

Normalize once, then pass internal data shapes through the application.

***

## 12. Persistence architecture

### 12.1 Database role

The relational database is the source of truth for core business state.

### 12.2 Storage classes

Store these categories explicitly:

- current business records.
- historical records.
- generated artifacts.
- approvals.
- activities.
- async job runs.
- integration metadata where useful.

### 12.3 In-place vs historical storage

The architecture should distinguish between:

#### Current-state records

Examples:

- lead profile.
- active task status.
- current pipeline stage.

#### Historical records

Examples:

- stage transitions.
- research snapshots.
- audits.
- approvals.
- job runs.
- meaningful score changes.

### 12.4 Provenance storage

Where possible, generated or imported data should keep metadata such as:

- source label.
- generation or fetch timestamp.
- provider.
- confidence marker if applicable.
- manual override marker.

***

## 13. Activity and auditability architecture

### 13.1 Required business traceability

The system should make it possible to answer:

- who changed this lead?
- when was this summary generated?
- why did this score change?
- who approved this draft?
- what happened before the lead moved stages?
- what failed in the enrichment process?

### 13.2 Activity log approach

Use an activity/event model for business-significant actions.

Likely events include:

- lead created.
- lead updated.
- note added.
- task created/completed.
- stage changed.
- research generated.
- audit generated.
- score updated.
- draft created.
- draft approved.
- reminder triggered.

### 13.3 Benefits

This supports:

- lead history UI.
- debugging.
- operator trust.
- future reporting.
- future compliance review.

***

## 14. Approval architecture

Approval is not just a UI button. It is a business control layer.

### 14.1 Approval targets

Initial likely approval targets:

- outreach drafts.
- future send-capable actions.
- possibly score overrides if policy later requires.

### 14.2 Modeling rule

Approval should be modeled as its own durable concept with:

- target object type.
- target object id.
- requested state.
- decision state.
- reviewer.
- timestamp.
- comments if needed.

### 14.3 Why separate modeling matters

This makes approvals:

- queryable.
- historized.
- auditable.
- reusable across modules.

***

## 15. Background job architecture

### 15.1 Job categories

Likely job categories include:

- lead enrichment run.
- research generation run.
- audit generation run.
- score recalculation run.
- reminder dispatch run.
- future workflow recommendation run.

### 15.2 Job lifecycle

Each job should move through explicit statuses such as:

- queued.
- running.
- completed.
- failed.
- canceled.
- partial-success when appropriate.

### 15.3 Idempotency rule

Jobs should be designed so retries do not corrupt core business records.

### 15.4 Result write rule

Long-running jobs should write results through application/domain services or controlled repositories, not by bypassing business logic entirely.

***

## 16. Security architecture baseline

This is an internal system, but it still needs real security boundaries.

### 16.1 Minimum requirements

- authenticated access.
- protected routes and operations.
- safe secret storage.
- restricted integration credentials.
- controlled mutation paths.
- server-side validation.

### 16.2 Sensitive action rule

Any action that could affect external communication, business-critical records, or approval state must be server-validated.

### 16.3 Future-proofing

Even if v1 is single-operator or tiny-team, the architecture should not assume universal trust forever.

***

## 17. Reporting architecture

### 17.1 Reporting source

Dashboards and reporting should read from operational tables first.

Do not introduce separate analytics infrastructure early unless performance or complexity forces it.

### 17.2 Early report categories

- leads by stage.
- overdue tasks.
- high-priority leads.
- recent research activity.
- outreach-ready leads.
- recent wins/losses.

### 17.3 Later expansion

If reporting becomes heavy, introduce derived tables or materialized views before adding a separate analytics stack.

***

## 18. Error handling architecture

### 18.1 Error classes

Architecturally distinguish between:

- validation errors.
- domain rule violations.
- integration/provider errors.
- async job failures.
- permission/approval errors.
- not-found errors.

### 18.2 UX requirement

Errors should surface in ways operators can act on.

Examples:

- retry enrichment.
- correct invalid lead data.
- request approval again.
- inspect failed job summary.

### 18.3 Persistence rule

Important background or integration failures should be persisted in job or activity state rather than disappearing into logs only.

***

## 19. Performance architecture baseline

### 19.1 Performance priorities

Optimize first for:

- fast lead list loads.
- fast lead detail loads.
- responsive note/task/stage updates.
- non-blocking generation flows.

### 19.2 Query strategy guidance

- keep current-state queries straightforward.
- index common filters.
- separate expensive reporting queries if needed.
- paginate large lead lists.

### 19.3 Avoid early over-optimization

Do not add caching layers or distributed infrastructure until a real bottleneck exists.

***

## 20. Architectural decisions already implied

The following decisions are considered active unless a later ADR changes them.

1. The product will use a modular monolith, not microservices.
2. The database is the source of truth for core business state.
3. Long-running AI and enrichment work runs asynchronously.
4. AI access is centralized behind a service boundary.
5. Approvals are modeled as first-class records.
6. Important workflow changes are historized.
7. Human-reviewed data has higher authority than machine-inferred data.
8. The system is internal-first and not multi-tenant by default.

These should later be formalized in ADRs.

***

## 21. What must not happen architecturally

Agents must not:

- introduce microservices without explicit approval.
- spread business logic into UI components.
- call model providers directly from many unrelated places.
- store important generated artifacts only as untyped blobs.
- make async jobs mutate critical state without trace.
- collapse approvals into ad hoc boolean flags everywhere.
- couple domain logic directly to provider-specific response shapes.
- make chat threads the hidden source of truth for business workflows.

***

## 22. Next architecture documents to create later

After this baseline architecture, the next supporting architecture docs should likely be:

- `DATA_MODEL.md`.
- `WORKFLOW_ARCHITECTURE.md`.
- `AI_ORCHESTRATION.md`.
- `SECURITY_PRIVACY.md`.
- `ADR/0001-modular-monolith.md`.
- `ADR/0002-async-jobs-for-ai-and-enrichment.md`.

***

## 23. Final architectural rule

The architecture is successful if it makes the product easier to build correctly in stages.

If a proposed architectural change makes the system more impressive on paper but harder to understand, test, or operate, reject it.