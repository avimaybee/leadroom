# Tasks

*Executable units of work based on the current stage in PLAN.md.*

## Phase 2 & AIML API Integration (Completed)

### 1. Cloudflare Browser Run Integration
- [x] Configure `@cloudflare/puppeteer` and define the `BROWSER` binding in `wrangler.jsonc`.
- [x] Implement Edge Browser scraping with Quick Action `/snapshot` in `src/lib/scraper.ts`.
- [x] Add Fetch-First static HTML bypass to prevent unnecessary browser calls and reduce compute costs.
- [x] Handle 429 rate limit exceptions, sleep delay steps in `ResearchSnapshotWorkflow`, and propagate limit warnings to frontend.

### 2. AI Provider Routing & Model Picker
- [x] Implement active provider switching server action (`setActiveProviderAndModelAction`).
- [x] Enforce mutual exclusivity so only one configured provider is active at any time.
- [x] Create and render `ActiveProviderPicker` client component at the top of settings.
- [x] Pass configured providers and allow custom model overrides.

### 3. AIML API Provider Support
- [x] Implement the `callAimlAPI` connector in `src/lib/ai.ts` targeting `https://api.aimlapi.com/v1/chat/completions`.
- [x] Support `aiml` routing inside `runTriageAI`.
- [x] Add `aiml` static models and display names in settings form and active picker.
- [x] Update `saveIntegrationConfigAction` to check model existence on `https://api.aimlapi.com/v1/models`.
- [x] Add dynamic live model list queries under `/api/settings/models` for `aiml`.
- [x] Write integration tests in `settings.integration.test.ts` verifying the key/model validation and activation logic for AIML.

---

## Stage 3: Research Pipeline & Cloudflare Workflows (Completed)

### 1. Web Scraping Service
- [x] Install Jina Reader / create a lightweight utility (`src/lib/scraper.ts`) to fetch URLs.
- [x] Add timeout handling and markdown truncation (max 15,000 characters) to prevent token limits.
- [x] Write integration test verifying scraper correctly fetches an external site.

### 2. Workflow Infrastructure Setup
- [x] Install/Configure Cloudflare Workflows types (`@cloudflare/workers-types` already present).
- [x] Define the `ResearchSnapshotWorkflow` class in `src/workflows/research-snapshot.ts`.
- [x] Implement Workflow Steps:
  - `step("fetch-lead")`
  - `step("fetch-site")`
  - `step("call-llm")`
  - `step("save-snapshot")`
  - `step("mark-job-complete")`
- [x] Update `wrangler.toml` to bind `RESEARCH_SNAPSHOT_WORKFLOW`.

### 3. Application API Wiring
- [x] Modify `POST /api/leads/[id]/research` to create a `job_runs` row and trigger the Workflow instance.
- [x] Ensure the endpoint immediately returns the `{ jobId }` without awaiting the actual LLM generation.
- [x] Implement `GET /api/jobs/[id]` to allow the UI to poll the job status.

### 4. UI Implementation (Lead Detail)
- [x] Update the Lead Detail page to support triggering the workflow.
- [x] Implement UI polling (e.g., polling `/api/jobs/[id]` every 2.5 seconds) when a job is `RUNNING`.
- [x] Display a loading indicator / steps progress based on the job status.
- [x] Once the job reaches `COMPLETED`, automatically refresh the Lead Detail page to display the new Snapshot.

### 5. Verification & Testing
- [x] Verify local workflow simulation works using `wrangler dev` or Next.js local integration.
- [x] Ensure failure states (e.g., website unreachable, LLM rate limit) correctly mark the job as `FAILED` and present an error message to the user allowing them to retry.

---

## Stage 2: Discovery Intake & AI Triage (Completed)

### 1. Sourcing Lead Slices (Consolidated under "Campaigns")
- [x] Install `apify-client` to connect to Google Maps scraping actors.
- [x] Create backend service `src/lib/discovery/apify.ts` to query maps search queries.
- [x] Consolidate `/discovery` and `/scopes` into a single **Campaigns** workspace view.
- [x] Implement simplified campaign creation (Niche, Location, Limit) auto-triggering discovery searches immediately.
- [x] Display active crawl progress via polling and show collapsible crawler run history in Campaign detail workspace.
- [x] Add "Find More Leads" warning and refinement modal to protect API credit allocations from duplicate runs.
- [x] Support checkboxes/manual actions to promote candidate leads or bulk-discard skips.

