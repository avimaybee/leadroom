# TASKS.md — SDR Pivot Execution

This document tracks the immediate, actionable engineering tasks for executing the Autonomous SDR Pivot.

## Phase 1: Data Model Realignment (Configuration Layer)

- [ ] Define the `Workspace` entity in `src/db/schema/strategy.ts`.
- [ ] Define the `Offer` entity (pain points, outcomes, proof points).
- [ ] Define the `ICPProfile` entity (positive signals, negative signals, disqualifiers, priority weights).
- [ ] Define the `Market` entity linking an Offer and ICP Profile.
- [ ] Refactor the existing `Lead` entity in `src/db/schema/core.ts` to `Prospect`.
- [ ] Add `fit_score`, `confidence_score`, `priority_tier`, and `disqualified_reason` columns to the Prospect table.
- [ ] Generate and apply Drizzle migration (`npm run db:generate`).
- [ ] Update `src/app/api/__tests__/routes.test.ts` to mock the new schema structure.

## Phase 2: Agentic Research Queue

- [ ] Define the `ResearchTask` entity in `src/db/schema/jobs.ts` for tracking granular agent runs.
- [ ] Create `zod` schemas for the three core agent outputs:
  - `WebsiteAnalysisSchema`
  - `ICPFitSchema` (outputting exact matched signals with evidence quotes)
  - `DisqualifierSchema`
- [ ] Refactor existing monolithic Cloudflare workflow (`src/lib/workflows/discovery.ts` / `enrichment.ts`) into step-by-step tasks.
- [ ] Build the deterministic scoring service (`src/lib/domain/scoring.ts`) that calculates Fit Score based on extracted signals vs. ICP Profile weights.

## Phase 3: Prioritization & Command Center UI

- [ ] Scaffold the `Command Center` dashboard (`src/app/(dashboard)/page.tsx`).
- [ ] Implement the "Ready to Review" prospects table (sort by Priority Tier, Fit Score).
- [ ] Overhaul the Lead Detail page (`src/app/leads/[id]/page.tsx`):
  - Split view: Company Context on the left, Score Breakdown & Evidence on the right.
  - Render explicit warning states for `Confidence Score < 50%`.
- [ ] Build the manual override UI (allowing user to override fit score and provide a reason).

## Phase 4: Approval-Gated Outreach & Learning Loop

- [ ] Define `OutreachDraft` and `ApprovalLog` tables in `src/db/schema/outreach.ts`.
- [ ] Build the Agentic Drafting prompt chain using the configured Offer + Prospect Signals.
- [ ] Implement the LLM "Risk Flag" self-evaluation step for drafts.
- [ ] Build the Side-by-Side Review UI: Draft text next to Cited Evidence.
- [ ] Implement the Approve, Reject (with Reason), and Regenerate actions.
- [ ] Define the `Outcome` and `LearningSuggestion` tables to feed outcome data back to the ICP profile.
