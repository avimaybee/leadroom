# Plan 001: Eliminate hardcoded JWT fallback secret and complete environment variable documentation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d6c7ea6..HEAD -- src/lib/auth.ts .env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d6c7ea6`, 2026-06-14

## Why this matters

The JWT signing key falls back to a hardcoded string `'fallback-secret-key-at-least-32-chars-long'` when `AUTH_SECRET` is not set. Since `.env.example` does not list `AUTH_SECRET`, a developer setting up the project for the first time will have sessions signed with a publicly-known key. Anyone who reads the source code can forge valid session tokens and impersonate any user. This is a critical security gap for an internal tool that manages real business data.

Additionally, `.env.example` is incomplete — only 3 of ~8 required environment variables are documented, creating onboarding friction and increasing the risk of production misconfiguration.

## Current state

- The relevant files, each with one line on its role:
  - `src/lib/auth.ts` — JWT session encryption/decryption and password hashing using jose + PBKDF2
  - `.env.example` — template for required environment variables

- Code excerpt from `src/lib/auth.ts:3-16`:

```typescript
function getSecretKey(): Uint8Array {
  let secret: string | undefined;
  // Try Cloudflare context first (production worker)
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const cf = getCloudflareContext();
    secret = (cf?.env as any)?.AUTH_SECRET;
  } catch (e) {}
  // Fall back to process.env (local dev / tests)
  if (!secret) {
    secret = (typeof process !== 'undefined' ? process.env : undefined)?.AUTH_SECRET;
  }
  return new TextEncoder().encode(secret || 'fallback-secret-key-at-least-32-chars-long');
}
```

- Code excerpt from `.env.example` (complete file):

```
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=
```

- Repo conventions:
  - Error handling: throw plain `Error` objects; service callers catch and return `{ error: msg }` objects (see `src/app/actions/audits.ts:82-85`).
  - Environment access pattern: try Cloudflare context first, then `process.env` (see `src/db/index.ts:4-53`).

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                   | exit 0, no errors   |
| Lint      | `npm run lint`                       | exit 0              |
| Tests     | `node --import tsx --test src/**/*.test.ts` | all pass     |

## Scope

**In scope** (the only files you should modify):
- `src/lib/auth.ts`
- `.env.example`

**Out of scope** (do NOT touch, even though they look related):
- `.env`, `.env.local`, `.dev.vars` — these are gitignored files with real credentials; do not create, modify, or read them.
- `src/middleware.ts` — uses `verifySession` but does not need changes.
- `src/services/auth.ts` — uses the password hashing functions but does not need changes.

## Git workflow

- Branch: `advisor/001-fix-auth-secret`
- Commit style: `fix(security): <description>` (matches the repo's observed conventional-commit-ish style from `git log`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the fallback secret with a hard error

In `src/lib/auth.ts`, replace line 15:

```typescript
return new TextEncoder().encode(secret || 'fallback-secret-key-at-least-32-chars-long');
```

with:

```typescript
if (!secret) {
  throw new Error(
    'AUTH_SECRET environment variable is required but not set. ' +
    'Set it in .env.local (local dev) or as a Cloudflare secret (production). ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}
return new TextEncoder().encode(secret);
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 2: Update .env.example with all required environment variables

Replace the entire contents of `.env.example` with:

```
# === Required ===

# JWT session signing secret. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=

# === Cloudflare D1 (for remote DB operations) ===
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=

# === AI Provider Keys (configure at least one in Settings > Integrations) ===
# These are optional here — provider keys are stored in D1 via the integrations UI.
# GEMINI_API_KEY is the fallback if no provider is configured in the DB.
GEMINI_API_KEY=

# === Optional: Web Scraping ===
# Jina Reader API key for scraping (optional; works without key at lower rate limits)
JINA_API_KEY=

# === Optional: Discovery (Apify) ===
# Required only for the Discovery > Search feature (Google Maps scraping)
APIFY_TOKEN=
```

**Verify**: File exists and contains `AUTH_SECRET=` as the first non-comment variable.

### Step 3: Verify tests still pass

The test suite may fail if it hits the `getSecretKey()` path without `AUTH_SECRET` set. Check if any test file sets `AUTH_SECRET`:

Search for `AUTH_SECRET` in test files. If tests set it, they'll continue working. If they don't and they call auth functions, they will now throw. In that case, add `process.env.AUTH_SECRET = 'test-secret-at-least-32-chars-long-for-testing';` at the top of the affected test file.

**Verify**: `node --import tsx --test src/**/*.test.ts` → all pass.

## Test plan

- No new test file needed for this plan. The existing `auth.integration.test.ts` should continue to pass.
- If auth tests fail due to the removed fallback, add `process.env.AUTH_SECRET = 'test-only-secret-key-minimum-32-chars-long';` at the top of the test file. This is acceptable because test secrets are not real credentials.

## Done criteria

ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `node --import tsx --test src/**/*.test.ts` exits 0
- [ ] `grep -n "fallback-secret" src/lib/auth.ts` returns no matches
- [ ] `grep -n "AUTH_SECRET" .env.example` returns at least one match
- [ ] `.env.example` contains entries for: `AUTH_SECRET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN`, `GEMINI_API_KEY`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `src/lib/auth.ts:15` doesn't match the excerpt above (the codebase has drifted).
- The test suite fails and the failure is unrelated to the `AUTH_SECRET` change (e.g., a database connection issue).
- You discover that `getSecretKey()` is called during the Next.js build phase (not just at runtime) — the hard error would break the build.

## Maintenance notes

- If a new environment variable is added to the project in the future, update `.env.example` to document it.
- The `AUTH_SECRET` must be set in Cloudflare Workers secrets (via `wrangler secret put AUTH_SECRET`) for production deployment.
- The test suite should always set `AUTH_SECRET` explicitly in its setup, never relying on the developer's local environment.
