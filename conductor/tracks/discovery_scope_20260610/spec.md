# Specification: Discovery Scope & Candidate Intake (Stage 2)

## Overview
Implement the second stage of the AI Agency Growth OS as defined in `docs/PLAN.md`. This track establishes a repeatable intake process for candidate leads, allowing users to define target segments and review prospects before promoting them to the active pipeline.

## Requirements

### 1. Discovery Scope Management
- **Entity**: `Scope` (Target segment definition).
- **Fields**: Name, Target Industry, Geography, Keywords, Status (Active/Archived).
- Users can create and save targeting definitions.

### 2. Candidate Lead Intake
- **Entity**: `CandidateLead` (Pre-lead structure).
- **Fields**: Basic contact info (Name, Company, Website, Source), associated Scope ID, Status (Pending, Approved, Rejected).
- Ability to manually input candidates or support future automated import (API endpoints).

### 3. Review and Promotion Workflow
- UI for operators to review a list of `CandidateLeads` linked to a `Scope`.
- "Promote" action: Converts an approved `CandidateLead` into an active `Lead` in the core workspace.
- Ensure source attribution is maintained on the promoted `Lead`.

## Technical Constraints
- **Data Model**: Candidate records must be distinct from Active Leads to prevent pipeline noise.
- **TDD**: 85% code coverage. Follow "Red, Green, Refactor".
- **Collaboration**: Changes must be isolated to allow parallel development with other tracks.
