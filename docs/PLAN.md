# PLAN.md — Technical Implementation Plan

## Document Status

- Status: Active (Pivoted to SDR Agent).
- Scope: Technical implementation plan for building Leadroom as an Autonomous SDR / Founder-Led Sales Agent.
- Companion docs: `AGENTS.md`, `PRD.md`, `PIVOT.md`.
- Audience: Founder, coding agents.

This document translates the `PIVOT.md` roadmap into an execution plan that coding agents can follow stage by stage.

---

## 1. Planning Intent

This product will be built through **sequential, validated stages**.

Every stage must satisfy three conditions before the next stage begins:
1. The workflow works end to end.
2. The data model remains coherent.
3. The AI output is structured, typed (JSON), and cited.

---

## 2. Technical Stack & Architecture

- **Pattern:** Modular Monolith.
- **Frontend:** Next.js (App Router), React, Tailwind CSS.
- **Backend:** Next.js server actions / API routes.
- **Database:** Cloudflare D1 (SQLite) with Drizzle ORM.
- **Background Jobs:** Cloudflare Workflows for executing discrete Agentic Research Tasks.
- **AI Orchestration:** AI provider layer outputting strictly validated `zod` JSON schemas.

---

## 3. Implementation Roadmap (Pivot Stages)

### Phase 0: Demo Niche & Seed Data (COMPLETED)
Establish the product brief, domain glossary, and non-goals.

### Phase 1: Static IA Prototype & Core Configuration
**Objective:** Build the realistic static UI and establish the core data model.
- **Data Model:** Create `workspaces`, `offers`, `icp_profiles` (with positive/negative signals, disqualifiers, weights), and `markets`.
- **UI:** Scaffold the Command Center, Market Setup, ICP Builder, and Offer Setup screens.

### Phase 2: Prospect Ingestion & Research Queue
**Objective:** Allow users to import prospects and run granular research jobs.
- **Data Model:** Create `research_tasks` (task type, status, target, evidence output) linked to prospects.
- **Logic:** Refactor monolithic Cloudflare workflows into smaller, discrete steps (Website Analyst, ICP Fit Analyst, Pain Signal Analyst). Store raw snapshots separately from extracted JSON evidence.

### Phase 3: Fit Scoring & Command Center Prioritization
**Objective:** Turn research artifacts into ranked, explainable recommendations.
- **Data Model:** Add `fit_score`, `confidence_score`, `priority_tier`, and `disqualified_reason` to the prospect entity.
- **Logic:** Centralized scoring engine that parses AI-extracted signals against the user's `icp_profile` weights.
- **UI:** Build the dense Command Center prioritizing "Ready to Review" prospects. Show the exact cited evidence when hovering over a score.

### Phase 4: Outreach Drafting & Approval Workflow
**Objective:** Generate safe, personalized drafts and lock them behind an approval queue.
- **Data Model:** Create `outreach_drafts` with `risk_flags`, `cited_evidence`, and explicit `approval_status`.
- **Logic:** Agentic drafting using the Offer + Prospect Signals. Add a self-evaluation step that flags weak claims.
- **UI:** Side-by-side evidence and draft review. Buttons for Approve, Reject, Regenerate (with instruction).

### Phase 5: Pipeline & Learning Loop
**Objective:** Track outcomes and suggest configuration improvements.
- **Data Model:** Create `outcomes` (replied, lost) and `learning_suggestions`.
- **Logic:** Correlate outcomes with ICP signals. Generate suggestions (e.g., "Signal X leads to 90% bounces. Make it a disqualifier?").
- **UI:** Outcome tracking board. Learning suggestions inbox requiring human approval to apply.

### Phase 6: BYOK & Cost Controls
**Objective:** Make the system usable with user-provided API keys.
- **Logic:** Secure credential storage, cost estimation per batch run, and budget caps.

---

## 4. Technical Rules for Agents

### 4.1 Data Mutation Rules
All important mutations should be explicit and reviewable (e.g., `createWorkspace`, `updateICPProfile`, `approveOutreachDraft`). Avoid side-effects.

### 4.2 AI Operation Rules
Every AI feature must use `zod` for strict structured output. Freeform text blobs are rejected. Every claim must have a corresponding `sourceCitation` field.

### 4.3 Schema Evolution
Use explicit migration tooling (`npm run db:generate`). Do not use manual SQL files unless strictly necessary to fix broken state. 

### 4.4 Background Workflows
Use `@cloudflare/workflows` for all research tasks. Handle rate limits and timeouts gracefully. A failed website fetch should lower the `confidence_score`, not crash the system.