# Implementation Plan - Core Lead Workspace (v1 MVP)

This plan outlines the steps to build the core lead management workspace.

## Phase 1: Project Foundation & Auth
### Objectives
- Initialize the Next.js project and database schema.
- Implement basic authentication.

### Tasks
- [x] Task: Project Scaffolding & Database Setup (f57d3bf)
    - [x] Initialize Next.js app with TypeScript and Tailwind CSS.
    - [x] Configure Drizzle ORM with Cloudflare D1.
    - [x] Define initial schema for User, Lead, Task, Note, and Activity.
    - [x] Run initial migration.
- [~] Task: Minimal Internal Authentication
    - [ ] Implement simple login flow (e.g., password-based).
    - [ ] Setup auth middleware to protect core routes.
    - [ ] Write tests for auth guards (85% coverage).
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Project Foundation & Auth' (Protocol in workflow.md)

## Phase 2: Lead Management & Pipeline
### Objectives
- Build CRUD operations for leads.
- Implement pipeline stage tracking.

### Tasks
- [ ] Task: Lead CRUD Operations
    - [ ] Write tests for Lead creation and retrieval.
    - [ ] Implement Lead creation form and list view.
    - [ ] Implement Lead archiving (soft delete).
- [ ] Task: Pipeline Stage Management
    - [ ] Write tests for stage transitions and validation.
    - [ ] Implement stage update UI in lead detail view.
    - [ ] Ensure stage history is recorded in the Activity log.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Lead Management & Pipeline' (Protocol in workflow.md)

## Phase 3: Tasks, Notes & Activity
### Objectives
- Implement task management and linked notes.
- Ensure comprehensive activity logging.

### Tasks
- [ ] Task: Task Management System
    - [ ] Write tests for Task CRUD and lead association.
    - [ ] Implement Task creation and "My Tasks" view (Today/Overdue).
- [ ] Task: Notes & Activity Feed
    - [ ] Write tests for Note appending and Activity auto-logging.
    - [ ] Implement chronological Activity feed on lead detail page.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Tasks, Notes & Activity' (Protocol in workflow.md)

## Phase 4: Dashboard & Polish
### Objectives
- Create the high-level dashboard.
- Final UI/UX polish.

### Tasks
- [ ] Task: Dashboard Implementation
    - [ ] Implement pipeline distribution summary.
    - [ ] Implement dashboard task priority lists.
- [ ] Task: UI/UX Refinement
    - [ ] Apply "Modern Agency Premium" styles.
    - [ ] Ensure mobile responsiveness.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Dashboard & Polish' (Protocol in workflow.md)
