# AGENTS.md

## Purpose

This repository is for building an internal-first product called **Leadroom**.

The product is a practical business system for a small creative agency that wants to:

- discover potential clients.
- research them quickly.
- identify branding, website, and digital presence weaknesses.
- prepare tailored outreach.
- track follow-ups and pipeline movement.
- improve consistency without removing human judgment.

This is **not** a generic CRM, not a mass-outreach engine, and not an autonomous sales bot.

---

## Product Intent

Build a serious internal operating system for agency growth.

Core idea:

- The user defines a discovery scope.
- The system finds matching businesses.
- The system enriches and audits them.
- The system suggests next actions.
- The human reviews, edits, approves, and executes.
- The system logs outcomes and keeps the pipeline organized.

The system must create real operational value, not a demo.

---

## Build Philosophy

This product must be built in **stages**.

Every stage must produce a working, testable increment before moving to the next stage.

Agents must optimize for:

- reliability over novelty.
- clear workflows over feature sprawl.
- traceability over hidden automation.
- small working slices over broad speculative builds.
- strong defaults with human override.

Do not design for a hypothetical future SaaS product at the expense of a usable internal tool.

---

## Non-Negotiable Product Rules

These rules override convenience.

1. The system must always be human-in-the-loop.
2. The system must never send outreach automatically without explicit approval.
3. The system must never behave like a spam machine.
4. The system must prefer explainable scoring and traceable research over opaque AI output.
5. The system must tolerate incomplete data gracefully.
6. The system must show source evidence and confidence where possible.
7. The system must support manual correction and override everywhere that matters.
8. The system must feel like an internal business tool, not a flashy AI gimmick.

---

## Current Delivery Mode

This repository starts **docs-first**.

Until core planning docs exist, agents must not make large code decisions by guessing.

Current operating assumption:

- `AGENTS.md` is the top-level operating contract.
- `PRD.md` defines the product requirements.
- `PLAN.md` defines the staged implementation plan.
- `ARCHITECTURE.md` defines the system structure.
- `TASKS.md` defines the next executable units of work.

If one of these files is missing, incomplete, or contradicts another file, the agent must stop and resolve the documentation gap before making broad implementation changes.

---

## Stage-First Development Order

Agents must bias toward the following implementation order unless a later doc explicitly changes it.

### Stage 1 — Core lead workspace

Deliver the smallest useful internal system with:

- lead records.
- lead status.
- notes.
- tasks.
- activity history.
- manual data entry and editing.
- basic lead list and lead detail pages.

Goal: create a stable operational backbone.

### Stage 2 — Discovery intake

Add structured ways to define target scope and import or capture candidate businesses.

Goal: make lead acquisition repeatable.

### Stage 3 — Research and enrichment

Add public-data enrichment, research summaries, source links, confidence markers, and business profiles.

Goal: reduce manual research time.

### Stage 4 — Audit and scoring

Add website and digital presence audit workflows, opportunity flags, and transparent lead scoring.

Goal: improve prioritization.

### Stage 5 — Outreach assistant

Add tailored outreach drafting, call prep, meeting prep, proposal prep, and approval workflows.

Goal: improve action quality while keeping humans in control.

### Stage 6 — Pipeline discipline

Add stronger follow-up tracking, stage transitions, reminders, and next-best-action recommendations.

Goal: reduce missed opportunities.

### Stage 7 — Reporting and optimization

Add dashboards, conversion insights, funnel metrics, and feedback loops for improving scoring and workflows.

Goal: make the system measurable and improvable.

Do not skip ahead just because a later stage looks more impressive.

---

## What Agents Must Optimize For

When choosing between two implementation paths, prefer the one that improves:

- operator clarity.
- reviewability.
- auditability.
- data integrity.
- maintainability.
- testability.
- low operational risk.

Prefer boring, robust implementation over clever architecture.

---

## What Agents Must Avoid

Agents must not:

- invent requirements that are not in the docs.
- silently change product scope.
- build autonomous outbound messaging.
- assume enriched data is always accurate.
- hardcode fake confidence.
- hide uncertainty from the user.
- overfit the system to one temporary UI idea.
- introduce unnecessary multi-tenancy early.
- introduce unnecessary microservices early.
- add heavy infra before a simple design is proven.
- create broad scraping systems without explicit approval.
- scrape behind logins, bypass technical protections, or ignore legal/compliance constraints.
- optimize for flashy AI demos over stable business workflows.

---

## Required Operating Workflow For Coding Agents

For every substantial task, agents should follow this sequence:

1. Read `AGENTS.md` first.
2. Read the most relevant project docs (`PRD.md`, `PLAN.md`, `ARCHITECTURE.md`, `TASKS.md`, and any domain-specific file).
3. Restate the task in concrete implementation terms.
4. Identify assumptions, constraints, and unknowns.
5. Make the smallest reasonable change that advances the current stage.
6. Add or update tests.
7. Verify behavior manually where applicable.
8. Update docs if the change affects workflows, data models, architecture, or setup.
9. Report what changed, what was verified, and what remains risky.

Never make a large repo-wide refactor unless the task explicitly asks for it.

---

## Definition of Done

A task is not done unless all applicable conditions are satisfied.

### Product correctness

