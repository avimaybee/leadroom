# Plan 031: Fix Logout Cookie, Stack Traces, and Error Messages in API 500s

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat dc8430a..HEAD -- src/app/api/auth/logout/route.ts src/app/error.tsx "src/app/(dashboard)/leads/[id]/ClientActivityList.tsx" src/app/api/auth/login/route.ts src/app/api/auth/me/route.ts src/app/api/leads/ src/app/api/discovery/import/route.ts src/app/api/candidates/route.ts src/app/api/settings/models/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `dc8430a`, 2026-06-22

## Why this matters

Three independent security/correctness issues that take minutes each to fix:

1. **Logout cookie `Secure` flag**: Login was fixed earlier to conditionally omit `Secure` on HTTP, but the logout route was missed. Users on local dev (HTTP) can log in but cannot log out — the browser rejects the `Secure` cookie-clearing response.
2. **Stack traces in client UI**: Internal server paths, file layout, and function names leak to the browser in the error page and activity detail dialogs.
3. **Internal error messages in API 500 responses**: 7 API routes return `error.message` verbatim in the 500 response body, potentially leaking schema details or credential fragments.

## Current state

### A. Logout cookie (route has no `request` param)

`src/app/api/auth/logout/route.ts:5-15`:

```ts
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.append(
    'Set-Cookie',
    'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
  );
  return response;
}
```

The login route (already fixed) at `src/app/api/auth/login/route.ts` shows the pattern to follow:

```ts
const response = NextResponse.json({ success: true, user: result.user });
const isSecure = request.url.startsWith('https://');
response.headers.append(
  'Set-Cookie',
  `session=${result.session}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=86400`
);
```

### B. Stack traces

`src/app/error.tsx:67-69`:

```tsx
<div className="bg-destructive/5 text-destructive p-6 rounded-2xl border border-destructive/15 text-sm font-mono whitespace-pre-wrap max-h-60 overflow-y-auto mb-6">
  {error.stack || error.message}
</div>
```

`src/app/(dashboard)/leads/[id]/ClientActivityList.tsx:225-228`:

```tsx
{activeMetadata.error.stack && (
  <pre className="text-[10px] text-muted-foreground overflow-x-auto bg-background/50 p-2 rounded border border-border font-mono leading-relaxed">
    {activeMetadata.error.stack}
  </pre>
)}
```

### C. Error messages in API 500s

All 7 routes follow the same pattern (e.g. `src/app/api/auth/login/route.ts:41-42`):

```ts
const errMsg = error instanceof Error ? error.message : 'Internal server error';
return NextResponse.json({ error: errMsg }, { status: 500 });
```

Affected routes:
- `src/app/api/auth/login/route.ts:41-42`
- `src/app/api/auth/me/route.ts:31-32`
- `src/app/api/leads/[id]/research/route.ts:100-102`
- `src/app/api/leads/[id]/research/cancel/route.ts:74-76`
- `src/app/api/discovery/import/route.ts:124`
- `src/app/api/candidates/route.ts:88`
- `src/app/api/settings/models/route.ts:108`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | `Compiled successfully`, TypeScript passes |
| Tests     | `npm test`               | All pass (pre-existing timeout on discovery.integration.test.ts is OK) |

## Scope

**In scope**:
- `src/app/api/auth/logout/route.ts`
- `src/app/error.tsx`
- `src/app/(dashboard)/leads/[id]/ClientActivityList.tsx`
- `src/app/api/auth/login/route.ts` (verify only — should already be fixed)
- `src/app/api/auth/me/route.ts`
- `src/app/api/leads/[id]/research/route.ts`
- `src/app/api/leads/[id]/research/cancel/route.ts`
- `src/app/api/discovery/import/route.ts`
- `src/app/api/candidates/route.ts`
- `src/app/api/settings/models/route.ts`

**Out of scope**:
- Any other error-handling patterns in the codebase (23 empty catch blocks are a separate plan)
- Any other routes or components not listed

## Steps

### Step 1: Fix logout cookie

In `src/app/api/auth/logout/route.ts`:
1. Add `request` parameter to the `POST` handler: `export async function POST(request: NextRequest) {`
2. Compute `const isSecure = request.url.startsWith('https://');`
3. Build the cookie string conditionally, exactly like the login route does.

Target code shape:

```ts
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  const isSecure = request.url.startsWith('https://');
  response.headers.append(
    'Set-Cookie',
    `session=; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`
  );
  return response;
}
```

**Verify**: `npm run build` → `Compiled successfully` with no errors.

### Step 2: Fix stack traces in client UI

In `src/app/error.tsx:68`:
- Change `{error.stack || error.message}` to `{error.message}`

In `src/app/(dashboard)/leads/[id]/ClientActivityList.tsx:225-228`:
- Remove the entire `<pre>` block that renders `activeMetadata.error.stack`
- Keep the `.message` rendering at line 224

Target code shape:

```tsx
// line 224 stays
<p className="text-xs text-destructive/80 font-medium">{activeMetadata.error.message}</p>
// lines 225-229 completely removed — no stack trace rendering
```

**Verify**: `npm run build` → `Compiled successfully` with no errors.

### Step 3: Fix 7 API route error handlers

In each of the 7 routes, change the 500 error handler to return a generic message and log the real error server-side.

The pattern to follow (identical in every route):

Current (example from `login/route.ts`):
```ts
} catch (error: unknown) {
  const errMsg = error instanceof Error ? error.message : 'Internal server error';
  return NextResponse.json({ error: errMsg }, { status: 500 });
}
```

Target:
```ts
} catch (error: unknown) {
  console.error('Login error:', error);
  return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
}
```

Repeat in all 7 files. Customise the `console.error` prefix per route (`'Login error'`, `'Auth me error'`, `'Research start error'`, `'Research cancel error'`, `'Import error'`, `'Candidates error'`, `'Settings models error'`).

**Verify**: `npm run build` → `Compiled successfully` with no errors.

## Test plan

No new tests needed — these are error-handling paths that are hard to trigger deterministically. The existing test suite confirms no regression in the normal path:

`node --import tsx --test src/db/__tests__/routes.test.ts src/db/__tests__/outreach.actions.test.ts src/db/__tests__/settings.integration.test.ts`

Expected: all pass.

## Done criteria

- [ ] `npm run build` exits 0 with `Compiled successfully`
- [ ] `grep -rn '"session=; HttpOnly; Secure;' src/app/api/auth/logout` returns no matches (the hardcoded `Secure` is gone)
- [ ] `grep -rn 'error\.stack' src/app/error.tsx src/app/\(dashboard\)/leads/\[id\]/ClientActivityList.tsx` returns no matches
- [ ] Each of the 7 API routes has `'An internal error occurred'` instead of `error.message` in the 500 response body
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The login route at `login/route.ts` already uses generic error messages or has different cookie logic than shown — the fix was applied in an earlier session; only verify, don't re-edit.
- A file in the scope list has changed significantly since the excerpts above.
- Any step's verification fails twice.

## Maintenance notes

- If other API routes are added, reviewers should check they use generic 500 messages and log the real error server-side.
- The `error.tsx` stack trace fix means developers see `error.message` only in the browser; full stack traces are still visible in server-side console logs and the browser devtools console.
