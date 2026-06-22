# Plan 033: Add Missing DB Indexes on Frequently-Queried Foreign Key Columns

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat dc8430a..HEAD -- src/db/schema/`
> If the schema files have changed significantly since this plan was written,
> compare the current column definitions against the excerpts and adjust the
> index definitions to match the current schema.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `dc8430a`, 2026-06-22

## Why this matters

The lead detail page renders by running 8+ queries filtering by `leadId` (tasks, notes, contacts, research snapshots, audits, lead scores, outreach drafts, job runs). None of those foreign key columns have indexes. Every lead detail page load does full table scans on those tables.

With 500 leads and 2000+ related records, each page load scans thousands of rows unnecessarily. These are additive schema changes — zero migration risk.

## Current state

The schema files use the `index()` table option. Example of an existing index (`src/db/schema/core.ts:31-33`):

```ts
}, (table) => ({
  statusUpdatedAtIndex: index('leads_status_updated_at_idx').on(table.status, table.updatedAt),
}));
```

Existing indexed tables: `leads` (on status+updatedAt), `tasks` (on status+dueDate), `activities` (on leadId+timestamp).

Missing indexes (verified by reading each schema file):

| Table | Column(s) | File |
|-------|-----------|------|
| `tasks` | `leadId` | `src/db/schema/core.ts:42-56` |
| `notes` | `leadId` | `src/db/schema/core.ts:58-64` |
| `contacts` | `leadId` | `src/db/schema/research.ts:45-61` |
| `outreachDrafts` | `leadId` | `src/db/schema/outreach.ts:5-18` |
| `audits` | `leadId` | `src/db/schema/audits.ts:6-19` |
| `leadScores` | `leadId` | `src/db/schema/audits.ts:21-34` |
| `researchSnapshots` | `leadId` | `src/db/schema/research.ts:24-43` |
| `researchSnapshots` | `jobRunId` | `src/db/schema/research.ts:24-43` |
| `jobRuns` | `targetLeadId` | `src/db/schema/research.ts:5-22` |
| `candidateLeads` | `discoveryScopeId` | check `src/db/schema/discovery.ts` |
| `candidateLeads` | `promotedLeadId` | check `src/db/schema/discovery.ts` |
| `notifications` | `userId` | `src/db/schema/core.ts:105-115` |

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | `Compiled successfully` |
| Tests     | `npm test`               | All pass |

## Scope

**In scope** (the only files you should modify):
- `src/db/schema/core.ts`
- `src/db/schema/research.ts`
- `src/db/schema/audits.ts`
- `src/db/schema/outreach.ts`
- `src/db/schema/discovery.ts` (if it exists — check for `candidateLeads` table)

**Out of scope**:
- No migration files — the index-only changes are additive and work with existing data.
- No service code changes.
- No query changes — the query planner uses these indexes automatically.

## Steps

### Step 1: Add indexes to `src/db/schema/core.ts`

Add an index on `notes.leadId`:

```ts
export const notes = sqliteTable('notes', {
  ...
}, (table) => ({
  leadIdIndex: index('notes_lead_id_idx').on(table.leadId),
}));
```

Note: `tasks` already has a table index block — add the new index there:

```ts
export const tasks = sqliteTable('tasks', {
  ...
}, (table) => ({
  statusDueDateIndex: index('tasks_status_due_date_idx').on(table.status, table.dueDate),
  leadIdIndex: index('tasks_lead_id_idx').on(table.leadId),
}));
```

For `notifications`:

```ts
}, (table) => ({
  userIdCreatedAtIndex: index('notifications_user_id_created_at_idx').on(table.userId, table.createdAt),
}));
```

### Step 2: Add indexes to `src/db/schema/research.ts`

Add table indexes to `jobRuns`, `researchSnapshots`, and `contacts`.

For `jobRuns`:

```ts
}, (table) => ({
  targetLeadIdJobTypeStatusIndex: index('job_runs_target_lead_id_job_type_status_idx').on(table.targetLeadId, table.jobType, table.status),
}));
```

For `researchSnapshots`:

```ts
}, (table) => ({
  leadIdIndex: index('research_snapshots_lead_id_idx').on(table.leadId),
  jobRunIdIndex: index('research_snapshots_job_run_id_idx').on(table.jobRunId),
}));
```

For `contacts`:

```ts
}, (table) => ({
  leadIdDeletedAtIndex: index('contacts_lead_id_deleted_at_idx').on(table.leadId, table.deletedAt),
}));
```

### Step 3: Add indexes to `src/db/schema/audits.ts`

```ts
export const audits = sqliteTable('audits', {
  ...
}, (table) => ({
  leadIdIndex: index('audits_lead_id_idx').on(table.leadId),
}));

export const leadScores = sqliteTable('lead_scores', {
  ...
}, (table) => ({
  leadIdIsCurrentIndex: index('lead_scores_lead_id_is_current_idx').on(table.leadId, table.isCurrent),
}));
```

### Step 4: Add indexes to `src/db/schema/outreach.ts`

```ts
export const outreachDrafts = sqliteTable('outreach_drafts', {
  ...
}, (table) => ({
  leadIdIndex: index('outreach_drafts_lead_id_idx').on(table.leadId),
}));
```

### Step 5: Add indexes to `src/db/schema/discovery.ts` (if exists)

Read the file first. If it has a `candidateLeads` table, add indexes on `discoveryScopeId` and `promotedLeadId`.

### Step 6: Build and test

Run `npm run build` and `npm test` to verify.

## Test plan

Existing tests exercise all these query paths, so the test suite is the verification. Run:

```bash
node --import tsx --test src/db/__tests__/functions.test.ts src/db/__tests__/routes.test.ts src/db/__tests__/research.integration.test.ts src/db/__tests__/scoring.integration.test.ts
```

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npm test` passes (or only the pre-existing discovery integration test times out)
- [ ] Each of the 10+ missing indexes has been added in its schema file
- [ ] Only the 5 schema files are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- A schema file in scope doesn't exist or the `candidateLeads` table is in a different file than expected.
- A table already has a `}, (table) => ({` block — add the new index inside it rather than creating a second block (that would be a syntax error).
- The build fails with index-name collisions — prefix each index name with the table name to guarantee uniqueness.

## Maintenance notes

- Indexes are additive; they never break queries. If a new query pattern emerges, add indexes as part of the feature, not retroactively.
- When removing a table column that's indexed, drop the index first.
- The naming convention is `{table}_{column}_{column}_idx`.
