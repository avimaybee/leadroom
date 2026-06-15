# Plan 001: Fix Edge-incompatible rate limiter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b2fa80d..HEAD -- src/lib/rate-limit.ts src/app/api/discovery/search/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / security
- **Planned at**: commit `b2fa80d`, 2026-06-15

## Why this matters

The current rate limiter in `src/lib/rate-limit.ts` uses an in-memory `Map`. Although a recent commit added stale key eviction, it explicitly notes that it is "LOCAL-DEV ONLY" and does not work across Cloudflare Worker isolates. In production, this means the rate limiter resets constantly per isolate, leaving the expensive Apify crawler endpoints vulnerable to abuse. We must securely query the `job_runs` table instead of using transient memory.

## Current state

- `src/lib/rate-limit.ts` — Contains the `RateLimiter` class using a JS `Map` and exports `discoverySearchLimiter`.
- `src/app/api/discovery/search/route.ts` — Uses `discoverySearchLimiter.check(userId)` synchronously.

Excerpts:
`src/lib/rate-limit.ts:12-13`
```typescript
export class RateLimiter {
  private store = new Map<string, number[]>();
```

`src/app/api/discovery/search/route.ts:413-416`
```typescript
  if (!discoverySearchLimiter.check(userId)) {
    return NextResponse.json({ error: 'Too many requests. Please wait before starting another search.' }, { status: 429 });
  }
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |

## Scope

**In scope**:
- `src/lib/rate-limit.ts`
- `src/app/api/discovery/search/route.ts`

**Out of scope**:
- Modifying the D1 schema (do not create new tables).

## Git workflow

- Branch: `advisor/001-fix-rate-limit`
- Commit message style: `fix: replace in-memory rate limiting with db query`

## Steps

### Step 1: Rewrite rate limiter to use DB
Rewrite `src/lib/rate-limit.ts`. Instead of a class with an in-memory map, export an async function `checkDiscoveryRateLimit(db: Db, userId: string): Promise<boolean>` that checks the `job_runs` table.
The logic: Select the count of recent jobs where `jobType === 'DISCOVERY_SEARCH'` and `triggeredByUserId === userId` within the last 60 seconds (or the value of `RATE_LIMIT_WINDOW_MS`).
If the count >= `RATE_LIMIT_MAX` (default 5), return false. Otherwise, return true.
Note: Import `jobRuns` from `src/db/schema/research.ts`.

### Step 2: Update the API route
In `src/app/api/discovery/search/route.ts`, update the limiter check. Move the `getDb()` call *above* the rate limiter check.
Change `if (!discoverySearchLimiter.check(userId))` to `if (!(await checkDiscoveryRateLimit(db, userId)))`.
Remove the old `discoverySearchLimiter` import and import `checkDiscoveryRateLimit`.

**Verify**: `npx tsc --noEmit` -> zero errors.

## Test plan
- Run `npx tsc --noEmit`

## Done criteria
- [ ] `npx tsc --noEmit` exits 0
- [ ] `src/lib/rate-limit.ts` no longer uses a `Map`
- [ ] `src/app/api/discovery/search/route.ts` passes the `db` to the async check
- [ ] `plans/README.md` status row updated

## STOP conditions
Stop and report back (do not improvise) if:
- `jobRuns` table does not have a `triggeredByUserId` field.
