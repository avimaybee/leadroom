# Plan 045: Add test coverage and fix O(n) page-hit counting for funnel analytics

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
- **Category**: tests + perf
- **Depends on**: none
- **Planned at**: commit `691a737`, 2026-06-24

## Why this matters

`LeadService.getStageFunnel` (lines 486–524) powers the pipeline funnel visualization. It currently makes **O(N) sequential queries** for N pipeline stages — one per stage for entered count, one for exited count, one for avg days, and one for the next stage's entered count. For 10 stages, that's ~40 round-trips. The `getAvgDaysInStage` helper (line 526) loads ALL rows for a stage into memory to compute the average, then throws them away. This is both a correctness risk (no tests) and a performance problem.

## Current state

`src/services/lead.ts:486-538`:

```ts
async getStageFunnel(): Promise<{...}[]> {
  const rows: any[] = [];
  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    const stage = PIPELINE_STAGES[i];
    const [enteredResult] = await this.db.select({ count: count() })
      .from(leadStageHistory).where(eq(leadStageHistory.stage, stage));
    const entered = enteredResult?.count ?? 0;
    const [exitedResult] = await this.db.select({ count: count() })
      .from(leadStageHistory).where(and(eq(leadStageHistory.stage, stage), isNotNull(leadStageHistory.exitedAt)));
    const exited = exitedResult?.count ?? 0;
    const avgDays = await this.getAvgDaysInStage(stage);
    // ...
  }
}
```

- Loop per stage: 2 COUNT queries + 1 helper call that does another SELECT ALL
- No test coverage
- `PIPELINE_STAGES` is imported from `@/lib/pipeline-stages`

The fix: batch the COUNT queries into a single grouped query, and compute `avgDaysInStage` via SQL aggregation instead of loading all rows.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope**:
- `src/services/lead.ts` — `getStageFunnel` and `getAvgDaysInStage` methods
- `src/db/__tests__/funnel-analytics.test.ts` (create)

**Out of scope**:
- UI components that render the funnel — they consume the same return shape
- Other methods in `LeadService`

## Git workflow

- Branch: `advisor/045-tests-funnel-analytics`
- Two commits: `perf: batch funnel analytics queries` then `test: add funnel analytics test coverage`

## Steps

### Step 1: Batch query for entered counts per stage

Replace the per-stage COUNT queries with a single grouped query:

```ts
async getStageFunnel(): Promise<FunnelRow[]> {
  const enteredRows = await this.db
    .select({ stage: leadStageHistory.stage, count: count() })
    .from(leadStageHistory)
    .groupBy(leadStageHistory.stage);
  const enteredMap = new Map(enteredRows.map(r => [r.stage, r.count]));

  const exitedRows = await this.db
    .select({ stage: leadStageHistory.stage, count: count() })
    .from(leadStageHistory)
    .where(isNotNull(leadStageHistory.exitedAt))
    .groupBy(leadStageHistory.stage);
  const exitedMap = new Map(exitedRows.map(r => [r.stage, r.count]));

  // Also batch avgDaysInStage
  const avgRows = await this.db
    .select({
      stage: leadStageHistory.stage,
      avgMs: avg(
        sql`julianday(${leadStageHistory.exitedAt}) - julianday(${leadStageHistory.enteredAt})`
      )
    })
    .from(leadStageHistory)
    .where(and(isNotNull(leadStageHistory.exitedAt), isNotNull(leadStageHistory.enteredAt)))
    .groupBy(leadStageHistory.stage);
  const avgDaysMap = new Map(
    avgRows.map(r => [r.stage, r.avgMs !== null ? Math.round((r.avgMs as number) * 24 * 60 * 60 * 1000 / (24 * 60 * 60 * 1000) * 10) / 10 : null])
  );
```

Wait — Drizzle with SQLite (`sqliteTable`) uses different aggregation syntax. Use `sql` template literal for the date difference. In SQLite the function is `julianday`, but Drizzle's `sql` operator works. Check `src/db/schema/` for the column types — `enteredAt` and `exitedAt` are likely `integer` (Unix timestamps) in SQLite/D1.

If they're integers (timestamps), the avg is computable as:

