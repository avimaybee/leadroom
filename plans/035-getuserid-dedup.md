# Plan 035: Deduplicate 10 `getUserId` Implementations Into Shared Import

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat dc8430a..HEAD -- src/app/actions/ src/app/api/ src/lib/auth.ts`
> If the working tree has changes to these files, compare the current code
> against the excerpts below before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `dc8430a`, 2026-06-22

## Why this matters

10 files (5 server actions + 5 API routes) each independently re-implement the same `getUserId()` function that decrypts a session cookie. The canonical version at `src/lib/auth.ts:112` is already exported and correct. All 10 duplicates need to be replaced with a single import.

If the session cookie name, encryption algorithm, or test bypass changes in the future, all 10 must be updated in lockstep or they silently diverge.

## Current state

The canonical version at `src/lib/auth.ts` (read the file to find the exact export — it should export `getUserId` or similar):

```ts
// At src/lib/auth.ts — exported and ready to use
export async function getUserId(): Promise<string | null> {
  if (process.env.NODE_ENV === 'test') return 'user_123';
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    const payload = await decrypt(sessionToken);
    return payload?.userId || null;
  } catch {
    return null;
  }
}
```

Files that duplicate this (confirmed by reading):

1. `src/app/actions/outreach.ts:13-21`
2. `src/app/actions/audits.ts:14-22`
3. `src/app/actions/leads.ts:17-25`
4. `src/app/actions/tasks.ts:14-22`
5. `src/app/actions/research.ts:15-23`
6. `src/app/api/jobs/[id]/route.ts:10-18`
7. `src/app/api/discovery/import/route.ts:13-21`
8. `src/app/api/discovery/recent/route.ts:10-18`
9. `src/app/api/leads/[id]/research/route.ts:22-30`
10. `src/app/api/leads/[id]/research/cancel/route.ts:11-19`

Files that ALREADY import correctly (do NOT touch):
- `src/app/api/candidates/route.ts` — imports from `@/lib/auth`
- `src/app/api/scopes/route.ts` — imports from `@/lib/auth`
- `src/app/api/market-metrics/route.ts` — imports from `@/lib/auth`
- `src/app/api/jobs/[id]/cancel/route.ts` — imports from `@/lib/auth`
- `src/app/api/notifications/route.ts` — imports from `@/lib/auth`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | `Compiled successfully` |
| Tests     | `npm test`               | All pass |

## Scope

**In scope** (the only files you should modify):
- 10 files listed above that duplicate `getUserId`

**Out of scope**:
- Files that already import `getUserId` correctly — leave them alone
- `src/lib/auth.ts` — the canonical version is fine, do not modify it
- Adding/removing any other imports or code

## Steps

### Step 1: Verify the canonical export

Read `src/lib/auth.ts` and find the exported `getUserId` function. Confirm it has the same signature (`async () => Promise<string | null>`). It should not need any parameters — it reads `cookies()` internally.

If it finds `cookies()` from `next/headers`, it must be `async` and awaits the `cookies()` call (Next.js 16 requires `await cookies()`).

**Verify**: No command needed — just confirm the export exists.

### Step 2: Fix each duplicate file

For each of the 10 files:

1. **Add import** at the top of the file (in the imports section, alongside existing `@/` imports):
   ```ts
   import { getUserId } from '@/lib/auth';
   ```

2. **Remove the local** `async function getUserId() { ... }` block. It's typically near the top of the file, after imports and before the route/action handlers. Delete the entire function from its opening line to its closing `}`.

3. **Keep the call sites** unchanged — they already call `getUserId()`, and now the import will resolve to the canonical version.

### Step 3: Build and test

```bash
npm run build
```

Then run the core tests:

```bash
node --import tsx --test src/db/__tests__/outreach.actions.test.ts src/db/__tests__/routes.test.ts
```

All should pass.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] All tests pass
- [ ] `grep -rl "async function getUserId" src/app/actions/ src/app/api/` returns zero matches (all local definitions removed)
- [ ] `grep -rl "from '@/lib/auth'" src/app/actions/ src/app/api/leads/\[id\]/research/ src/app/api/discovery/ src/app/api/jobs/\[id\]/route.ts` confirms imports exist in the 10 files
- [ ] Only the 10 in-scope files are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The canonical `getUserId` in `src/lib/auth.ts` has a different signature or behavior than the duplicates (e.g. it throws instead of returning `null`, or it's not async).
- A file in scope uses `getUserId` in a way that depends on local variable state (unlikely — all duplicates use the same pattern).

## Maintenance notes

- When a new API route or server action needs the user ID, always import from `@/lib/auth` — never re-implement.
- The `NODE_ENV === 'test'` bypass is already in the canonical version, so test compatibility is preserved.
