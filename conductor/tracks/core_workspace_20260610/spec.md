# Specification: Core Lead Workspace (v1 MVP)

## Overview
Implement the foundational lead management system for the AI Agency Growth OS as defined in `docs/PRD_V1.md`. This track focuses on creating a stable, authenticated internal tool for managing leads, pipeline stages, notes, and tasks.

## Requirements

### 1. Authentication (Minimal)
- Simple, internal-only authentication (e.g., password or invite-only).
- Block unauthenticated access to lead/task data.

### 2. Lead Management (CRUD)
- Entities: `Lead`, `PipelineStage`.
- Fields: Name, Company, Email, Phone, Website, City/Region, Industry, Current Stage, Status (Active/Archived).
- Soft delete (Archive) mechanism.

### 3. Pipeline Tracking
- Stages: New, Researching, Qualified, Outreach in Progress, Meeting/Call, Proposal, Won, Lost, Paused.
- Ability to update stage from lead detail view.

### 4. Tasks and Reminders
- Entities: `Task`.
- Fields: Title, Description, Lead ID (optional), Due Date, Status (Open/Completed/Canceled), Priority.
- Dashboard views for Today's and Overdue tasks.

### 5. Notes and Activity History
- Entities: `Note`, `Activity`.
- Append-only notes.
- Automatic activity tracking for stage changes, notes, and task completion.

### 6. Dashboard
- Pipeline distribution chart/summary.
- Task priority list (Today/Overdue).

## Technical Constraints
- **Stack**: Next.js (App Router), TypeScript, Cloudflare D1, Drizzle ORM.
- **TDD**: 85% code coverage required.
- **Styling**: Modern Agency Premium aesthetic (clean, polished, data-heavy).
- **Architecture**: Modular monolith with clear separation between UI, logic, and data.
