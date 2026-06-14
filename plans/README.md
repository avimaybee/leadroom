# Improvement Plans

This directory contains prioritized, self-contained implementation plans generated from the Stage 1–4 codebase audit.

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

## Execution rules
1. Do not start a plan if a dependency plan is not yet `Done`.
2. Follow the "Drift check" in each plan before making modifications.
3. If STOP conditions are hit, halt execution and report to the user.