- The feature solves the specific workflow problem it was meant to solve.
- The behavior matches the current docs.
- Edge cases and empty states are handled.
- The user can recover from errors.

### Operational correctness

- The feature works in the intended stage context.
- The system state remains coherent after the action.
- Important actions are logged or traceable.
- Long-running operations expose status clearly.

### AI correctness

- AI output is reviewable.
- AI output is editable.
- Source evidence is stored where relevant.
- Confidence or uncertainty is represented honestly.
- No external action is taken without an approval step.

### Engineering correctness

- Types, schemas, and validations are coherent.
- Tests exist for meaningful logic.
- Error handling is explicit.
- No placeholder behavior is disguised as finished behavior.
- Documentation is updated if needed.

---

## Core Product Areas

Agents should treat these as the canonical product surfaces.

- Dashboard.
- Lead list.
- Lead detail page.
- Research summary.
- Audit view.
- Outreach assistant.
- Pipeline tracking.
- Tasks and reminders.
- Notes and activity history.
- Next-step suggestions.

Any proposed feature should map to one of these areas or clearly justify why a new area is needed.

---

## Canonical Domain Language

Use these terms consistently unless later docs redefine them.

### Lead
A business or opportunity record being evaluated or pursued.

### Contact
A person or reachable channel associated with a lead.

### Research snapshot
A time-bound summary of what was found about a lead from public sources.

### Audit
A structured evaluation of the lead’s website, brand, messaging, and digital presence.

### Opportunity hypothesis
A concrete, evidence-linked statement about how the agency may help the lead.

### Lead score
A transparent priority score based on defined signals and explicit weighting or reasoning.

### Outreach draft
A human-reviewable draft for email, call prep, visit prep, or proposal prep.

### Interaction
A logged activity such as note, call, email, visit, reminder, or status change.

### Approval
An explicit human decision that permits a sensitive action.

### Pipeline stage
A defined step in the lead-to-client lifecycle.

---

## Data Expectations

Agents must design for messy business data.

Assume that:

- some leads will have no email.
- some leads will have only a website or phone number.
- social links may be missing.
- summaries may be partial.
- enrichment sources may disagree.
- contacts may be stale.
- some fields will need manual edits.

Therefore:

- preserve raw evidence when practical.
- separate inferred fields from verified fields.
- store timestamps for enrichment and audits.
- store source references when possible.
- never overwrite higher-confidence human data blindly.

---

## UX Expectations

The product should feel like a credible internal ops system.

Agents should aim for:

- calm, structured, information-dense UI.
- obvious next actions.
- low cognitive overhead.
- strong status visibility.
- clear progression through workflows.
- easy manual correction.
- practical defaults.

Agents should avoid:

- ornamental AI branding.
- gimmicky chat-first UX unless explicitly required.
- excessive animations.
- unclear system state.
- dense forms without workflow guidance.
- vague AI labels like “smart insights” without substance.

---

## Architecture Bias

Until later docs say otherwise, default to the simplest architecture that can support staged delivery.

Preferred bias:

- modular monolith before microservices.
- relational data model before exotic storage.
- background jobs for slow research/enrichment tasks.
- explicit workflow/state transitions.
- typed APIs and validated schemas.
- server-side persistence for critical business data.
- audit-friendly records for research, scoring, and approvals.

Avoid architecture chosen mainly for trendiness.

---

## AI Feature Guardrails

Any AI-enabled feature must answer these questions clearly:

1. What exact task is the AI doing?
2. What input does it use?
3. What output shape is expected?
4. How is uncertainty represented?
5. What can the human edit?
6. What action is blocked pending approval?
7. How is the result stored and traced?
8. What is the fallback when AI output is weak or unavailable?

If these answers are not clear, the feature is not ready to implement.

---

## Approval Boundaries

Agents must not make the following decisions without explicit instruction in docs or task scope:

- replacing the core stack.
- introducing paid dependencies or external vendors.
- enabling live outbound messaging.
- adding scraping infrastructure for unsupported sources.
- changing the core workflow stages.
- introducing autonomous agent loops that mutate live data without review.
- removing traceability from research or scoring.
- broad refactors across unrelated modules.

---

## Testing Expectations

Agents must favor real workflow validation over shallow unit-test theater.

Testing should cover, where applicable:

- record creation and editing.
- workflow transitions.
- lead scoring logic.
- approval gating.
- activity logging.
- failure states.
- empty states.
- partial-data handling.
- idempotent enrichment behavior.
- permission-sensitive actions.

If a feature changes business logic, tests should prove the business behavior, not just the implementation details.

---

## Documentation Rules

Agents must update docs whenever implementation changes:

- product behavior.
- workflow steps.
- data model.
- architecture decisions.
- setup instructions.
- constraints or non-goals.

Docs are part of the product. They are not optional polish.

---

## Communication Style For Agents

When reporting progress:

- be direct.
- be concrete.
- list assumptions.
- list risks.
- distinguish implemented behavior from proposed behavior.
- do not claim completion unless the feature actually works.
- do not describe speculative code as production-ready.

No fluff.

---

## Final Principle

This product is only successful if each stage is independently useful.

Agents must build toward a system that a real small agency can use weekly, then daily, then operationally depend on.

If a proposed change makes the system look more impressive but less reliable, reject it.
