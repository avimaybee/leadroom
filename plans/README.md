# Improvement Plans

This directory contains prioritized, self-contained implementation plans generated from codebase audits (Stages 1–5).

Agents should claim a plan by changing its status to `In Progress`, follow its instructions strictly, and mark it `Done` when all "Done criteria" are met.

| Plan ID | Title | Status |
|---------|-------|--------|
| [001](./001-fix-auth-secret-and-env-docs.md) | Eliminate hardcoded JWT fallback secret and complete environment variable docs | Done |
| [002](./002-action-auth-checks.md) | Add auth checks to state-changing server actions | Done |
| [003](./003-triage-zod-validation.md) | Validate triage AI responses with Zod | Done |
| [004](./004-promises-and-n1.md) | Fix workflow promises and dashboard N+1 queries | Done |
| [005](./005-scoring-tests.md) | Add scoring service test coverage | Done |
| [006](./006-remove-sync-enrichment.md) | Remove synchronous enrichment logic from ResearchService | Done |
| [007](./007-contact-management.md) | Implement edit and delete logic for Stage 3 Contacts | Done |
| [008](./008-audit-ui-resilience.md) | Add ErrorBoundary for Audit & Research UI resilience | Done |
| [009](./009-stage-5-outreach-data-model.md) | Implement Stage 5 - Outreach Data Model and Service Layer | Done |
| [010](./010-stage-5-custom-ai-generation-prompt.md) | Add Custom Prompt Input to Outreach Generation | Done |
| [011](./011-stage-5-context-reference-panel.md) | Context Reference Panel (UI/UX) | Done |
| [012](./012-stage-5-stage-automation.md) | Stage Automation on Outreach Sent | Done |
| [013](./013-stage-5-multi-draft-generation.md) | Multi-Draft Generation & Comparison | Done |
| [014](./014-fix-usestate-misuse.md) | Fix useState misuse in OutreachAssistant (draft sync bug) | Done |
| [015](./015-status-transition-guards.md) | Add status transition guards to outreach service and actions | Done |
| [016](./016-fix-layering-violation.md) | Move draft editing into OutreachService (fix layering violation) | Done |
| [017](./017-throttle-and-cache.md) | Throttle attachment cleanup and cache vision capability check | Done |
| [018](./018-rejection-tests-and-origin.md) | Add rejection flow tests and origin field to outreach schema | Done |

## Execution rules
1. Do not start a plan if a dependency plan is not yet `Done`.
2. Follow the "Drift check" in each plan before making modifications.
3. If STOP conditions are hit, halt execution and report to the user.
