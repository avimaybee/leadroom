# Plan 040: Fix login cookie Secure flag for local dev

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 691a737..HEAD -- src/app/api/auth/login/route.ts src/app/api/auth/logout/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Category**: bug
- **Depends on**: none
- **Planned at**: commit `691a737`, 2026-06-24

## Why this matters

The login endpoint always sets `Secure` on the session cookie (`src/app/api/auth/login/route.ts:33`), even when running on localhost over HTTP. Browsers ignore cookies with `Secure` on non-HTTPS connections, making login completely broken in `npm run dev`. The logout endpoint (`src/app/api/auth/logout/route.ts:7`) already handles this correctly by checking the request URL scheme — login should follow the same pattern.

## Current state

### Login — always Secure (broken on localhost)

```ts
// src/app/api/auth/login/route.ts:33
response.headers.append(
  'Set-Cookie',
  `session=${result.session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
);
```

### Logout — conditionally Secure (correct pattern)

```ts
// src/app/api/auth/logout/route.ts:7
const isSecure = request.url.startsWith('https://');
response.headers.append(
  'Set-Cookie',
  `session=; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`
);
```

The login route has access to `request: NextRequest` — same pattern is available.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors   |

## Scope

**In scope**:
- `src/app/api/auth/login/route.ts`

**Out of scope**:
- `src/app/api/auth/logout/route.ts` — already correct
- `src/lib/auth.ts` — auth primitives are correct
- Any UI or action file

## Git workflow

- Branch: `advisor/040-fix-login-cookie-secure-flag`
- Single commit: `fix: conditionally set Secure flag on login cookie (broken on localhost)`

## Steps

### Step 1: Update login cookie to conditionally set Secure

In `src/app/api/auth/login/route.ts`, after constructing `response` and before appending the Set-Cookie header, add:

```ts
const isSecure = request.url.startsWith('https://');
```

Then change the Set-Cookie line from:

```ts
`session=${result.session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
```

to:

```ts
`session=${result.session}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=86400`
```

**Verify**: `npx tsc --noEmit` → exit 0

## Test plan

No new tests. The change mirrors the logout handler's pattern exactly, which is already proven correct. Login behavior is covered by existing auth integration tests in `src/db/__tests__/auth.integration.test.ts`.

```
npm test
```

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `grep 'Secure;' src/app/api/auth/login/route.ts` shows `Secure` conditionally set (preceded by `${isSecure ? ...}`), not unconditionally
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- If the cookie-setting logic is extracted to a shared helper in the future, both login and logout should use it.
