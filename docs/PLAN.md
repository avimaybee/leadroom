# PLAN.md — Technical Implementation Plan

## Document status

- Status: Active v1 (Stages 1-5 Completed).
- Scope: Technical implementation plan for the internal-first build of AI Agency Growth OS.
- Companion docs: `AGENTS.md`, `PRD.md`.
- Audience: founder, coding agents, future engineering contributors.

This document translates product intent into an execution plan that coding agents can follow stage by stage.

***

## 1. Planning intent

This product will be built through **sequential, validated stages**.

The plan is intentionally conservative.

The goal is not to build the most ambitious AI-native sales platform as fast as possible. The goal is to build a reliable internal business system where each stage is independently useful, testable, and safe to extend.

Every stage must satisfy three conditions before the next stage begins:

1. The workflow works end to end.
2. The data model remains coherent.
3. The user would realistically use the feature in a live agency workflow.

***

## 2. Delivery strategy

### 2.1 Core build philosophy

Use a **spec-first, stage-first, workflow-first** delivery model.

Meaning:

- specs define the intended behavior before implementation.
- each stage produces a working vertical slice.
- workflow integrity matters more than feature count.
- agents should implement narrow, reviewable increments.
- product risk should be retired from highest to lowest.

### 2.2 What gets built first

Build the operational backbone before the AI-heavy layers.

Reason:

- without stable lead records, task tracking, status history, and workflow state, AI outputs have nowhere reliable to live.
- if the operational spine is weak, later enrichment, scoring, and outreach assistance will create noise instead of leverage.

### 2.3 Implementation principle

For any feature, agents should prefer:

- explicit state over implicit behavior.
- structured outputs over freeform blobs.
- manual triggers before automation.
- async jobs for slow work.
- revision-safe data models.
- explainable rules before opaque heuristics.

***

## 3. Recommended system shape

Until `ARCHITECTURE.md` exists in more detail, implementation should assume the following baseline shape.

### 3.1 Application style

Use a **modular monolith**.

Rationale:

- the product is internal-first.
- the team is small.
- the workflow is evolving.
- orchestration complexity already exists at the product layer.
- splitting into services too early would add failure points and coordination cost.

### 3.2 High-level modules

Implement the system as a single app with clearly separated modules:

- auth and user context.
- organizations or workspace context if needed later.
- leads.
- contacts.
- research snapshots.
- audits.
- scoring.
- outreach drafts.
- pipeline stages.
- tasks and reminders.
- notes and activity log.
- approvals.
- background jobs.
- dashboards and reporting.

### 3.3 Runtime split

The app should support two runtime modes:

- synchronous request-response for normal UI actions.
- asynchronous background execution for enrichment, audits, generation, and long-running processing.

### 3.4 Persistence bias

Default to relational persistence for core business records.

Reason:

- lead state, history, tasks, approvals, and workflow transitions are structured and relational.
- traceability is easier with relational models.
- reporting and filtering are easier with relational models.

***

## 4. Recommended stack

This is the default technical direction unless later docs explicitly change it.

### 4.1 Frontend

- Next.js app router.
- React.
- TypeScript.
- Tailwind CSS.
- component layer with a consistent internal design system.
- server actions or typed API routes where appropriate.

### 4.2 Backend

Use the Next.js server layer initially, with a clean boundary between UI, domain logic, and data access.

If the app outgrows this shape later, domain modules can be extracted without changing the product model.

### 4.3 Database

