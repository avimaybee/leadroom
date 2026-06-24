# Plan 043: Add test coverage for NBA engine

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

The Next-Best-Action (NBA) engine (`LeadService.getNextBestActions`, lines 607–702 in `src/services/lead.ts`) is the core prioritization logic that drives the dashboard's action cards and pipeline triage. It has zero test coverage. Any regression in signal evaluation, weighting, or rule ordering silently degrades the operator's ability to triage leads. Adding coverage here protects the most operator-facing algorithm in Stage 6.

## Current state

The NBA engine lives in `src/services/lead.ts`:

- `getNextBestActions(leadId, rules?)` — iterates `activeRules`, evaluates each signal strength, weights by rule weight, returns sorted results
- `evaluateSignal(lead, signal)` — evaluates 7 signals: `overdue_task`, `future_task`, `stale`, `unsent_draft`, `no_research`, `no_audit`, `unread`
- `signalToAction(signal, lead, strength)` — converts signal enum to human-readable action card
- `DEFAULT_NBA_RULES` (line 723) — 7 rules with weights from 30–100

Existing test pattern (model file): `src/db/__tests__/scoring.integration.test.ts` — creates leads via `setupTestDb`, calls service methods, asserts on results.

The test helper is at `src/db/__tests__/helpers.ts` — provides `setupTestDb()` which returns `{ db, schema }` with an in-memory SQLite instance and full schema.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Tests     | `npm test`               | all pass            |
| One file  | `node --import tsx --test src/db/__tests__/nba-engine.test.ts` | all pass |

## Scope

**In scope**:
- `src/db/__tests__/nba-engine.test.ts` (create)
- `src/db/__tests__/helpers.ts` — may need a helper to create a minimal lead + related data

**Out of scope**:
- `src/services/lead.ts` — no production code changes (unless a bug is discovered during test writing)
- Other test files — not modifying existing tests

## Git workflow

- Branch: `advisor/043-tests-nba-engine`
- Single commit: `test: add NBA engine test coverage`

## Steps

### Step 1: Study the test helper and model file

Read `src/db/__tests__/helpers.ts` to understand `setupTestDb()`, and `src/db/__tests__/scoring.integration.test.ts` for the test structure pattern.

**Verify**: You can identify how to create a lead, a task, an outreach draft, and a research snapshot in the test DB.

### Step 2: Create `src/db/__tests__/nba-engine.test.ts`

Write a test file with a `describe('NBAEngine')` block. Cover these scenarios using `setupTestDb()` and inline seed data:

| Test case | What it verifies | Signal exercised |
|-----------|------------------|------------------|
| Returns empty for non-existent lead | `getNextBestActions` returns `[]` when lead ID not found | (none — early return) |
| Returns empty for non-Active lead | Lead with `status !== 'Active'` returns `[]` | (none — early return) |
| Returns empty for Won/Lost stage | Lead with `stage === 'Won'` returns `[]` | (none — early return) |
| overdue_task signal fires | Create lead with an overdue (past-due) open task → action with `type: 'task'` in results | `overdue_task` |
| overdue_task signal is absent | Create lead with only future-due tasks → no overdue action in top results | `overdue_task` (0 strength) |
| stale signal fires | Create lead with `stageUpdatedAt` older than threshold days → `type: 'review'` action | `stale` |
| no_research signal fires | Lead with no research snapshot → `action: 'Start lead research'` | `no_research` |
| no_research signal is absent | Lead with an existing research snapshot → no research action | `no_research` (0 strength) |
| Custom rules override | Pass custom rule array with a single high-weight rule → only that rule's action appears | Depends on rule |
| Results sorted by score desc | Multiple signals fire → result array is sorted descending by `score` | All combined |
| Zero-weight rules excluded | A rule with `weight: 0` is in the list → it produces no result | (zero-weight filtering) |

Use `import { LeadService, DEFAULT_NBA_RULES } from '@/services/lead'` and construct `new LeadService(db)`.

**Verification approach for each case**:
- Create the minimal DB state via raw Drizzle inserts
- Call `leadService.getNextBestActions(leadId)`
- Assert on the returned array (length, action/type/priority/rationale shape, score ordering)

For the `overdue_task` test, insert a `tasks` row with `dueDate` in the past and `status: 'Open'`.

For the `stale` test, insert a `stageThresholds` row for the lead's stage with a low `days` value, and set `stageUpdatedAt` far enough in the past.

**Verify**: `node --import tsx --test src/db/__tests__/nba-engine.test.ts` → all 9+ tests pass

### Step 3: Run the full suite

**Verify**: `npm test` → all tests pass (no regressions)

## Test plan

The test file IS the plan. Verification is the test run.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0; new NBA engine tests pass
- [ ] Each signal type (`overdue_task`, `future_task`, `stale`, `unsent_draft`, `no_research`, `no_audit`, `unread`) has at least one test proving it fires when expected
- [ ] Edge cases covered: non-existent lead, inactive lead, won/lost lead, zero-weight rule
- [ ] Score ordering is tested
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The test helper's API doesn't match what's described here (read the actual helper and adjust).
- Any test case requires mocking `Date.now()` — the signal calculations use `Date.now()` internally; if tests fail due to timing, use a sufficiently large offset instead of mocking. If mocking is required, stop and report.
- The fix appears to require touching an out-of-scope file.
- A named export or function signature has changed — read the live code and adapt.

## Maintenance notes

- If new NBA signals are added, they must get a corresponding test case.
- If the signal strength formula changes, the expected values in these tests must be recalculated.
- The `evaluateSignal` private method is tested indirectly through `getNextBestActions` — no need to expose it.
