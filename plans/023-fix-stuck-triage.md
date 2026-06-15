# Plan: Fix Stuck Pending Triage State

Candidates that fail to enrich (due to blocked websites, timeouts, or missing local browser bindings) currently remain in the `UNASSESSED` (`Pending Triage`) state indefinitely because the database update step is bypassed on enrichment failures. This plan ensures a graceful fallback is always recorded.

## Proposed Changes

### Workflows and Local Simulation

#### [MODIFY] [discovery-search.ts](file:///d:/vs%20code/leadroom/src/workflows/discovery-search.ts)
- Modify the post-enrichment loop to catch failed or `null` enrichment results.
- Set a fallback triage priority of `'MEDIUM'` and triage reason of `'Enrichment failed (unreachable or blocked). Needs manual triage.'` instead of calling `continue` and skipping the DB write.

#### [MODIFY] [workflow-client.ts](file:///d:/vs%20code/leadroom/src/lib/workflow-client.ts)
- Implement the identical fallback logic inside the local simulator loop to align local dev behavior with production.

---

## Verification Plan

### Automated Tests
- Run the full test suite to check for any regressions:
  ```bash
  npm run test
  ```