### 2. Triage AI (Cloudflare Workflows)
- [x] Create `src/workflows/triage-workflow.ts` bound in `wrangler.toml`.
- [x] Rules:
  - If no website ➜ score `HIGH` priority.
  - If website exists ➜ fetch with Jina and query active LLM to check if modern (`SKIP`) or outdated (`MEDIUM` priority).
- [x] Create `/functions/_middleware.ts` to export workflow classes so Wrangler builds compile correctly.

### 3. Settings & Integrations
- [x] Add OpenRouter and Groq to integrations settings.
- [x] Centralize LLM triage queries in `src/lib/ai.ts` (`runTriageAI`) to dynamically route to the user's active provider config.
- [x] Replace text input for model names with a dynamic `<select>` dropdown.
- [x] Query `/api/settings/models` on key change to pull live model lists.
- [x] Support manual fallback text input for custom model names.

---

## Stage 4: Audits & Scoring (Completed)

### 1. Database Schema
- [x] Create `audits` and `lead_scores` tables via Drizzle in `src/db/schema/audits.ts`.
- [x] Decouple quantitative gamified scores; audits are strictly qualitative (key strengths, key weaknesses, recommended improvements, opportunity notes).

### 2. Lead scoring logic
- [x] Implement the `recalculateScore` service method inside `src/services/scoring.ts` to fetch the latest research and audit snapshots.
- [x] Integrate AI-based priority score calculations (`generateLeadScore`) routing to the active LLM config.
- [x] Implement a profile-completeness scoring fallback (+15 for website, +10 for email, +10 for phone, +5 for city, +10 for industry, +30 for audit completed) if LLM call is unavailable.
- [x] Implement the manual override method (`manualOverride`) with justification context, marking overridden scores as inactive (`isCurrent = 0`).

---

## Stage 5: Outreach Assistant & Approvals (Completed)

### 1. Database Schema
- [x] Define `outreach_drafts` and `approvals` tables in the database schema.

### 2. Unified Background Pipeline & Token Uncapping
- [x] Bundle qualitative website design audits, research snapshots, and lead priority scoring into a single unified sequential workflow in `src/workflows/research-snapshot.ts`.
- [x] Uncap maximum output tokens to `24000` for all AI agent prompts in `src/lib/ai.ts` to allow rich outreach template generation.
- [x] Wire automatic research workflow trigger when promoting candidate leads in `src/services/discovery.ts`.

### 3. Outreach Assistant Actions & UI
- [x] Implement server actions (`generateOutreachDraftAction`, `recordApprovalAction`, `markAsSentAction`, `updateDraftAction`, `duplicateDraftAction`) in `src/app/actions/outreach.ts`.
- [x] Render tailorable outreach cards with visual channel picker (Email, WhatsApp, Call Prep, In-person visit) and status flows (DRAFT -> APPROVED -> SENT).
- [x] Ensure approval transitions are gated and create timeline logs in the chronological activities feed.

---

## Stage 8: Future Conversational Pilot & Vector RAG (Roadmapped)

### 1. Cloudflare Vectorize Integration
- [ ] Bind `VECTOR_INDEX` under vectorize configuration in `wrangler.jsonc`.
- [ ] Develop background indexing workflows running asynchronously to generate and push embeddings for notes, audits, and activity summaries (using Workers AI or Gemini Embeddings).
- [ ] Implement semantic lookup query helpers for context grounding.

### 2. Multi-Provider Supervisor Service
- [ ] Create the central `orchestration.ts` service representing the Supervisor router (utilizing DeepSeek Chat or Gemini Pro).
- [ ] Wrap deterministic application services (`createLead`, `changeStage`, `triggerResearchWorkflow`) into formatted JSON schema tool declarations.
- [ ] Implement a context pruning loop: execute sub-agents in isolated, single-turn context calls, return structured values to the supervisor, and immediately discard raw inputs to preserve tokens and context window space.
- [ ] Create provider routing rules to dynamically handle failovers if free-tier rate limits (RPM/TPM) are triggered.

### 3. Split-Pane Conversational Interface
- [ ] Initialize `ChatThread` and `ChatMessage` schemas via Drizzle.
- [ ] Add a side-by-side split screen rendering a persistent pilot chat panel next to the structured Next.js Canvas dashboard.
- [ ] Support streaming Server-Sent Events (SSE) with interactive confirmation buttons rendering for proposed agent actions.


