# Plan 044: Add test coverage for stale lead alerts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 691a737..HEAD -- src/services/lead.ts src/db/__tests__/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Category**: tests
- **Depends on**: none
- **Planned at**: commit `691a737`, 2026-06-24

## Why this matters

The stale alert system (`LeadService.checkAndAlertStaleLeads`, lines 542–603) is the automated mechanism that notifies operators when leads have been idle past their stage thresholds. It has zero test coverage. Because it creates real `notifications` rows, a regression could either spam operators with false alerts or silently fail to alert on genuine stale leads. The `hasRecentStaleNotification` dedup helper (line 595) is also untested.

## Current state

The stale alert logic in `src/services/lead.ts`:

- `checkAndAlertStaleLeads()` — queries active leads, compares `stageUpdatedAt` against `stageThresholds`, creates `notifications` at 80% warning and 100% threshold
- `hasRecentStaleNotification(leadId, withinHours)` — checks if a notification for this lead was created within the dedup window

Threshold logic:
- At 80% of threshold → creates INFO notification (once per 48h via `hasRecentStaleNotification(lead.id, 48)`)
- At >= 100% of threshold → creates ERROR notification (once per 24h via `hasRecentStaleNotification(lead.id, 24)`)
- Skips Won/Lost stages, leads without `stageUpdatedAt`, leads without `ownerId`

Existing test pattern: `src/db/__tests__/scoring.integration.test.ts` uses `setupTestDb()` and raw Drizzle inserts.

Test helper: `src/db/__tests__/helpers.ts` — provides `setupTestDb()` returning `{ db, schema }`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Tests     | `npm test`               | all pass            |
| One file  | `node --import tsx --test src/db/__tests__/stale-alerts.test.ts` | all pass |

## Scope

**In scope**:
- `src/db/__tests__/stale-alerts.test.ts` (create)

**Out of scope**:
- `src/services/lead.ts` — no production code changes
- `src/db/__tests__/helpers.ts` — modify if needed to add a notification creation helper

## Git workflow

- Branch: `advisor/044-tests-stale-alerts`
- Single commit: `test: add stale lead alert test coverage`

## Steps

### Step 1: Study helpers and notification schema

Read `src/db/__tests__/helpers.ts` for `setupTestDb()`. Check the `notifications` table schema in `src/db/schema/` to understand its columns.

**Verify**: You know the shape of the `notifications` table.

### Step 2: Create `src/db/__tests__/stale-alerts.test.ts`

Write a test file with `describe('StaleAlerts')`. Cover:

| Test case | Setup | Expected result |
|-----------|-------|-----------------|
| Returns 0 for leads without stageUpdatedAt | Active lead, stage ≠ Won/Lost, `stageUpdatedAt` is null | `alertCount === 0`, no notifications created |
| Skips Won leads | Won lead past threshold | `alertCount === 0` |
| Skips Lost leads | Lost lead past threshold | `alertCount === 0` |
| Skips inactive leads | Lead with `status !== 'Active'`, past threshold | `alertCount === 0` |
| Creates warning at 80% threshold | Active lead at 80-99% of threshold days, no prior notification | `alertCount === 0` (warning doesn't count), but `notifications` has an INFO row with title starting "Lead aging:" |
| Creates alert at >=100% threshold | Active lead at >=100% of threshold days, no prior notification | `alertCount === 1`, `notifications` has an ERROR row with title starting "Lead stale:" |
| Dedup prevents duplicate warning | Two calls within 48h, first creates warning, second skips | After first call: 1 notification. After second: still 1 notification |
| Dedup prevents duplicate alert | Two calls within 24h, first creates alert, second skips | After first call: 1 notification. After second: still 1 notification |
| Custom threshold from stageThresholds | Lead in a stage with custom `days=1` in `stageThresholds` | Alert fires when `stageUpdatedAt` is 1+ days old |

Use `new LeadService(db)`.

For setting up dates in the past, compute `Date.now() - offsetMs` and write it directly to the lead's `stageUpdatedAt` field.

**Verify**: `node --import tsx --test src/db/__tests__/stale-alerts.test.ts` → all tests pass

### Step 3: Run the full suite

**Verify**: `npm test` → all tests pass

## Test plan

The test file is the deliverable.

## Done criteria

- [ ] `npm test` exits 0; new stale alert tests pass
- [ ] At minimum: warning threshold test, alert threshold test, dedup test for each, and skip-cases (null stageUpdatedAt, Won, Lost, inactive)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The test helper's API doesn't match expectations.
- The `notifications` table structure is different from expected — stop and report the actual columns.
- `checkAndAlertStaleLeads` requires `ownerId` to be set on a lead — some test leads may need this.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The 48h/24h dedup windows make these tests time-sensitive. Use fixed cutoff offsets larger than the test window to ensure reliable dedup behavior. If `hasRecentStaleNotification` becomes injectable with a clock, refactor tests to use it.
- If the notification dedup logic changes, these tests will need updated expected counts.
