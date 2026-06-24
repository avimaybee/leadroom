# Plan 042: Fix MonitorStalledLeadWorkflow simulation 72h sleep

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 691a737..HEAD -- src/lib/workflow-client.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Category**: bug
- **Depends on**: none
- **Planned at**: commit `691a737`, 2026-06-24

## Why this matters

The `MonitorStalledLeadWorkflow` simulation (`src/lib/workflow-client.ts:387`) sleeps for a hard-coded 72 hours (`72 * 60 * 60 * 1000` ms) even in local dev mode. While the NODE_ENV === 'test' path correctly uses 0ms, a developer running `npm run dev` who triggers this workflow (e.g., by updating a lead's stage) will have their Node process blocked for 3 days. There is no practical scenario where a local dev process needs a 72-hour sleep — even a few seconds is enough to verify behavior.

## Current state

```ts
// src/lib/workflow-client.ts:387
const delayMs = process.env.NODE_ENV === 'test' ? 0 : 72 * 60 * 60 * 1000;
await new Promise((resolve) => setTimeout(resolve, delayMs));
```

The 72h constant was written to "meet acceptance criteria" (comment on line 385), but the acceptance criteria apply to production workflows running on Cloudflare, not to local Node.js simulations that terminate when the dev server restarts.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors   |

## Scope

**In scope**:
- `src/lib/workflow-client.ts` — the `delayMs` variable in `runSimulation`

**Out of scope**:
- Cloudflare Workflow binding logic — production path runs on Cloudflare's infrastructure and is not affected
- Any other part of `workflow-client.ts`

## Git workflow

- Branch: `advisor/042-fix-stalled-simulation-72h-sleep`
- Single commit: `fix: reduce simulation sleep from 72h to 10s for local dev; keep NODE_ENV=test at 0ms`

## Steps

### Step 1: Reduce the delay for non-test environments

In `src/lib/workflow-client.ts:387`, change:

```ts
const delayMs = process.env.NODE_ENV === 'test' ? 0 : 72 * 60 * 60 * 1000;
```

to:

```ts
const delayMs = process.env.NODE_ENV === 'test' ? 0 : 10000;
```

This gives 10 seconds — enough to observe the simulation behavior locally, short enough to not block dev workflow.

**Verify**: `npx tsc --noEmit` → exit 0

## Test plan

Covered by existing test that triggers the simulation path. Run:

```
npm test
```

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `grep '72 \* 60 \* 60' src/lib/workflow-client.ts` returns no matches
- [ ] `grep '10000' src/lib/workflow-client.ts` returns a match (the new delay)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the location in "Current state" doesn't match the excerpt.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- The 10s value is a heuristic. If developers need more time to observe the simulation, it can be increased to 30s. If they want to disable it entirely, a `SKIP_SIMULATION_SLEEP` env var could be added in the future.
- The NODE_ENV === 'test' path (0ms) is correct and should be preserved.
