# Plan 003: Remove dynamic require calls breaking Edge build

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b2fa80d..HEAD -- src/app/actions/leads.ts src/app/api/discovery/search/route.ts src/app/api/leads/[id]/audit/route.ts src/app/api/leads/[id]/research/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt / build
- **Planned at**: commit `b2fa80d`, 2026-06-15

## Why this matters

Several API routes and server actions recently added a dynamic `require('@opennextjs/cloudflare')` block wrapped in a `try/catch`. Dynamic `require()` statements inside async execution paths break Next.js App Router edge builds and standard webpack/turbopack dependency analysis. We should remove the inline dynamic requires and use statically analyzable imports or strictly `process.env` lookups.

## Current state

- `src/app/actions/leads.ts`, `src/app/api/discovery/search/route.ts`, `src/app/api/leads/[id]/audit/route.ts`, `src/app/api/leads/[id]/research/route.ts`

Excerpts:
`src/app/api/discovery/search/route.ts:56-62`
```typescript
    let workflowBinding: any = undefined;
    try {
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      workflowBinding = getCloudflareContext().env?.DISCOVERY_SEARCH_WORKFLOW;
    } catch (e) {}
    if (!workflowBinding) {
      workflowBinding = (process.env as any)?.DISCOVERY_SEARCH_WORKFLOW;
    }
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |

## Scope

**In scope**:
- `src/app/actions/leads.ts`
- `src/app/api/discovery/search/route.ts`
- `src/app/api/leads/[id]/audit/route.ts`
- `src/app/api/leads/[id]/research/route.ts`

**Out of scope**:
- Other files not explicitly mentioned.

## Git workflow

- Branch: `advisor/003-fix-dynamic-require`
- Commit message style: `refactor: remove dynamic requires for edge compatibility`

## Steps

### Step 1: Standardise Workflow Binding Fetching
In all 4 files, remove the `try { const { getCloudflareContext } = require(...) }` block entirely. 
Replace it with a simple, standard environment variable lookup:
```typescript
const workflowBinding = (process.env as any)?.WORKFLOW_NAME_HERE;
```
If `@opennextjs/cloudflare` is strictly needed for deployment context, import `getCloudflareContext` as a standard static `import` at the top of the file, wrapped such that it doesn't execute at build time, but standard `process.env` is the safest fallback.
Given Next.js automatically injects bindings into `process.env` via Cloudflare Pages or OpenNext, just reverting to the clean `(process.env as any)?.TRIAGE_WORKFLOW` (and equivalent for others) is the best solution.

**Verify**: `npx tsc --noEmit` -> ensure the build doesn't throw.

## Test plan

- Run `npx tsc --noEmit`

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] No `require('@opennextjs/cloudflare')` calls remain in the `src/app` directory.
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- Removing it causes immediate type errors related to `CloudflareWorkflow` that cannot be resolved.

## Maintenance notes

- Bypassing standard module boundaries with `require` is an anti-pattern in modern Edge JavaScript.
