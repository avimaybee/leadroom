# ARCHITECTURE.md

## 1. High-Level Architecture

Leadroom is built as a **Modular Monolith**. It runs on Cloudflare infrastructure, taking advantage of edge computing and durable background execution to orchestrate agentic sales workflows without requiring a complex microservices architecture.

### 1.1 Core Components
- **Frontend / Client UI:** Next.js App Router (React, Tailwind CSS). Focuses on dense, information-rich tables and side-by-side review panels (Command Center).
- **Application Server:** Next.js Server Actions and API Routes. Handles auth, data mutations, and triggering background workflows.
- **Database:** Cloudflare D1 (Serverless SQLite) interacted with via Drizzle ORM.
- **Agentic Engine:** Cloudflare Workflows (`@cloudflare/workflows`). Manages long-running, multi-step LLM tasks (fetching websites, extracting signals, drafting outreach).
- **AI Integration Layer:** Structured LLM calls using `zod` schemas to enforce strict JSON outputs. Supports BYOK (Bring Your Own Key).

---

## 2. Request & Execution Flow

### 2.1 Synchronous UI Flow
User actions that modify configuration (e.g., updating an ICP Profile) or approve outputs (e.g., approving an Outreach Draft) are handled synchronously:
1. User clicks "Approve" in the Client UI.
2. Next.js Server Action validates the request.
3. Drizzle ORM updates the `outreach_drafts` and `prospects` tables in Cloudflare D1.
4. UI optimistic updates or revalidates path.

### 2.2 Asynchronous Agent Flow
Heavy research and drafting tasks run asynchronously so they don't block the UI or hit Vercel/Cloudflare serverless timeout limits.
1. Prospect domains are ingested (CSV or scraper).
2. The Application Server queues a `Research Workflow` in Cloudflare Workflows.
3. **Step 1:** Fetch website HTML (cached if previously fetched).
4. **Step 2:** LLM extracts Pain Signals and outputs strict JSON.
5. **Step 3:** System evaluates the extracted signals against the user's `icp_profile` weights to calculate a Fit Score.
6. The Workflow completes, saving artifacts and scores to D1.
7. The Client UI polls or listens for completion to update the Command Center.

---

## 3. Module Boundaries

The codebase is organized to maintain clear boundaries between the UI, domain logic, and external dependencies.

- `src/app/`: Next.js page routing and purely presentational UI components.
- `src/components/`: Reusable UI components (tables, evidence panels, buttons).
- `src/lib/domain/`: Core business logic (scoring algorithms, approval gating rules).
- `src/db/`: Drizzle ORM schemas, migrations, and database access utilities.
- `src/lib/workflows/`: Cloudflare Workflows definitions (the Agentic Engine).
- `src/lib/ai/`: Wrappers for external LLM providers. Handles `zod` validation and BYOK logic.

---

## 4. AI & Scoring Architecture

### 4.1 Strict Structured Output
The system does not store raw LLM conversational text as business data. Every LLM call must output structured JSON matching a pre-defined Zod schema. 

Example: If an agent finds a pain point, the output is `{ painSignal: string, evidenceQuote: string, sourceUrl: string }`.

### 4.2 Deterministic Scoring Over Generative
We use AI for *extraction*, but deterministic logic for *scoring*.
- **Extraction (AI):** "Does this website mention manual onboarding?" -> Output: `true`, with quote.
- **Scoring (Deterministic):** If `manual_onboarding == true`, add `+20` to Fit Score based on the user's configured ICP Profile.

### 4.3 Data Confidence Tracking
A core architectural tenet is decoupling Fit Score from Confidence. 
- If a website fails to load, `Confidence` drops to 0%, but the `Fit Score` remains neutral.
- If a contact's role is extracted from a stale public source, the `Risk Flag` is raised on the draft.

---

## 5. Security & Isolation

- **Workspaces:** All core tables (Offers, ICPs, Prospects) are partitioned by a `workspace_id` to ensure strict tenant isolation.
- **BYOK Storage:** API keys provided by the user are stored securely (e.g., Cloudflare Secrets/KV) and never logged.
- **Read-Only Models:** The agents have read-only access to the web (fetching pages). They cannot execute autonomous writes outside of their isolated workflow state until a human explicitly approves the action in the UI.