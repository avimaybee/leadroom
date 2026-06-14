# Plan 011: Context Reference Panel (UI/UX)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3ea78d2..HEAD -- src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx src/app/(dashboard)/leads/[id]/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx, ui
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

The `OutreachAssistant.tsx` requires the user to review and edit AI-generated drafts. However, because the Research and Audit summaries are located higher up on the long `page.tsx`, the operator must constantly scroll up and down to cross-reference data while writing or editing the draft. Adding a collapsible reference panel inside the Outreach component removes this cognitive friction and boosts productivity.

## Current state

- `src/app/(dashboard)/leads/[id]/page.tsx`: Passes only `leadId` and `initialDrafts` to `OutreachAssistant`. It has access to `latestSnapshot` (Research) and `latestAudit` (Audit).
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`: Contains the draft editor but no context about the lead.

**Conventions**: 
- Next.js server/client boundaries (page is Server, OutreachAssistant is Client).
- Tailwind classes for clean, aesthetic collapsible sections (e.g., `details` / `summary` tags or custom state-based accordions).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/app/(dashboard)/leads/[id]/page.tsx`
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`

**Out of scope**:
- Modifying the actual Audit or Research data models.

## Git workflow

- Branch: `advisor/011-context-panel`
- Commit message style: `feat(ui): add inline research and audit context panel to outreach assistant`

## Steps

### Step 1: Pass Research and Audit data to OutreachAssistant

In `src/app/(dashboard)/leads/[id]/page.tsx`:
Update the `<OutreachAssistant />` props to include `researchSnapshot={latestSnapshot}` and `auditSnapshot={latestAudit}`.

**Verify**: Ensure type safety by temporarily checking `npm run typecheck`. It will fail until Step 2 is complete.

### Step 2: Update `OutreachAssistantProps`

In `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`, update the interface:
```typescript
interface OutreachAssistantProps {
  leadId: string;
  initialDrafts: OutreachDraft[];
  researchSnapshot: any; // Type accurately if possible or use any for now
  auditSnapshot: any;
}
```

**Verify**: `npm run typecheck` → passes.

### Step 3: Render Collapsible Context Panel

Inside `OutreachAssistant.tsx`, just below the header and tabs, add a collapsible context panel.
- Use a state `[showContext, setShowContext] = useState(false)`.
- Render a toggle button: "View Lead Context".
- When expanded, show two minimal side-by-side or stacked summary cards for:
  1. **Audit Highlights**: `auditSnapshot?.keyWeaknesses`, `auditSnapshot?.opportunityHypotheses` (if mapped from research) or `auditSnapshot?.recommendedImprovements`.
  2. **Research Highlights**: `researchSnapshot?.companySummary`, `researchSnapshot?.painPointsHypotheses`.
- Style the panel with `bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[300px] overflow-y-auto text-xs`.

**Verify**: `npm run build` → exit 0.

## Test plan

- Manual test: Open a lead with research and audit data, expand the context panel inside the outreach assistant, and ensure you can view the data while editing a draft.
- `npm run typecheck` → passes.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `page.tsx` passes snapshot data.
- [ ] `OutreachAssistant.tsx` contains a toggleable reference panel.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:
- `page.tsx` does not have access to the snapshots (they were moved).

## Maintenance notes

- In the future, this data might be provided directly via an API call from the client to ensure it's always fresh without a full page reload, but for now passing from the Server Component is correct.
