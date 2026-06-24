# Plan 038: Fix server action auth gaps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 691a737..HEAD -- src/app/actions/ src/app/\(dashboard\)/settings/integrations/actions.ts src/app/\(dashboard\)/settings/pipeline/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Category**: security
- **Depends on**: none
- **Planned at**: commit `691a737`, 2026-06-24

## Why this matters

Four server actions perform privileged mutations (lead data, outreach drafts, tasks, integration provider configs) without authenticating the caller. While the login gate on the layout prevents unauthenticated page access, any compromised script, XSS, or CSRF-triggered fetch can call these endpoints directly. Adding an early return when `getUserId()` returns null prevents unauthorized mutations with zero behavioral change for legitimate users.

## Current state

### 1. `src/app/(dashboard)/settings/integrations/actions.ts` — no auth checks at all

Three exported actions (`saveIntegrationConfigAction`, `deleteIntegrationConfigAction`, `setActiveProviderAndModelAction`) never call `getUserId()`. They save API keys and provider configs to the database.

### 2. `src/app/actions/pipeline.ts:9` — `updateStageThreshold` never checks auth

```ts
export async function updateStageThreshold(stage: string, days: number) {
  const db = getDb();
  // ...
}
```

Calls `getDb()` but never calls `getUserId()` — any caller can mutate pipeline stage thresholds.

### 3. `src/app/actions/triage.ts:9` — `toggleTriageStatusAction` never checks auth

```ts
export async function toggleTriageStatusAction(
  entityType: 'lead' | 'task' | 'draft',
  entityId: string,
  isRead: boolean
) {
  const db = getDb();
  // ...
}
```

Mutates `isRead` on leads, tasks, and outreach drafts without checking who the caller is.

### 4. `src/app/actions/research.ts:17-33` — `saveResearchSnapshotAction` ignores auth result

```ts
export async function saveResearchSnapshotAction(prevState: ActionState, formData: FormData) {
  const service = await getService();
  const userId = await getUserId();
  // userId is never checked — proceeds even if null
```

Same pattern at `addContactAction` (line 71–73).

### Auth convention in the codebase

Plans 002b and 031 already established the pattern. Existing guarded actions (e.g., `updateNbaRulesAction`, `deleteTaskAction`) use:

```ts
import { getUserId } from '@/lib/auth';

export async function someAction(...args) {
  const userId = await getUserId();
  if (!userId) {
    return { error: 'Authentication required' };
  }
  // ...
}
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/app/(dashboard)/settings/integrations/actions.ts`
- `src/app/actions/pipeline.ts`
- `src/app/actions/triage.ts`
- `src/app/actions/research.ts`

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/auth.ts` — auth primitives are already correct
- Any UI component, page, or route handler — this is server-action-only
- Adding tests for the auth guard — the existing guard pattern is boilerplate; test coverage is tracked in plans 042–045

## Git workflow

- Branch: `advisor/038-fix-server-action-auth-gaps`
- Commit per file or one commit for all four; message style: `fix(security): add auth guard to <action-name>`

## Steps

### Step 1: Add auth guard to `updateStageThreshold` in `src/app/actions/pipeline.ts`

Add `getUserId` import if missing, then guard at the function top:

```ts
import { getUserId } from '@/lib/auth';

export async function updateStageThreshold(stage: string, days: number) {
  const userId = await getUserId();
  if (!userId) {
    return { error: 'Authentication required' };
  }
  // ...existing body
}
```

The function currently returns `void`. The new early return makes it `Promise<{ error: string } | void>`. TypeScript is lenient here — verify it compiles.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Add auth guard to `toggleTriageStatusAction` in `src/app/actions/triage.ts`

Add import and guard. The current return type is `Promise<void>`. After adding the guard, the TypeScript return type becomes `Promise<{ error: string } | void>` — verify it compiles.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Add auth guard to integrations actions in `src/app/(dashboard)/settings/integrations/actions.ts`

Add `import { getUserId } from '@/lib/auth'` at the top, then add the guard at the start of:

- `saveIntegrationConfigAction` (line 7)
- `deleteIntegrationConfigAction` (line 152)
- `setActiveProviderAndModelAction` (line 170)

Existing hooks already import but skip the null check. Also add `revalidatePath` import for `deleteIntegrationConfigAction` — it calls `revalidatePath` but doesn't import it.

Wait — verify `deleteIntegrationConfigAction` already imports `revalidatePath`. If not, add it.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 4: Fix `saveResearchSnapshotAction` and `addContactAction` in `src/app/actions/research.ts`

`getUserId()` is already called at lines 19 and 73 but the result is never checked. Add:

```ts
if (!userId) {
  return { error: 'Authentication required' };
}
```

immediately after each call.

**Verify**: `npx tsc --noEmit` → exit 0

## Test plan

No new tests. The change is a single guarded early return that mirrors the existing pattern used by `updateNbaRulesAction`, `deleteTaskAction`, etc. Existing tests must continue to pass — verify with:

```
npm test
```

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `npm run lint` exits 0
- [ ] Every action named above returns `{ error: 'Authentication required' }` when `getUserId()` returns null
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- `getUserId` is not available from `@/lib/auth` (check the import path in neighboring actions).

## Maintenance notes

- The `{ error: string } | void` implicit return type is not ideal but matches the existing codebase convention. If strict return types are enforced later, these actions will need explicit `Promise<ActionState>` signatures.
- `saveResearchSnapshotAction` and `addContactAction` already had `ActionState` return types — adding the guard is compatible.
