# Plan 048: Reconcile plan 037 — mark Stage 6 implementation as DONE

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 691a737..HEAD -- plans/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Category**: docs
- **Depends on**: none
- **Planned at**: commit `691a737`, 2026-06-24

## Why this matters

Plan 037 (`Stage 6 pipeline discipline`) is listed as PENDING in `plans/README.md` but all 7 work items plus 3 extras (dashboard redesign, stale alerts, stage aging bar) have been implemented and verified. Keeping it as PENDING creates confusion for any agent or human who reads the index — they'll think the work hasn't been done. This plan reconciles the record.

## Current state

`plans/README.md` line 48:

```
| 037  | Stage 6 pipeline discipline (7 work items) | P1 | XL | — | PENDING |
```

### Verification that implementation exists

All 7 original work items from plan 037 plus 3 extras have been implemented:

| # | Work item | Evidence in code |
|---|-----------|------------------|
| Wi1 | Pipeline dashboard: daily next-action summary | `src/app/(dashboard)/page.tsx` — `getNextBestActions` calls, NBA engine renders action cards |
| Wi2 | Stale-lead warning system | `LeadService.checkAndAlertStaleLeads` (line 542) + notification creation |
| Wi3 | Stage-aging visibility (lead detail) | `src/components/leads/StageAgeBar.tsx` + usage in `src/app/(dashboard)/leads/[id]/page.tsx` |
| Wi4 | Follow-up task auto-assignment | `LeadService.addTask` called from `createNotification` and `scheduleFollowUpTask` |
| Wi5 | Next-best-action engine | `LeadService.getNextBestActions` (line 607) + `evaluateSignal` + `DEFAULT_NBA_RULES` |
| Wi6 | Pipeline triage view (unread count, badge) | `src/components/leads/triage/TriageCard.tsx` + `unreadCount` in `getPipelineLead` |
| Wi7 | Stage transition tracking | `leadStageHistory` table, `advanceStageIfEarlier`, stage timeline view |
| Extras | Dashboard redesign | Updated dashboard layout with action cards, summary stats |
| Extras | Stale alerts (notifications) | `notifications` table with `title LIKE 'Lead stale:%'` and `'Lead aging:%'` |
| Extras | Stage aging bar | `StageAgeBar.tsx` component showing days in current stage |

TypeScript compiles cleanly (`npx tsc --noEmit` exits 0).

## Commands you will need

| Purpose    | Command            | Expected on success |
|------------|--------------------|---------------------|
| Typecheck  | `npx tsc --noEmit` | exit 0              |

## Scope

**In scope**:
- `plans/README.md`

**Out of scope**:
- Any source file — no code changes
- Plan 037 content — leave the plan file as-is for historical reference

## Git workflow

- Branch: `advisor/048-reconcile-plan-037`
- Single commit: `docs: mark plan 037 as DONE (Stage 6 fully implemented)`

## Steps

### Step 1: Update `plans/README.md` row for plan 037

Change:

```
| 037  | Stage 6 pipeline discipline (7 work items) | P1 | XL | — | PENDING |
```

to:

```
| 037  | Stage 6 pipeline discipline (7 work items + 3 extras) | P1 | XL | — | DONE |
```

**Verify**: `grep '037' plans/README.md` shows "DONE" in the status column.

### Step 2: Add new plans 038–047 rows to the index

After the plan 037 row, add rows for the new plans created in this cycle:

```
| 038  | Fix server action auth gaps | P1 | S | — | TODO |
| 039  | Fix stale doc references and .env.example | P2 | S | — | TODO |
| 040  | Fix login cookie Secure flag for local dev | P1 | S | — | TODO |
| 041  | Fix test env mutation pollution | P2 | S | — | TODO |
| 042  | Fix monitor-stalled simulation 72h sleep | P2 | S | — | TODO |
| 043  | Add test coverage for NBA engine | P2 | M | — | TODO |
| 044  | Add test coverage for stale alerts | P2 | M | — | TODO |
| 045  | Add test coverage + perf for funnel analytics | P2 | M | — | TODO |
| 046  | Consolidate duplicated stale-lead detection logic | P3 | S | — | TODO |
| 047  | Fix layering violations in pipeline settings page | P2 | S | — | TODO |
| 048  | Reconcile plan 037 index status | P2 | S | — | DONE |
```

Place them in numerical order (after 037).

**Verify**: `grep '038' plans/README.md` returns a match with the correct title.

## Test plan

No functional tests — documentation-only change.

## Done criteria

- [ ] `grep '037.*DONE' plans/README.md` returns a match
- [ ] `grep '038.*TODO' plans/README.md` returns a match
- [ ] Plans 039–048 each have a row in `plans/README.md`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated for this plan

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the claimed implemented features cannot be found in the codebase (use grep to verify each item in "Current state").
- `npx tsc --noEmit` does not exit 0 — if Stage 6 code has type errors, report rather than marking DONE.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- Plan 037's content remains as a historical record of the Stage 6 specification. It is intentionally not deleted.
- The 3 "extras" (dashboard redesign, stale alerts, stage aging bar) were not in the original plan but were implemented as part of the same Stage 6 delivery and are documented here for traceability.
