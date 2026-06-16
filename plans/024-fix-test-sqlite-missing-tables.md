# Plan 024: Fix missing provider_configs table in test databases

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 168c15f..HEAD -- src/db/__tests__/scoring.integration.test.ts src/db/__tests__/audits.integration.test.ts src/db/__tests__/lead.integration.test.ts src/db/__tests__/discovery.integration.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `168c15f`, 2026-06-16

## Why this matters

During test execution, `ScoringService.recalculateScore()` is run which attempts to query the active provider configuration from the `provider_configs` table in the database. Because this table is missing in the in-memory SQLite database configuration of several integration tests, the queries fail silently with an `SqliteError: no such table: provider_configs` log, and fall back to rule-based profile completeness scoring. This masks potential logic bugs.

## Current state

- The files containing `setupTestDb` that lack `provider_configs` table definition:
  - `src/db/__tests__/scoring.integration.test.ts`
  - `src/db/__tests__/audits.integration.test.ts`
  - `src/db/__tests__/lead.integration.test.ts`
  - `src/db/__tests__/discovery.integration.test.ts`

Exemplar table definition from `src/db/__tests__/research.integration.test.ts:51-59`:
```sql
    CREATE TABLE provider_configs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL UNIQUE,
      api_key TEXT NOT NULL,
      model_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests   | `npm run test` | all pass, no table errors |

## Scope

**In scope**:
- `src/db/__tests__/scoring.integration.test.ts`
- `src/db/__tests__/audits.integration.test.ts`
- `src/db/__tests__/lead.integration.test.ts`
- `src/db/__tests__/discovery.integration.test.ts`

**Out of scope**:
- Changing any other table setup or modifying scoring service code directly.

## Steps

### Step 1: Add table setup to scoring.integration.test.ts
Modify `setupTestDb` in `src/db/__tests__/scoring.integration.test.ts` to add the `provider_configs` table creation statement.

**Verify**: Run `npx tsx src/db/__tests__/scoring.integration.test.ts` -> all pass, no `provider_configs` SqliteError in output.

### Step 2: Add table setup to audits.integration.test.ts
Modify `setupTestDb` in `src/db/__tests__/audits.integration.test.ts` to add the `provider_configs` table creation statement.

**Verify**: Run `npx tsx src/db/__tests__/audits.integration.test.ts` -> all pass, no SqliteError in output.

### Step 3: Add table setup to lead.integration.test.ts and discovery.integration.test.ts
Modify `setupTestDb` in both files to add the `provider_configs` table.

**Verify**: Run the full test suite `npm run test` -> all pass, no SqliteError logs.

## Done criteria

- [ ] `provider_configs` table is initialized in all 4 test suites.
- [ ] No `SqliteError: no such table: provider_configs` logs are printed in stdout/stderr when running tests.
- [ ] `npm run test` exits with 0.
