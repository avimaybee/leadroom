# Plan 046: Consolidate duplicated stale-lead detection logic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 691a737..HEAD -- src/services/lead.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Category**: tech-debt
- **Depends on**: none
- **Planned at**: commit `691a737`, 2026-06-24

## Why this matters

The formula `ageDays = (Date.now() - stageUpdatedAt) / (24 * 60 * 60 * 1000)` appears in three places in `src/services/lead.ts`: the stale alert check (line 556), the NBA engine's stale signal (line 648), and inlined in monitor-workflow triggers (line 49). Each place independently computes it with slightly different variable names. Extracting this into a private `getDaysSinceStageChange` method reduces duplication risk and makes the "days idle" definition consistent across the codebase.

## Current state

Three copies of the same computation:

**Location 1 — checkAndAlertStaleLeads** (line 556):
```ts
const ageMs = Date.now() - new Date(lead.stageUpdatedAt).getTime();
const ageDays = ageMs / (24 * 60 * 60 * 1000);
```

**Location 2 — evaluateSignal ('stale')** (line 648):
```ts
const ageMs = Date.now() - new Date(lead.stageUpdatedAt).getTime();
const ageDays = ageMs / (24 * 60 * 60 * 1000);
```

**Location 3 — advanceStageIfEarlier** (line 49, inline in workflow trigger):
```ts
stageUpdatedAt ? stageUpdatedAt.getTime() : Date.now()
```
This one passes the raw timestamp to `triggerMonitorStalledLeadWorkflow` — it doesn't compute days, but it's another access to the same timestamp.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors   |

## Scope

**In scope**:
- `src/services/lead.ts`

**Out of scope**:
- Any test file (test updates for extracted method are tracked in plan 044)
- `src/lib/workflow-client.ts` — the 72h simulation is a separate concern (plan 042)

## Git workflow

- Branch: `advisor/046-dedup-stale-lead-logic`
- Single commit: `refactor: extract getDaysSinceStageChange helper to deduplicate stale-lead logic`

## Steps

### Step 1: Add a private helper method

In `LeadService` class, add:

```ts
private getDaysSinceStageChange(stageUpdatedAt: Date | string | number | null | undefined): number | null {
  if (!stageUpdatedAt) return null;
  const ageMs = Date.now() - new Date(stageUpdatedAt).getTime();
  return ageMs / (24 * 60 * 60 * 1000);
}
```

Place it near the top of the class methods (after field declarations, before `getLead`).

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Replace inline computation in `checkAndAlertStaleLeads`

At line 553-557, change:

```ts
if (!lead.stageUpdatedAt) continue;
// ...
const ageMs = Date.now() - new Date(lead.stageUpdatedAt).getTime();
const ageDays = ageMs / (24 * 60 * 60 * 1000);
```

to:

```ts
const ageDays = this.getDaysSinceStageChange(lead.stageUpdatedAt);
if (ageDays === null) continue;
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Replace inline computation in `evaluateSignal` (stale case)

At lines 645-649, change:

```ts
if (!lead.stageUpdatedAt) return 0;
// ...
const ageMs = Date.now() - new Date(lead.stageUpdatedAt).getTime();
const ageDays = ageMs / (24 * 60 * 60 * 1000);
```

to:

```ts
const ageDays = this.getDaysSinceStageChange(lead.stageUpdatedAt);
if (ageDays === null) return 0;
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 4: Run full suite

**Verify**: `npm test` → all pass

## Test plan

Existing test coverage (from plans 043, 044) will indirectly test the helper. No new tests needed for the extraction itself — the logic is identical and covered by existing tests.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `grep -n 'Date.now() - new Date.*stageUpdatedAt' src/services/lead.ts` returns no matches (all replaced)
- [ ] `grep -n 'getDaysSinceStageChange' src/services/lead.ts` returns 4+ matches (definition + 3 call sites)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- There are additional inline copies of this formula not listed above — report them.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- If `getDaysSinceStageChange` ever needs to use a reference timestamp other than `Date.now()` (e.g., for testability), add an optional `now?: Date` parameter with `Date.now()` as the default.
- The `advanceStageIfEarlier` call site (line 49) does NOT compute days — it passes raw timestamps to a workflow trigger. Don't refactor it to use `getDaysSinceStageChange`; it has different semantics.
