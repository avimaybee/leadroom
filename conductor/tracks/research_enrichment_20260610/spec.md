# Specification: Research & Enrichment Module (Stage 3)

## Overview
Implement the third stage of the AI Agency Growth OS as defined in `docs/PLAN.md`. This track introduces the ability to manually trigger enrichment processes to gather public data, capture research snapshots, and provide source attribution for trust.

## Requirements

### 1. Research Snapshot Management
- **Entity**: `ResearchSnapshot` (Historical record of enrichment data).
- **Fields**: Lead ID, Source URLs, Extracted Data (JSON/structured), Confidence Markers, Timestamp.
- Snapshots should be immutable history records attached to a Lead.

### 2. Manual Enrichment Trigger
- Add a "Run Enrichment" action to the Lead detail page.
- Trigger an asynchronous background job to perform the research.
- UI must show the status of the enrichment run (Pending, Processing, Completed, Failed, Partial Success).

### 3. Review and Edit Workflow
- UI to display the generated research snapshot.
- Allow the user to review the data, follow source links, and manually edit/correct the findings before accepting them as "truth" on the lead profile.

## Technical Constraints
- **Data Model**: `ResearchSnapshot` must be append-only to preserve historical trace.
- **Async Execution**: The actual enrichment logic (e.g., scraping, API calls) must run asynchronously to prevent blocking the UI.
- **TDD**: 85% code coverage. Tests must cover failure states and partial data handling.
- **AI Integration (Future-proofing)**: Ensure the background job structure allows for future AI agent integration for summarization.
