# Plan 002: Add auth checks to state-changing server actions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d6c7ea6..HEAD -- src/app/actions/leads.ts src/app/actions/tasks.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: Plan 001 (Recommended, though not strictly blocking)
- **Category**: security
- **Planned at**: commit `d6c7ea6`, 2026-06-14

## Why this matters

Currently, `leads.ts` and `tasks.ts` server actions mutate the database without verifying the user's session. While the pages calling these actions are protected by Next.js middleware, server actions expose independent endpoints that any authenticated user could call with arbitrary data.

More importantly for the product workflow, lacking the `userId` in these actions means that system activities (like "Lead created" or "Task completed") cannot be accurately attributed to the operator who performed them. The system needs this for the future pipeline discipline stage (Stage 6). We must bring these files up to parity with `audits.ts` and `research.ts`.

## Current state

- `src/app/actions/leads.ts`: Contains `createLeadAction`, `archiveLeadAction`, `updateStageAction`, `updateLeadAction`, `addNoteAction`. None check the session.
- `src/app/actions/tasks.ts`: Contains `createTaskAction`, `toggleTaskStatusAction`. Neither checks the session.
- Both files lack the `getUserId()` helper found in `audits.ts`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                   | exit 0, no errors   |
| Lint      | `npm run lint`                       | exit 0              |
| Tests     | `node --import tsx --test src/**/*.test.ts` | all pass     |

## Scope

**In scope** (only files you should modify):
- `src/app/actions/leads.ts`
- `src/app/actions/tasks.ts`

**Out of scope**:
- `src/services/lead.ts` — The service layer is already robust; we just need to pass the userId down or rely on the actions to block unauthorized calls. (Wait, let's check: the service layer's `addNote` accepts an `authorId`. We should pass `userId` to it.)
- `src/app/actions/audits.ts` and `src/app/actions/research.ts` — these are already correct.

## Git workflow

- Branch: `advisor/002-action-auth-checks`
- Commit style: `fix(security): enforce auth checks on lead and task server actions`

## Steps

### Step 1: Add `getUserId` helper and imports to `leads.ts`

In `src/app/actions/leads.ts`:
1. Add imports:
   ```typescript
   import { cookies } from 'next/headers';
   import { decrypt } from '@/lib/auth';
   ```
2. Add the helper function above the actions:
   ```typescript
   async function getUserId() {
     try {
       const cookieStore = await cookies();
       const sessionToken = cookieStore.get('session')?.value;
       const payload = await decrypt(sessionToken);
       return payload?.userId || null;
     } catch (e) {
       return null;
     }
   }
   ```

### Step 2: Enforce auth in all `leads.ts` actions

Update each exported action in `src/app/actions/leads.ts`:
- **createLeadAction**:
  ```typescript
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  ```
  Pass `ownerId: userId` into the `rawData` or `validated.data` if appropriate, but minimally just block if no userId.
- **archiveLeadAction**:
  ```typescript
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized'); // No prevState here, so throw
  ```
- **updateStageAction**:
  ```typescript
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');
  ```
- **updateLeadAction**:
  ```typescript
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  ```
- **addNoteAction**:
  ```typescript
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  // ...
  await service.addNote(leadId, userId, body); // <-- Pass userId here instead of null
  ```

### Step 3: Add `getUserId` helper and imports to `tasks.ts`

In `src/app/actions/tasks.ts`, repeat Step 1 (add imports and `getUserId()`).

### Step 4: Enforce auth in all `tasks.ts` actions

Update each exported action in `src/app/actions/tasks.ts`:
- **createTaskAction**:
  ```typescript
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  ```
- **toggleTaskStatusAction**:
  ```typescript
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');
  ```

**Verify**: `npx tsc --noEmit` exits 0.

## Done criteria

ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `node --import tsx --test src/**/*.test.ts` exits 0
- [ ] `leads.ts` has `getUserId()` checks in all 5 actions.
- [ ] `tasks.ts` has `getUserId()` checks in all 2 actions.
- [ ] `addNote` in `leads.ts` passes the `userId` instead of `null`.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:
- `getUserId` logic needs to diverge from the pattern above.
- You find any action in these files that legitimately needs to be unauthenticated (e.g., a public webhook), which contradicts our audit findings.
