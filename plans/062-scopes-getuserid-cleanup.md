# Plan 062: Deduplicate Session Verification in Scopes Action

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 38561c5..HEAD -- src/app/actions/scopes.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `38561c5`, 2026-06-29

## Why this matters
All recent Server Actions retrieve the currently authenticated user's ID via the standard `getUserId` helper in `@/lib/auth`. However, `src/app/actions/scopes.ts` manually parses cookies, extracts the token, and calls `verifySession`, replicating session verification logic. Consolidating this cleans up redundant code and simplifies future session-handling migrations.

## Current state
`src/app/actions/scopes.ts:21-28` manually decodes cookies:
```ts
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const sessionPayload = await verifySession(sessionToken);

  if (!sessionPayload || !sessionPayload.userId) {
    return { error: 'Unauthorized. Please log in.' };
  }
```
All other actions call:
```ts
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope**:
- `src/app/actions/scopes.ts`

**Out of scope**:
- Modifications to routes outside discovery scopes.

## Git workflow
- Branch: `advisor/062-scopes-getuserid-cleanup`
- Commit message format: `refactor: deduplicate session verification in scopes.ts`

## Steps

### Step 1: Replace manual verification in `scopes.ts`
1. Remove imports of `cookies` and `verifySession`.
2. Import `getUserId` from `@/lib/auth`.
3. In `createScopeAction`, replace the cookie-parsing block with a call to `getUserId()`.
4. Update referencing fields (e.g. `createdByUserId: userId`).
**Verify**: `npx tsc --noEmit` -> succeeds.

## Test plan
- Run the test suite using `npm test` to ensure discovery scope tests still execute correctly and mock authentications verify successfully.

## Done criteria
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npm test` passes.
- [ ] No manual cookie parsing or `verifySession` references exist in `src/app/actions/scopes.ts`.
- [ ] `plans/README.md` status row updated.

## STOP conditions
- None.

## Maintenance notes
- None.
