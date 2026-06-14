# Plan 004: Fix workflow promises and dashboard N+1 queries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d6c7ea6..HEAD -- src/lib/workflow-client.ts src/services/discovery.ts src/app/(dashboard)/page.tsx`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness & performance
- **Planned at**: commit `d6c7ea6`, 2026-06-14

## Why this matters

1. **Bug**: In `workflow-client.ts`, local dev mode triggers background simulations via `runSimulation()`. Since `waitUntil` is unavailable in standard Node.js, these are fire-and-forget promises. Currently, they lack `.catch()`. Unhandled promise rejections can crash modern Node.js processes.
2. **Performance**: On the dashboard, `page.tsx` computes pending candidates by looping over every scope and running a database query per scope (`listCandidatesByScope`). This N+1 query pattern will slow down the dashboard linearly as scopes increase.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                   | exit 0, no errors   |

## Scope

**In scope**:
- `src/lib/workflow-client.ts`
- `src/services/discovery.ts`
- `src/app/(dashboard)/page.tsx`

## Steps

### Step 1: Fix Unhandled Promise Rejections

In `src/lib/workflow-client.ts`, locate the 4 `else` blocks that execute simulations when `ctx.waitUntil` is missing (lines ~160, 265, 369, 486).

Change:
```typescript
runSimulation();
```
(and `runTriageSimulation()`)

To:
```typescript
runSimulation().catch((err) => console.error('[WorkflowClient] Unhandled simulation error:', err));
```
(or `runTriageSimulation().catch(...)`).

### Step 2: Add N+1 safe query to DiscoveryService

In `src/services/discovery.ts`, add a new method below `listCandidatesByScope`:

```typescript
import { sql } from 'drizzle-orm';

// ... existing code ...

  async countPendingCandidates(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(candidateLeads)
      .where(eq(candidateLeads.status, 'NEW'));
    
    return Number(result[0]?.count || 0);
  }
```

### Step 3: Use the new method in Dashboard

In `src/app/(dashboard)/page.tsx`, replace the N+1 loop (lines ~27-30):

```typescript
  let pendingCandidatesCount = 0;
  for (const scope of scopes) {
    const candidates = await discoveryService.listCandidatesByScope(scope.id);
    pendingCandidatesCount += candidates.filter((c) => c.status === 'NEW').length;
  }
```

With:

```typescript
  const pendingCandidatesCount = await discoveryService.countPendingCandidates();
```

**Verify**: `npx tsc --noEmit` exits 0.

## Done criteria

- [ ] 4 fire-and-forget promises in `workflow-client.ts` have `.catch()` handlers.
- [ ] `countPendingCandidates` added to `DiscoveryService`.
- [ ] `page.tsx` uses `countPendingCandidates` instead of looping.
- [ ] `plans/README.md` status row updated.
