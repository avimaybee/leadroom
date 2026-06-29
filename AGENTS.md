# AGENTS.md

## Purpose

This repository is for building **Leadroom**, an **Autonomous SDR / Founder-Led Sales Agent**.

The product is a practical, high-trust sales intelligence system for founders and small teams who want to:
- define a target market, an offer, and an Ideal Customer Profile (ICP).
- automatically research potential businesses.
- score fit and confidence with **explicit cited evidence**.
- generate highly personalized outreach drafts.
- safely gate all outbound actions behind a strict human approval step.
- learn from sales outcomes (replies, wins) to automatically refine the ICP.

This is **not** a generic CRM, not a mass-email spam machine, and not a black-box AI tool.

---

## Product Intent

Build a serious intelligence workstation for founder-led sales.

Core idea:
- The user defines their Workspace, Offer, and explicit ICP Profile.
- The system ingests prospect domains.
- A discrete queue of Research Agents (Website, ICP Fit, Pain Signals) processes the prospects.
- The system scores them, citing exact sources for every claim.
- The system suggests next actions (Approve Outreach, Skip, Research More).
- The human reviews the evidence side-by-side with the drafted outreach, and approves/rejects.
- The system logs outcomes and feeds them back into a learning loop to improve scoring.

The system must demonstrate taste, restraint, and operational maturity.

---

## Build Philosophy

This product must be built in **stages**.

Every stage must produce a working, testable increment before moving to the next stage.

Agents must optimize for:
- structured JSON outputs and receipts/evidence over opaque text blobs.
- clear approval gates over hidden automation.
- traceability and explainability over generic AI claims.
- small working slices over broad speculative builds.
- strong defaults with human override.

---

## Non-Negotiable Product Rules

These rules override convenience.

1. The system must always be human-in-the-loop for sending.
2. The system must **never** send outreach automatically without explicit human approval.
3. Every AI-generated claim or recommendation must link back to source evidence.
4. Fit Score and Data Confidence must remain decoupled (e.g., a lead can be a strong fit but we have low confidence due to poor data).
5. The system must prefer explainable deterministic scoring rules on top of AI-extracted structured data.
6. The system must tolerate incomplete data gracefully (e.g., failed research tasks).
7. The system must capture rejection reasons and outcomes to feed the learning loop.

---

## Current Delivery Mode

Planning docs exist at the repo root. Agents must read them before making broad implementation decisions.

Current operating assumption:
- `AGENTS.md` is the top-level operating contract.
- `docs/PRD.md` defines the product requirements.
- `docs/PLAN.md` defines the staged implementation plan.
- `docs/ARCHITECTURE.md` defines the system structure.
- `docs/DATA_MODEL.md` defines the exact schema entities.
- `docs/TASKS.md` defines the next executable units of work.

If one of these files is missing, incomplete, or contradicts another file, the agent must stop and resolve the documentation gap before making broad implementation changes.

---

## Stage-First Development Order (Pivot Roadmap)

Agents must bias toward the following implementation order:

### Stage 1 — Configuration Foundation (Workspaces, Offers, ICPs)
Establish the configuration layer that drives the agentic workflows.
Goal: Users can define what they sell and who they sell it to (with explicit positive/negative signals and weights).

### Stage 2 — Agentic Research Queue
Refactor the enrichment monolithic workflows into a task-based agent system (Website Analyst, Pain Analyst, Contact Mapping).
Goal: Granular, trackable research with structured JSON evidence.

### Stage 3 — Prioritization & Command Center UI
Build the UX heuristics emphasizing review speed and side-by-side evidence.
Goal: Founders can review a prospect and their fit score in under 60 seconds.

### Stage 4 — Approval-Gated Outreach & Learning Loop
Enhance drafts with risk flags and strict approval queues. Track outcomes (replies, bounces) to suggest ICP updates.
Goal: Make the product safe, credible, and capable of learning from real sales signals.

---

## What Agents Must Optimize For

When choosing between two implementation paths, prefer the one that improves:
- evidence linkage (saving exact quotes/URLs for claims).
- reviewability and UI density.
- strict typed boundaries (e.g., Zod schemas for every AI task).
- deterministic processing on top of LLM outputs.

---

## What Agents Must Avoid

Agents must not:
- invent features not in the docs.
- build autonomous outbound messaging loops.
- bundle unrelated AI extractions into unstructured text blobs.
- scrape behind logins or ignore compliance constraints.
- optimize for flashy conversational chat UIs over dense, structured data views.

---

## Required Operating Workflow For Coding Agents

For every substantial task, agents should follow this sequence:
1. Read `AGENTS.md` first.
2. Read the most relevant project docs (`PRD.md`, `PLAN.md`, `ARCHITECTURE.md`, `TASKS.md`, `DATA_MODEL.md`).
3. Identify assumptions, constraints, and unknowns.
4. Make the smallest reasonable change that advances the current stage.
5. Add or update tests.
6. Verify behavior manually where applicable.
7. Update docs if the change affects workflows, data models, architecture, or setup.
8. Report what changed, what was verified, and what remains risky.

---

## Definition of Done

### AI correctness
- AI output is strictly structured (JSON).
- AI output is fully reviewable and editable.
- Source evidence is stored and linked to claims.
- Confidence or uncertainty is represented honestly.
- No external action is taken without an explicit approval step.

### Engineering correctness
- Types, schemas, and validations are coherent.
- Tests exist for meaningful logic (especially scoring).
- Background jobs handle failures/retries gracefully.
- Documentation is updated if needed.

---

## Core Domain Language

- **Workspace**: A top-level isolation boundary for a user/agency.
- **Offer**: What the user sells (pain, outcomes, proof).
- **ICP Profile**: The definition of a good-fit customer (signals, disqualifiers, weights).
- **Market**: A segment or niche being explored.
- **Prospect**: A potential customer account.
- **Research Task**: A discrete unit of agentic research (e.g., Website Analysis).
- **Signal**: A piece of evidence that affects score or prioritization.
- **Fit Score**: How well the prospect matches the ICP.
- **Confidence**: How trustworthy the data is.
- **Outreach Draft**: A proposed email or message citing specific evidence.
- **Approval**: An explicit human decision permitting outreach.
- **Outcome**: Result of an action (Replied, Won, Lost), used for learning.

---

## Data Expectations

Assume that:
- websites will fail to load.
- LLMs will sometimes hallucinate or fail to return valid JSON.
- data will be sparse.
- enrichment sources will disagree.

Therefore:
- decouple Fit from Confidence.
- handle job retries.
- validate all AI inputs and outputs strictly via Zod.
- store raw artifacts distinct from processed summaries.