- SQLite (Cloudflare D1, via Drizzle ORM's sqliteTable).
- Prisma or Drizzle as the ORM and schema layer.

### 4.4 Auth

- simple authenticated internal access.
- use a proven auth solution, not custom auth from scratch.

### 4.5 Background jobs

Use Cloudflare Workflows (`@cloudflare/workflows`) for durable, step-by-step execution of:

- enrichment runs (website fetching -> LLM processing).
- research generation.
- audits.
- score recalculation.
- reminders.
- future scheduled workflows.

Cloudflare Workflows ensure that slow operations (like LLM API calls) do not hit the standard 30-second serverless HTTP timeout and can safely retry individual steps.

### 4.6 AI integration

Keep AI access behind a dedicated service layer.

Never scatter model calls directly across components or route handlers.

### 4.7 Observability

At minimum include:

- structured application logs.
- error tracking.
- job run status.
- audit trail for important business actions.

***

## 5. Technical rules for agents

### 5.1 Code organization rules

Agents must keep these layers separate:

- UI layer.
- application/service layer.
- domain logic.
- persistence/repository layer.
- AI provider layer.
- background job handlers.

Do not place business rules directly inside presentational components.

Do not place prompt assembly logic directly inside UI components.

Do not place database access directly inside multiple unrelated modules without an abstraction boundary.

### 5.2 Data mutation rules

All important mutations should be explicit and reviewable.

Prefer named operations such as:

- create lead.
- update lead profile.
- add note.
- generate research snapshot.
- approve outreach draft.
- move pipeline stage.
- complete task.

Avoid hidden side effects that mutate many records without clear operator intent.

### 5.3 AI operation rules

Every AI feature must expose:

- triggering event.
- required input data.
- output schema.
- storage target.
- fallback behavior.
- approval requirement if applicable.
- observability trail.

### 5.4 Schema evolution rules

Agents must plan for schema change over time.

Therefore:

- use explicit migration tooling.
- avoid storing all valuable output in unstructured blobs.
- use typed enums carefully and expect lifecycle changes.
- store timestamps for generated artifacts.
- store version or generation metadata where useful.

***

## 6. Core workflow architecture to implement first

The first real system is not discovery or AI generation.

The first real system is a stable **lead operating workflow**.

### 6.1 Backbone workflow

The minimum backbone is:

1. lead exists.
2. lead can be viewed in a list.
3. lead can be opened in detail view.
4. lead can hold notes, tasks, and status.
5. lead changes create visible history.
6. lead has a clear next step.

If these are not solid, later stages should not proceed.

### 6.2 Why this comes first

This removes the risk of building AI functions into a weak operational shell.

Without the backbone:

- enrichment results have nowhere durable to land.
- scoring has no trustworthy context.
- drafts are disconnected from pipeline state.
- follow-up discipline cannot be measured.

***

## 7. Stage plan

## Stage 1 — Core lead workspace

### Objective

Create the minimum internal operating system for lead management.

### Included scope

- authenticated internal access.
- dashboard shell.
- lead list page.
- lead detail page.
- lead creation and editing.
- lead status.
- notes.
- tasks.
- activity log.
- basic search and filtering.

### Excluded scope

- enrichment.
- AI research generation.
- audits.
- scoring.
- outreach generation.
- external sending.

### Key outputs

- stable lead entity.
- stable task entity.
- stable activity entity.
- basic dashboard visibility.

### Exit criteria

- operator can manage live leads in one place.
- next actions are visible.
- no major ambiguity in lead lifecycle state.
- manual workflow is already better than scattered notes.

### Build notes

This stage should feel useful even with zero AI.

If it does not, the product foundation is wrong.

***

## Stage 2 — Discovery scope and candidate intake (Consolidated under "Campaigns")

### Objective

Make lead intake repeatable.

> [!NOTE]
> **Consolidation Refinement**: The "Discovery Scopes" and "Discovery Engine" screens have been consolidated into a single linear "Campaigns" workflow (`/scopes`). This avoids redundant forms: a user creates a Campaign with Niche and Location, and the system automatically launches the crawler, creates a dedicated workspace, and routes them to it. Subsequent searches inside the workspace warn the user about Apify duplicate costs and require a refined location/keyword variation ("Find More Leads" alert).

### Included scope

- campaign (discovery scope) creation.
- simplified niche, location, and limit intake form.
- automated name generation (e.g. `"Niche in Location"`) and geographic fallbacks (random US State).
- automated crawler trigger on creation.
- candidate lead intake flow.
- candidate review before promotion to active lead.
- source attribution.

### Excluded scope

- broad automated scraping engine (beyond Apify for targeted discovery).
- deep enrichment (reserved for Stage 3).
- autonomous discovery loops.

### Key outputs

- scope entity.
- candidate lead entity or equivalent pre-lead structure.
- import/review workflow.

### Exit criteria

- user can define a target segment.
- user can capture candidate businesses systematically.
- candidate-to-lead promotion is explicit and traceable.

### Build notes

Discovery should be controlled, not magical.

Early-stage discovery can be partially manual if the data intake workflow is strong.

***

## Stage 3 — Research and enrichment

### Objective

Reduce repetitive research time.

### Included scope

- manual trigger for enrichment.
- public data capture via lightweight edge scraping (e.g., Cloudflare Browser Run/Playwright).
- durable asynchronous execution via Cloudflare Workflows.
- research snapshot generation using strict JSON schema.
- source links and timestamps.
- confidence markers where possible.
- partial success handling (e.g., website down).

### Excluded scope

- guaranteed contact accuracy.
- aggressive unsupported scraping.
- hidden fully autonomous research loops.

### Key outputs

- research snapshot model.
- enrichment run status.
- enrichment provenance.
- review/edit workflow for generated research.

### Exit criteria

- operator can run enrichment on a lead.
- system stores useful, editable research output.
- incomplete data does not break the workflow.
- sources and freshness are visible enough for trust.

### Build notes

This stage must optimize for honest usefulness.

It is acceptable for enrichment to produce partial outputs.

It is not acceptable to imply false confidence.

***

## Stage 4 — Audits and scoring

### Objective

Help the operator decide which leads deserve attention.

### Included scope

- website and digital presence audit structure.
- opportunity findings.
- issue flags.
- transparent lead scoring.
- score rationale.
- manual score override.

### Excluded scope

- opaque predictive modeling.
- black-box ranking without explanation.

### Key outputs

- audit entity.
- score record or score history model.
- scoring rules layer.
- operator override path.

### Exit criteria

- audit output is structured and actionable.
- score can be explained.
- score helps prioritization without replacing judgment.

### Build notes

This stage should improve prioritization, not create fake precision.

***

## Stage 5 — Outreach assistant and approvals

### Objective

Prepare better outreach while preserving control.

### Included scope

- outreach draft generation.
- channel selection.
- email draft support.
- call prep support.
- meeting/visit prep support.
- approval workflow.
- draft history.

### Excluded scope

- automatic sending.
- sequence automation.
- mass outreach tools.

### Key outputs

- outreach draft entity.
- approval record.
- channel-aware draft generation flow.

### Exit criteria

- drafts are tailored and editable.
- approvals are explicit.
- drafts are connected to lead context and activity history.

### Build notes

This stage must feel like an assistant, not a bot acting on behalf of the operator.

***

## Stage 6 — Pipeline discipline and recommendations

### Objective

Reduce dropped leads and inconsistent follow-up.

### Included scope

- improved stage movement logic.
- reminder logic.
- next-best-action suggestions.
- overdue follow-up visibility.
- stronger dashboard rollups.

### Excluded scope

- autonomous reprioritization without traceability.

### Key outputs

- workflow rules.
- recommendation engine layer.
- reminder scheduling.

### Exit criteria

- user sees what needs attention.
- stale leads are visible.
- follow-up consistency improves operationally.

***

## Stage 7 — Reporting and optimization

### Objective

Create learning loops from real usage.

### Included scope

- funnel metrics.
- conversion visibility.
- lead source quality views.
- scoring effectiveness analysis.
- outreach outcome analysis.
- operational dashboards.

### Excluded scope

- heavy predictive analytics until enough quality data exists.

### Key outputs

- reporting views.
- KPI definitions.
- measurement framework.

### Exit criteria

- the agency can evaluate whether the system is improving workflow outcomes.
- later optimization decisions are based on observed usage rather than intuition alone.

***

## Stage 8 — Future Conversational Pilot & Vector RAG

### Objective

Provide a unified conversational pilot interface ("Chat + Canvas") utilizing Cloudflare Vectorize embeddings and a multi-provider orchestrator to drive agency growth workflows using natural language.

### Included scope

- **Split-Pane Layout ("Chat + Canvas"):** A persistent conversational pilot panel alongside the structured, information-dense workspace views.
- **Multi-Provider Orchestration:** High-intelligence models (e.g., DeepSeek-V4 or Gemini) as the main Supervisor/Orchestrator routing complex intents to sub-agents running on fast, free, or low-cost APIs (Groq, Nvidia, OpenRouter).
- **Sub-Agent Context Discarding:** Pruning prompt history by executing sub-agent tasks in short-lived, isolated single-turn contexts, passing only the final structured outputs back to the Supervisor to keep orchestrator token usage low.
- **Cloudflare Vectorize Integration:** A vector database binding for storing and performing semantic search queries over lead activity logs, audit summaries, and agency notes.
- **Deterministic Tool Calling:** Mapping user conversational requests to existing, typed Application Layer service methods (e.g. `moveLeadStage`, `triggerResearchWorkflow`) with explicit confirmation/approval triggers.

### Excluded scope

- **Autonomous Outbound Transmission:** Conversational triggers must never bypass manual approval states.
- **Pure Chat-First UI:** The structured database views (Canvas) remain the single source of truth; chat acts only as a pilot over the interface.

### Key outputs

- `vectorize` bindings in `wrangler.jsonc`.
- Chat interface component with streaming server-sent events.
- Tool Schema definitions for Application Layer services.
- Supervisor routing prompt system instructions.

### Exit criteria

- The operator can run complex queries and commands via natural language (e.g. *"Show me lead audit gaps for retail companies in Boston"*).
- The system correctly routes requests to deterministic services.
- Context usage and API token consumption remain low and rate-limit compliant under multi-agent loops.

***

## 8. Implementation order inside each stage

Within each stage, agents should implement in this order unless there is a clear reason not to.

1. data model changes.
2. domain logic.
3. persistence and queries.
4. basic API or server operations.
5. minimal usable UI.
6. validation and error handling.
7. activity logging and traceability.
8. tests.
9. polish only after workflow correctness.

If a stage has AI behavior, add this sequence:

10. output schema definition.
11. generation job or service.
12. review and edit UI.
13. approval gating if applicable.
14. failure-state handling.

***

## 9. Validation gates

Agents must not advance a stage unless the following gate is satisfied.

### 9.1 Workflow gate

The main user flow for that stage works without demo-only shortcuts.

### 9.2 Data gate

The resulting records are coherent, queryable, and safe to evolve.

### 9.3 UX gate

The user can understand the workflow without internal implementation knowledge.

### 9.4 Failure gate

The system behaves sensibly with missing data, failed jobs, and partial outputs.

### 9.5 Documentation gate

The relevant docs are updated to reflect the implemented behavior.

### 9.6 Test gate

The highest-risk logic has automated coverage or explicit manual verification steps.

***

## 10. AI integration plan

AI is a capability layer, not the product foundation.

### 10.1 First AI uses

The first AI-powered capabilities should be:

- research summarization.
- website or digital presence audit assistance.
- opportunity hypothesis generation.
- outreach draft generation.
- next-best-action suggestion.

### 10.2 AI features that should wait

Delay these until the product has stable data and real usage:

- autonomous lead discovery loops.
- complex predictive scoring.
- aggressive personalization automation.
- multi-agent systems with high write authority.
- live send-capable action loops.

### 10.3 AI implementation rules

Every AI result should preferably include:

- structured fields.
- a textual explanation.
- references to source evidence when possible.
- generation timestamp.
- model metadata if useful for debugging.
- approval/edit status where relevant.

### 10.4 Fallback behavior

If AI generation fails:

- preserve the lead record.
- show the job failed or partial state clearly.
- let the user retry.
- allow manual entry where appropriate.

***

## 11. Data strategy plan

### 11.1 Source-of-truth principle

Core business state must live in the application database.

This includes:

- lead records.
- statuses.
- tasks.
- notes.
- activity history.
- approvals.
- research snapshots.
- audits.
- outreach drafts.
- score records.

### 11.2 Human data precedence

When human-edited data conflicts with machine-inferred data, the system should prefer human-reviewed data unless policy explicitly says otherwise.

### 11.3 Historical record principle

Some information should update in place.

Some information should be versioned historically.

Default guidance:

- current lead profile fields can update in place.
- research snapshots should be historical.
- audits should be historical.
- scores should preserve at least major recalculations.
- stage changes must be historical.
- approvals must be historical.

### 11.4 Partial data principle

The schema must support useful operation even when records are incomplete.

Do not force fake completeness just to satisfy forms or tables.

***

## 12. UX delivery plan

### 12.1 Build screen hierarchy in this order

1. lead list.
2. lead detail.
3. dashboard.
4. task/reminder interactions.
5. discovery scope UI.
6. research and audit UI.
7. outreach assistant.
8. advanced reporting.

### 12.2 Screen quality rule

Each screen must answer a practical question.

Examples:

- Lead list: what should be reviewed next?
- Lead detail: what is known, what happened, what should happen next?
- Dashboard: where is current attention needed?
- Research view: what did the system find and how trustworthy is it?
- Outreach view: what message or action is ready for review?

### 12.3 UX anti-patterns

Agents must avoid:

- chat-first experience as the main shell.
- burying core record data behind generated text.
- unclear stage status.
- too many primary actions.
- generic CRM clutter.
- feature pages disconnected from the lead workflow.

***

## 13. Testing plan

### 13.1 What must be tested first

Highest-priority test targets:

- lead creation and editing.
- stage transitions.
- activity logging.
- task creation and completion.
- duplicate handling where implemented.
- research snapshot persistence.
- score calculation logic.
- approval gating.
- failure states for async jobs.

### 13.2 Testing philosophy

Prefer tests that validate business behavior.

Examples:

- creating a note should create a visible activity item.
- moving a lead to a new stage should update current state and preserve historical trace.
- approving a draft should change approval state but not auto-send anything.
- failed enrichment should not destroy existing lead data.

### 13.3 Manual validation requirement

Agents must include manual verification notes for workflow features, especially when UI and async behavior are involved.

***

## 14. Observability plan

At minimum, the system should support visibility into:

- background job success/failure.
- AI generation failures.
- major record mutations.
- approval actions.
- reminder processing.
- integration failures.

For important jobs, store:

- start time.
- end time.
- status.
- target record.
- error summary if failed.

***

## 15. Risk-driven planning constraints

### 15.1 Highest risks to reduce early

- weak workflow adoption.
- unstable data model.
- misleading AI output.
- overcomplicated architecture.
- poor traceability.
- brittle discovery/enrichment assumptions.

### 15.2 Planning responses

To reduce these risks:

- ship manual workflow value first.
- keep the schema explicit.
- force reviewability into AI features.
- avoid premature distributed systems.
- log meaningful changes.
- handle incomplete data as a first-class condition.

***

## 16. Suggested milestone sequence

### Milestone A

Operational lead workspace is usable without AI.

### Milestone B

Discovery scopes and candidate intake are structured.

### Milestone C

Research and enrichment reduce manual effort.

### Milestone D

Audits and scoring improve prioritization.

### Milestone E

Outreach assistant improves preparation quality.

### Milestone F

Follow-up discipline becomes measurable.

### Milestone G

Reporting supports optimization decisions.

### Milestone H

Conversational pilot routes natural language requests to deterministic services utilizing Cloudflare Vectorize embeddings.

Each milestone should be demoable with realistic records and workflows.

***

## 17. What agents should do next after this file

After `PLAN.md`, the next high-priority engineering document should be `ARCHITECTURE.md`.

That file should lock down:

- system module boundaries.
- data flow.
- background job flow.
- persistence strategy.
- external integration boundaries.
- AI service boundaries.
- security and approval boundaries.

After `ARCHITECTURE.md`, the next document should be `TASKS.md`, which should break the current planned stage into small executable units.

***

## 18. Final planning rule

Do not implement for the imagined end-state product.

Implement for the **current validated stage** while preserving a clean path to the next one.

The product should grow by stacking reliable layers, not by accumulating speculative features.