```ts
const avgMs = sql`AVG(${leadStageHistory.exitedAt} - ${leadStageHistory.enteredAt})`;
```

Otherwise use the approach from existing code — but do it in SQL, not in JS.

Actual approach: use `sql` template to compute avg directly. Keep `getAvgDaysInStage` private but make it use a single aggregation query.

Better: inline the average computation into `getStageFunnel`:

```ts
const avgRows = await this.db
  .select({
    stage: leadStageHistory.stage,
    avgMs: sql<number>`AVG(${leadStageHistory.exitedAt} - ${leadStageHistory.enteredAt})`,
  })
  .from(leadStageHistory)
  .where(and(isNotNull(leadStageHistory.exitedAt), isNotNull(leadStageHistory.enteredAt)))
  .groupBy(leadStageHistory.stage);
const avgDaysMap = new Map(
  avgRows.map(r => [r.stage, r.avgMs !== null ? Math.round(r.avgMs / (24 * 60 * 60 * 1000) * 10) / 10 : null])
);
```

Then the loop body in `getStageFunnel` becomes a single pass over `PIPELINE_STAGES` reading from pre-computed maps instead of making queries.

Simplify: keep `getAvgDaysInStage` but rewrite it to use `sql` aggregation:

```ts
private async getAvgDaysInStage(stage: string): Promise<number | null> {
  const [row] = await this.db
    .select({
      avgMs: sql<number>`AVG(${leadStageHistory.exitedAt} - ${leadStageHistory.enteredAt})`,
    })
    .from(leadStageHistory)
    .where(and(
      eq(leadStageHistory.stage, stage),
      isNotNull(leadStageHistory.exitedAt),
      isNotNull(leadStageHistory.enteredAt)
    ));
  if (!row || row.avgMs === null) return null;
  return Math.round(row.avgMs / (24 * 60 * 60 * 1000) * 10) / 10;
}
```

**Verify**: `npx tsc --noEmit` → exit 0; `npm test` → exit 0

### Step 2: Create `src/db/__tests__/funnel-analytics.test.ts`

Test the `getStageFunnel` method:

| Test case | Setup | Expected |
|-----------|-------|----------|
| Returns all stages with 0 count | No leadStageHistory rows | All stages returned with entered: 0, exited: 0, conversionRate: null, droppedCount: 0 |
| Single stage with entered leads | Insert leadStageHistory rows for one stage | That stage has entered > 0 |
| Exited count | Insert rows with `exitedAt` set | exited > 0, droppedCount = entered - exited |
| Conversion rate between stages | Leads that moved from stage A to stage B | Stage A's conversionRate = (entered_B / exited_A) * 100 |
| avgDaysInStage | Insert rows with known enteredAt/exitedAt timestamps | avgDaysInStage ~= expected average (allow 1% tolerance for rounding) |

Use millisecond timestamps for `enteredAt`/`exitedAt` as integers (SQLite columns).

**Verify**: `node --import tsx --test src/db/__tests__/funnel-analytics.test.ts` → all tests pass

### Step 3: Run full suite

**Verify**: `npm test` → all tests pass

## Test plan

New test file + existing tests must pass. The perf refactor must not change the return shape or meaning of any field.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0; new funnel analytics tests pass
- [ ] Funnel now makes 3 queries total (entered counts, exited counts, avg duration) instead of ~40
- [ ] `getAvgDaysInStage` uses SQL `AVG()` instead of loading all rows into JS
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The column types in `leadStageHistory` are not integer timestamps (e.g., they're Date objects or strings) — the `sql<number>` template may need different handling.
- The aggregated SQL syntax doesn't compile with Drizzle + SQLite — test with `npx tsc --noEmit`.
- A step's verification fails twice after a reasonable fix attempt.
- The return type of `getStageFunnel` changes — it's consumed by UI components.

## Maintenance notes

- The 3-query approach is a dramatic improvement over O(N) but could be further reduced to 1 query using SQL joins. If the funnel grows to support date-range filtering, consider a single CTE-based query.
- If D1's SQL dialect doesn't support the `AVG` aggregation with subtraction, use `sql` template literal with explicit `CAST`.
