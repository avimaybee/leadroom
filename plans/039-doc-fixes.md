# Plan 039: Fix stale doc references and .env.example

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 691a737..HEAD -- AGENTS.md docs/PLAN.md .env.example`
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

Three documentation inconsistencies create confusion for new agents and human operators: AGENTS.md references docs/ paths that have been superseded by files in the repo root; PLAN.md says PostgreSQL but the actual stack uses SQLite (D1); .env.example references `AUTH_SECRET` but the codebase's actual env var is `SESSION_SECRET` (confirmed in `src/lib/auth.ts:62`). Fixing these prevents wasted debugging and plan failures from stale context.

## Current state

### 1. AGENTS.md (lines 94–98) — references `docs/` subdirectory that no longer exists

```markdown
Current operating assumption:

- `AGENTS.md` is the top-level operating contract.
- `PRD.md` defines the product requirements.
- `PLAN.md` defines the staged implementation plan.
- `ARCHITECTURE.md` defines the system structure.
- `TASKS.md` defines the next executable units of work.
```

These files are at the repo root (`PRD.md`, `PLAN.md`, etc.), not in `docs/`. The entire "Current Delivery Mode" section also says "This repository starts docs-first" and "Until core planning docs exist" — the planning docs exist and the codebase is past Stage 5. The section needs modernization.

### 2. `docs/PLAN.md` line 141 — wrong database technology

```markdown
### 4.3 Database

- PostgreSQL.
```

The actual stack uses SQLite (D1 via Cloudflare with Drizzle ORM's `sqliteTable`). The `drizzle.config.ts` and `src/db/schema/*` files use `sqliteTable`, not `pgTable`.

### 3. `.env.example` line 5 — wrong env var name

```
AUTH_SECRET=
```

The codebase reads `SESSION_SECRET` from env, confirmed in `src/lib/auth.ts` line ~62: `const secret = process.env.SESSION_SECRET`. If someone copies `.env.example` directly, auth will fail silently.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| View      | `cat AGENTS.md`    | File exists         |
| View      | `cat .env.example` | File exists         |

## Scope

**In scope** (the only files you should modify):
- `AGENTS.md`
- `docs/PLAN.md`
- `.env.example`

**Out of scope**:
- `src/` — code changes are in other plans
- `PRD.md`, `ARCHITECTURE.md`, `TASKS.md` — only update docs with factual inaccuracies listed above

## Git workflow

- Branch: `advisor/039-doc-fixes`
- Single commit: `docs: fix stale path references, PostgreSQL→SQLite, env var name`

## Steps

### Step 1: Update AGENTS.md

Replace the "Current Delivery Mode" section (lines 84–101) to reflect that planning docs exist and the project is past docs-first:

- Update the doc paths: remove `docs/` prefix — files are at repo root
- Remove or rephrase "This repository starts docs-first." and "Until core planning docs exist" — these docs exist
- Keep the constraint that agents must resolve contradictions before making broad changes

**Verify**: Read `head -105 AGENTS.md` and confirm the paths are correct and the tone is factual.

### Step 2: Update `docs/PLAN.md`

Find line 141 (`- PostgreSQL.`) and change to:

```
- SQLite (Cloudflare D1, via Drizzle ORM's sqliteTable).
```

**Verify**: `grep -n "PostgreSQL\|SQLite\|sqliteTable\|pgTable" docs/PLAN.md` — no "PostgreSQL" remains; the line reads "SQLite".

### Step 3: Update `.env.example`

Change `AUTH_SECRET=` to `SESSION_SECRET=`.

Also verify the comment above it still makes sense — it mentions "JWT session signing secret" which is correct for `SESSION_SECRET`.

**Verify**: `grep 'AUTH_SECRET' .env.example` returns no matches; `grep 'SESSION_SECRET' .env.example` returns a match.

## Test plan

No functional tests. Verification is by grep and visual inspection.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n 'docs/' AGENTS.md` finds only false positives (contextual references, not path claims about `docs/PRD.md` etc.)
- [ ] `grep -ni 'postgresql' docs/PLAN.md` returns no matches
- [ ] `grep 'AUTH_SECRET' .env.example` returns no matches
- [ ] `grep 'SESSION_SECRET' .env.example` returns a match
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- If `.env.example` diverges again after environment variable changes, keep it in sync manually or add a pre-commit check.
- AGENTS.md should be reviewed quarterly for stale assumptions.
