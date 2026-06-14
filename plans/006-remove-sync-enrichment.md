---
plan_id: "006"
title: "Remove synchronous enrichment logic from ResearchService"
status: "Pending"
priority: "Medium"
stage: "Stage 3"
---

# Plan 006: Remove synchronous enrichment logic from ResearchService

## Problem Statement
The codebase contains a synchronous implementation of research enrichment (`ResearchService.enrichLead()`) alongside an asynchronous Cloudflare Workflows implementation (`ResearchSnapshotWorkflow` triggered via `POST /api/leads/[id]/research`). The async workflow is the intended architectural path per Stage 3 documentation. The synchronous path blocks the server, risks timeouts on serverless environments, duplicates AI logic, and creates unused tech debt. It also currently exports a dead server action (`triggerEnrichmentAction`).

## File targets
- `src/services/research.ts`
- `src/app/actions/research.ts`

## Step-by-step instructions
1. Open `src/services/research.ts`.
2. Locate the `enrichLead(leadId: string, triggeredByUserId?: string | null)` method.
3. Completely delete the `enrichLead` method from the class. The logic for AI generation and DB updates is properly handled in `src/workflows/research-snapshot.ts`.
4. Open `src/app/actions/research.ts`.
5. Locate the exported `triggerEnrichmentAction` function.
6. Delete the `triggerEnrichmentAction` function, as the frontend correctly hits the API route (`/api/leads/[id]/research`) to enqueue the background workflow instead.

## Verification
- Run `npx tsc --noEmit` to verify that deleting `enrichLead` and `triggerEnrichmentAction` does not break any internal imports (which proves it was dead code).
- Run the test suite `npm run test` and verify tests pass. Note: If `ResearchService integration` tests explicitly test `enrichLead`, update the test file (`src/lib/__tests__/research.test.ts` or similar) to remove tests calling the synchronous path.

## Drift check
Check `src/app/actions/research.ts`. If `triggerEnrichmentAction` is missing, someone already removed it. Proceed to done.
