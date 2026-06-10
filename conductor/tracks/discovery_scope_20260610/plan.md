# Implementation Plan - Discovery Scope & Candidate Intake (Stage 2)

## Phase 1: Scope Data Model & UI
### Objectives
- Define the `Scope` entity and create management views.

### Tasks
- [x] Task: Scope Database Schema
    - [x] Add `Scope` model to Drizzle schema. (121eb60)
    - [x] Create and run database migration. (3b018e8)
- [~] Task: Scope CRUD Interface
    - [x] Write unit tests for Scope creation/retrieval. (121eb60)
    - [ ] Build the UI to create and list active scopes.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Scope Data Model & UI' (Protocol in workflow.md)

## Phase 2: Candidate Lead Model & Intake API
### Objectives
- Establish the `CandidateLead` entity and endpoints for data entry.

### Tasks
- [x] Task: CandidateLead Database Schema
    - [x] Add `CandidateLead` model to schema with relationship to `Scope`. (121eb60)
    - [x] Run migration. (3b018e8)
- [~] Task: Candidate Intake Mechanism
    - [x] Write tests for CandidateLead creation. (121eb60)
    - [ ] Implement manual entry form for Candidate Leads.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Candidate Lead Model & Intake API' (Protocol in workflow.md)

## Phase 3: Review & Promotion Workflow
### Objectives
- Build the review interface and the logic to promote candidates to active leads.

### Tasks
- [ ] Task: Candidate Review View
    - [ ] Implement UI to list pending candidates for a specific scope.
- [ ] Task: Promotion Logic
    - [ ] Write integration tests for promoting a candidate to a Lead.
    - [ ] Implement the promotion action, ensuring data transfer and source attribution.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Review & Promotion Workflow' (Protocol in workflow.md)
