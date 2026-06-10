# Implementation Plan - Research & Enrichment Module (Stage 3)

## Phase 1: Data Model & Background Job Setup
### Objectives
- Define the `ResearchSnapshot` entity and set up the background job queue infrastructure.

### Tasks
- [ ] Task: ResearchSnapshot Database Schema
    - [ ] Add `ResearchSnapshot` model to Prisma/Drizzle schema.
    - [ ] Create and run database migration.
- [ ] Task: Background Job Queue Setup
    - [ ] Integrate a basic async job queue (e.g., BullMQ, Inngest, or a custom Next.js background worker).
    - [ ] Write tests for basic job enqueuing and processing.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Data Model & Background Job Setup' (Protocol in workflow.md)

## Phase 2: Enrichment Trigger & Execution
### Objectives
- Implement the UI trigger and the mock/stub enrichment processor.

### Tasks
- [ ] Task: Lead UI Trigger
    - [ ] Add "Run Enrichment" button to Lead detail view.
    - [ ] Implement UI state for job status (Pending/Completed).
- [ ] Task: Enrichment Processor
    - [ ] Write tests for the enrichment background handler.
    - [ ] Implement the background job that creates a `ResearchSnapshot` (can use mock data for initial implementation, allowing agents to replace with real scraping logic later).
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Enrichment Trigger & Execution' (Protocol in workflow.md)

## Phase 3: Review & Edit Workflow
### Objectives
- Build the UI for reviewing and applying research snapshots.

### Tasks
- [ ] Task: Snapshot Display View
    - [ ] Implement UI to display the `ResearchSnapshot` data and source links.
- [ ] Task: Data Application Logic
    - [ ] Write tests for applying snapshot data to the core `Lead` profile.
    - [ ] Implement the "Accept/Edit" workflow, ensuring human data precedence.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Review & Edit Workflow' (Protocol in workflow.md)
