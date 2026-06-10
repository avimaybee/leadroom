# Specification: Digital Audits & Lead Scoring (Stage 4)

## Overview
Implement the fourth stage of the AI Agency Growth OS as defined in `docs/PLAN.md`. This track introduces structured digital presence audits and a transparent lead scoring mechanism to help operators prioritize their pipeline.

## Requirements

### 1. Digital Audit Structure
- **Entity**: `Audit` (Historical record of a digital presence evaluation).
- **Fields**: Lead ID, Opportunity Findings (text/JSON), Issue Flags (tags/categories), Timestamp.
- Audits must produce actionable, structured output.

### 2. Lead Scoring Mechanism
- **Entity**: `ScoreHistory`.
- **Fields**: Lead ID, Score Value (numeric), Rationale (text), Timestamp.
- Define a baseline scoring rules layer based on Lead profile completeness, activity, and related Audits/Research.
- Provide a UI for operators to view the score and the explainable rationale.

### 3. Manual Override
- Allow the operator to manually override a calculated score.
- Overrides must be logged as explicit historical actions (Activity trail).

## Technical Constraints
- **Data Model**: `Audit` and `ScoreHistory` must be historical records. Major score recalculations must be preserved.
- **TDD**: 85% code coverage. Scoring rules must be thoroughly unit tested.
- **Explainability**: Black-box ranking without rationale is strictly prohibited. The system must always provide a 'Why this score?' explanation.
