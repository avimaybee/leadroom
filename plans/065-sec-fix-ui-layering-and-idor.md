# Plan 065: Fix Layering Violations and Data Leakage (IDOR) in SDR Pivot UI

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 38561c5..HEAD -- src/app/(dashboard)/page.tsx src/app/(dashboard)/prospects/[id]/page.tsx`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / architecture
- **Planned at**: commit `38561c5`

## Why this matters

During the SDR Pivot, new UI components (`DashboardPage` and `ProspectDetailPage`) were built with direct Drizzle ORM queries (`db.select().from(prospects)...`) embedded directly into the React Server Components. This creates two critical issues:
1. **Layering Violation**: It bypasses the Modular Monolith boundary rules specified in `GEMINI.md`, scattering database logic into the presentation layer.
2. **Security Vulnerability (Data Leakage / IDOR)**: The raw queries currently fail to filter prospects by the logged-in user or workspace. Any authenticated user can view the entire system's prospects by visiting the dashboard or guessing an ID.

## Current state

- The relevant files:
  - `src/app/(dashboard)/page.tsx` — queries the Top 100 prospects without an owner filter.
  - `src/app/(dashboard)/prospects/[id]/page.tsx` — fetches prospect details without verifying ownership.
  - `src/services/lead.ts` — The appropriate service layer for prospect retrieval.

- Code excerpt from `src/app/(dashboard)/page.tsx`:
```tsx
  const [scopes, funnel, scoredProspects] = await Promise.all([
    discoveryService.listScopes(userId ?? undefined),
    leadService.getStageFunnel(),
    db
      .select({
        id: prospects.id,
        // ...
      })
      .from(prospects)
      .where(sql`${prospects.fitScore} IS NOT NULL`)
      .orderBy(desc(prospects.fitScore))
      .limit(100),
  ]);
```

## Steps to execute

1. **Add `getDashboardProspects` to `LeadService`**:
   - In `src/services/lead.ts`, add a method `getDashboardProspects(userId: string)` that performs the exact `db.select()` currently found in `DashboardPage`, but appends an `eq(prospects.ownerId, userId)` (or workspace check) to the `where` clause.
   - Return the strictly typed results.

2. **Add `getProspectDetail` to `LeadService`**:
   - In `src/services/lead.ts`, add `getProspectDetail(id: string, userId: string)` that fetches the prospect and verifies `ownerId === userId`. If not matched, return `null`.

3. **Refactor `DashboardPage`**:
   - In `src/app/(dashboard)/page.tsx`, remove the raw Drizzle query for `scoredProspects`.
   - Call `await leadService.getDashboardProspects(userId)` instead.
   - Ensure the `import { getDb }` and Drizzle schema imports are removed if no longer used.

4. **Refactor `ProspectDetailPage`**:
   - In `src/app/(dashboard)/prospects/[id]/page.tsx`, remove the raw `prospects`, `researchTasks`, and `outreachDrafts` DB queries.
   - Call the new `LeadService` method (or existing service methods for tasks/drafts, passing `userId` for authorization).
   - If the service returns `null` (unauthorized or not found), trigger `notFound()`.

5. **Verify authorization**:
   - Write a quick test in `src/db/__tests__/lead.integration.test.ts` confirming `getDashboardProspects` and `getProspectDetail` return empty/null when an unrelated `userId` is passed.

## Done criteria

- `src/app/(dashboard)/page.tsx` no longer imports `drizzle-orm` or `prospects` schema directly.
- `src/app/(dashboard)/prospects/[id]/page.tsx` correctly delegates data fetching to services and validates user ownership.
- `npx tsc --noEmit` exits 0.
- `npm test` passes completely.

## Maintenance note
Future UI additions must route through the Service Layer (e.g. `LeadService`, `ScoringService`) to guarantee centralized authorization checks.

## STOP conditions
- If you find that prospects are explicitly *designed* to be global and lacking an `ownerId` or `workspaceId` in the schema (e.g., public data model), STOP and ask for clarification instead of forcing a nonexistent column.
