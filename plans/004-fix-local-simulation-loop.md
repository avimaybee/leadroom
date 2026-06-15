# Plan 004: Add hard timeout to local simulation polling loop

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b2fa80d..HEAD -- src/lib/workflow-client.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `b2fa80d`, 2026-06-15

## Why this matters

In `src/lib/workflow-client.ts`, the local dev simulation for `triggerDiscoverySearchWorkflow` polls the Apify status in a `while (status === 'RUNNING' || status === 'READY')` loop. A recent commit removed the max-timeout limit (`timeoutMs`). If the Apify actor hangs, the local development server API route leaves a zombie promise running indefinitely. We must restore a reasonable polling limit (matching the actual workflow configuration of ~50 minutes) so local servers don't eventually crash.

## Current state

- `src/lib/workflow-client.ts`

Excerpts:
`src/lib/workflow-client.ts:327-330`
```typescript
      while (status === 'RUNNING' || status === 'READY') {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        status = await checkApifyRunStatus(runId);
      }
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |

## Scope

**In scope**:
- `src/lib/workflow-client.ts`

**Out of scope**:
- Actual Cloudflare Workflow implementation in `src/workflows/discovery-search.ts`.

## Git workflow

- Branch: `advisor/004-fix-local-simulation-loop`
- Commit message style: `fix: add timeout to discovery workflow simulation loop`

## Steps

### Step 1: Add a retry limit to the loop
In `src/lib/workflow-client.ts` inside `triggerDiscoverySearchWorkflow`'s `runSimulation` function:
1. Before the `while` loop, initialise a counter `let retries = 0;` and `const maxRetries = 600;` (600 * 5s = 50 minutes).
2. Inside the `while` loop, increment `retries++`.
3. At the start of the loop body, check `if (retries >= maxRetries) { throw new Error('Apify actor run timed out during local simulation'); }`.

**Verify**: `npx tsc --noEmit` -> ensure the build passes.

## Test plan

- Run `npx tsc --noEmit`.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] Loop correctly increments and throws after `maxRetries`.
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- The file has changed significantly and `runSimulation` no longer exists.

## Maintenance notes

- Local simulations of workflows should always replicate the timeouts encoded in the actual Workflows class logic.
