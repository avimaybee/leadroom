# Plan 032: Create ESLint Configuration

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat dc8430a..HEAD -- eslint.config.mjs`
> If the file already exists, confirm its contents match what's needed here
> and only proceed if there's a gap.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `dc8430a`, 2026-06-22

## Why this matters

`eslint` v9.39.4 and `eslint-config-next` v16.2.9 are installed as devDependencies in `package.json`, but no config file exists. Running `npm run lint` crashes with a directory-resolution error. This means:

- No automated code-style enforcement.
- No React-hooks/exhaustive-deps checking.
- No accessibility rule enforcement.
- No import-ordering or unused-import detection.
- Developers get zero feedback from the lint script.

Fixing this is a ~10 minute task that unlocks the entire lint pipeline.

## Current state

- `package.json:9` has `"lint": "next lint"`
- `package.json:54-55` has `eslint` ^9.39.4 and `eslint-config-next` ^16.2.9
- No `.eslintrc*` or `eslint.config.*` file exists anywhere in the repo
- Next.js 16 uses ESLint v9 flat config format, not the legacy `.eslintrc` format

The repo uses:
- TypeScript strict mode (from `tsconfig.json`)
- Tailwind CSS v4 (from `package.json:57`)
- React 19 with the new JSX transform

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Lint      | `npm run lint`           | exit 0 (or reports lint violations, but doesn't crash) |
| Build     | `npm run build`          | `Compiled successfully` |

## Scope

**In scope** (the only file you should create):
- `eslint.config.mjs` — ESLint v9 flat config in the project root

**Out of scope**:
- Fixing any pre-existing lint violations this config surfaces
- Adding plugins beyond `eslint-config-next`
- Adding prettier, husky, lint-staged, or other tooling

## Steps

### Step 1: Create `eslint.config.mjs`

Create an ESLint v9 flat config file at the repo root. Use the `eslint-config-next` compatibility layer since `eslint-config-next` hasn't fully migrated to flat config.

```mjs
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  js.configs.recommended,
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // Allow unused vars with underscore prefix
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
```

Note: `@eslint/eslintrc` is a transitive dependency of `eslint-config-next` and should be available. The `FlatCompat` wrapper lets Next.js config work with ESLint v9's flat config format.

**Verify**: `npm run lint` → exits 0 or reports lint violations. It must NOT crash with directory-resolution errors. Expected output is either clean or a list of lint warnings/errors.

### Step 2: Verify build still passes

`npm run build` → `Compiled successfully` with no TypeScript errors.

## Test plan

- `npm run lint` should at least run without crashing.
- `npm run build` should still compile cleanly.

## Done criteria

- [ ] `eslint.config.mjs` exists at the project root
- [ ] `npm run lint` runs without crashing (it may report pre-existing violations; that's expected)
- [ ] `npm run build` exits 0
- [ ] Only `eslint.config.mjs` is added (`git status` confirms no other changes)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- `node_modules` does not contain `@eslint/eslintrc` or the `FlatCompat` class is not available — in that case use a different approach (e.g. `eslint.config.js` with CommonJS `require('@eslint/eslintrc').FlatCompat`).
- Installing dependencies is required (shouldn't be — `eslint` and `eslint-config-next` are already installed).

## Maintenance notes

- The config is minimal by design. As the project grows, add rules for `@typescript-eslint`, `import/order`, `jsx-a11y`, and `react-hooks/exhaustive-deps`.
- Pre-existing lint violations should be recorded in a tracking issue or `TODO` comments — don't fix them in this plan.
