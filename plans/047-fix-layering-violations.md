# Plan 047: Fix layering violations — move inline schema queries out of page component

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 691a737..HEAD -- src/app/\(dashboard\)/settings/pipeline/ src/services/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Category**: tech-debt
- **Depends on**: none
- **Planned at**: commit `691a737`, 2026-06-24

## Why this matters

The Pipeline Settings page (`src/app/(dashboard)/settings/pipeline/page.tsx`) directly imports `getDb()` and the `stageThresholds` schema and runs a raw Drizzle query in its default export function. This is a layering violation — page components should call service methods, not touch the database or schema directly. It also duplicates the threshold-querying logic that already exists in `LeadService.checkAndAlertStaleLeads` (which reads `stageThresholds` indirectly via the service layer). Moving this query to a service method centralizes data access and makes the page testable without a full DB.

## Current state

```tsx
// src/app/(dashboard)/settings/pipeline/page.tsx
import { getDb } from '@/db';
import { stageThresholds } from '@/db/schema/core';

export default async function PipelineSettingsPage() {
  const db = getDb();
  const rows = await db.select().from(stageThresholds);
  // ... renders rows ...
}
```

This is the only page component in the codebase that imports schema symbols and calls `getDb()` directly. Every other settings page uses a service or action.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors   |

## Scope

**In scope**:
- `src/services/lead.ts` — add a `getStageThresholds` method
- `src/app/(dashboard)/settings/pipeline/page.tsx` — use the service instead of direct DB call

**Out of scope**:
- `src/app/actions/pipeline.ts` — `updateStageThreshold` is a mutation action, it's fine
- Other page components — only this one has the violation
- `LeadService.checkAndAlertStaleLeads` — it already reads thresholds internally; the new method exposes a clean query

## Git workflow

- Branch: `advisor/047-fix-layering-violations`
- Single commit: `refactor: move pipeline settings page query to LeadService to fix layering violation`

## Steps

### Step 1: Add `getStageThresholds` to `LeadService`

In `src/services/lead.ts`, add a public method (near the other query methods, around line 80–100):

```ts
async getStageThresholds(): Promise<{ stage: string; days: number }[]> {
  const { stageThresholds } = await import('@/db/schema/core');
  return this.db.select({ stage: stageThresholds.stage, days: stageThresholds.days }).from(stageThresholds);
}
```

The dynamic import avoids a top-level schema import in the service file (though this service file already imports schemas — check existing imports first). If `stageThresholds` is already imported at the top of the file, use it directly.

Check the existing imports in `src/services/lead.ts`:
```ts
import { leads, tasks, notifications, leadStageHistory, stageThresholds, pipelineConfig, providerConfigs } from '@/db/schema/core';
```

If `stageThresholds` is already imported, use it without dynamic import.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Update Pipeline settings page

In `src/app/(dashboard)/settings/pipeline/page.tsx`:

- Remove `import { getDb } from '@/db'`
- Remove `import { stageThresholds } from '@/db/schema/core'`
- Add `import { LeadService } from '@/services/lead'`
- Replace:
  ```ts
  const db = getDb();
  const rows = await db.select().from(stageThresholds);
  ```
  with:
  ```ts
  const service = new LeadService(getDb());
  const rows = await service.getStageThresholds();
  ```

But `getDb()` is no longer imported — you need it for the constructor. Keep the `getDb` import or import it again. Actually the simplest change:

```tsx
import { getDb } from '@/db';
import { LeadService } from '@/services/lead';

export default async function PipelineSettingsPage() {
  const rows = await new LeadService(getDb()).getStageThresholds();
  // ...
}
```

Remove the `stageThresholds` schema import but keep `getDb`.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Run full suite

**Verify**: `npm test` → all pass

## Test plan

Modify `src/db/__tests__/functions.test.ts` if it tests pipeline page behavior. Otherwise:

No behavioral change — the query is identical. Run existing tests.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `grep 'from.*stageThresholds' src/app/\(dashboard\)/settings/pipeline/page.tsx` returns no matches
- [ ] `grep 'getDb\(\)' src/app/\(dashboard\)/settings/pipeline/page.tsx` still returns a match (needed for LeadService constructor)
- [ ] `grep 'new LeadService' src/app/\(dashboard\)/settings/pipeline/page.tsx` returns a match
- [ ] `grep 'getStageThresholds' src/services/lead.ts` returns a match (method definition)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- `getStageThresholds` already exists in `LeadService` (unlikely but check).
- The page component has other schema-level operations beyond the single query.

## Maintenance notes

- If more settings pages are added, they should follow this service-layer pattern.
- `getStageThresholds` is a thin pass-through method. If the threshold query grows (e.g., filtering, caching), the service method is the right place.
