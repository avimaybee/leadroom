# Plan 036: Create README.md and .editorconfig

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check**: `git diff --stat dc8430a..HEAD -- README.md .editorconfig`
> If these files already exist, only make changes if there's a meaningful gap.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `dc8430a`, 2026-06-22

## Why this matters

No README.md at the project root new developers have no onboarding entry point. No .editorconfig means editor behavior varies per developer.

## Current state

- No `README.md` at root (only `plans/README.md` and `UI-UX-overhaul/README.md`)
- No `.editorconfig`
- `.env.example` exists with documented env vars
- `package.json` scripts: `dev`, `build`, `test`, `lint`, `db:generate`, `db:migrate`, `db:seed`

## Commands you will need

None — just file creation.

## Scope

**In scope**: `README.md` (create), `.editorconfig` (create)
**Out of scope**: Pre-commit hooks, `.vscode/settings.json`, `CONTRIBUTING.md`

## Steps

### Step 1: Create `.editorconfig`

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

### Step 2: Create `README.md`

Create `README.md` with:
- **Title**: `# Leadroom`
- **Description**: Internal operating system for a small creative agency — lead discovery, research, website audit, scoring, outreach, and pipeline management.
- **Status note**: Active development. Link to `./plans/README.md`.
- **Quick Start**: copy `.env.example` to `.env.local`, edit values, `npm install`, `npm run dev`, open `http://localhost:3000`
- **Scripts**: table with `npm run dev` (start dev server), `npm run build` (build), `npm test` (run tests), `npm run lint` (lint), `npm run db:generate` (generate drizzle migrations), `npm run db:migrate` (apply local migrations), `npm run db:seed` (seed data)
- **Project Structure**: brief overview of `src/app/` (pages/routes), `src/services/` (business logic), `src/db/` (schema + tests), `src/lib/` (shared utilities), `src/components/` (shared UI), `plans/` (implementation plans)
- **Key Docs**: link to `plans/README.md`, `UI-UX-overhaul/PLAN.md`, `AGENTS.md`

## Done criteria

- [ ] `README.md` exists at the project root with setup instructions
- [ ] `.editorconfig` exists at the project root
- [ ] Only these 2 new files are added (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

If `README.md` or `.editorconfig` already exist, compare content. Only update if there's a meaningful gap — don't overwrite existing content without cause.

## Maintenance notes

Keep the README up to date as setup steps evolve. The `.editorconfig` rarely needs changes once created.
