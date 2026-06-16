# Plan 026: Reconcile and update the plans index

> **Executor instructions**: Follow this plan step by step. When done, update the status row for this plan
> in `plans/README.md`.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `168c15f`, 2026-06-16

## Why this matters

The `plans/README.md` index file is currently out of date. It only lists plans 001 to 004, whereas there are plan files up to 025 in the folder. Keeping the index file correct is critical for the "reconcile" workflow and for keeping the status of completed, rejected, and active plans transparent for all agent sessions.

## Scope

**In scope**:
- `plans/README.md`

## Steps

### Step 1: Update plans/README.md
Read the slugs and categories of all files matching `plans/0*.md` and compile them into a unified table in `plans/README.md`. Mark them as `DONE`, `REJECTED`, or `TODO` based on their actual implementation status in the codebase.

## Done criteria

- [ ] `plans/README.md` lists all plans from `001` through `026` with correct status entries.
