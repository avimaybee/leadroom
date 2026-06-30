# Plan 060: Secure Credential Storage via Cryptographic Encryption at Rest

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 38561c5..HEAD -- src/services/integrations.ts src/services/calendar.ts src/db/schema/core.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `38561c5`, 2026-06-29

## Why this matters
The D1 SQLite database currently stores sensitive third-party API Keys and OAuth tokens in plaintext inside the `provider_configs` and `google_calendar_tokens` tables. If the database file is leaked, or if an SQL injection vulnerability is exploited, all connected user integrations (e.g. OpenAI/Gemini keys, Google OAuth tokens) will be exposed. This plan introduces symmetric encryption using the Web Crypto API to secure credentials at rest.

## Current state
`src/db/schema/core.ts` defines `providerConfigs` and `googleCalendarTokens` with standard text fields for keys:
```ts
export const providerConfigs = sqliteTable('provider_configs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull().unique(), 
  apiKey: text('api_key').notNull(),
  modelName: text('model_name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  ...
});

export const googleCalendarTokens = sqliteTable('google_calendar_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  ...
  googleClientSecret: text('google_client_secret'),
  ...
});
```
`IntegrationsService` and `CalendarService` read and write these columns in plaintext.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope**:
- `src/lib/crypto.ts` (create)
- `src/services/integrations.ts`
- `src/services/calendar.ts`

**Out of scope**:
- Database schema changes (we store the encrypted ciphertext as a hex string in the existing `text` columns).
- UI adjustments.

## Git workflow
- Branch: `advisor/060-sec-encrypt-db-credentials`
- Commit per file updated. Message format: `security: encrypt api_key in IntegrationsService`

## Steps

### Step 1: Create encryption utilities in `src/lib/crypto.ts`
Implement standard Web Crypto AES-GCM encryption and decryption helpers:
```ts
const ENCRYPTION_KEY_VAR = 'DB_ENCRYPTION_KEY';

async function getKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(text: string, secret: string): Promise<string> {
  if (!text) return '';
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  const buffer = new Uint8Array(iv.length + encrypted.byteLength);
  buffer.set(iv, 0);
  buffer.set(new Uint8Array(encrypted), iv.length);
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function decrypt(hexString: string, secret: string): Promise<string> {
  if (!hexString) return '';
  const key = await getKey(secret);
  const bytes = new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}
```
**Verify**: `npx tsc --noEmit` -> succeeds.

### Step 2: Update `IntegrationsService` to encrypt/decrypt API keys
Import `encrypt` and `decrypt` from `@/lib/crypto` inside `src/services/integrations.ts`.
1. Retrieve secret: `const secret = process.env.DB_ENCRYPTION_KEY || 'fallback_key_dev';`
2. In `saveProviderConfig(...)`: encrypt `apiKey` before Drizzle insert/update.
3. In `getProviderConfig(...)`: decrypt `apiKey` after retrieval.
**Verify**: `npm test` -> succeeds.

### Step 3: Update `CalendarService` to encrypt/decrypt OAuth credentials
Import `encrypt` and `decrypt` from `@/lib/crypto` inside `src/services/calendar.ts`.
1. Retrieve secret: `const secret = process.env.DB_ENCRYPTION_KEY || 'fallback_key_dev';`
2. In `saveCredentials(...)` and `saveTokens(...)`: encrypt `googleClientSecret`, `accessToken`, and `refreshToken` before insert/update.
3. In loaders/getters: decrypt them after retrieval.
**Verify**: `npm test` -> succeeds.

## Test plan
- Add unit tests in `src/lib/__tests__/crypto.test.ts` verifying `encrypt` and `decrypt` work correctly, that encrypting the same text twice produces different ciphers, and that decryption with an invalid secret throws.
- Verify with `npm test`.

## Done criteria
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npm test` passes completely.
- [ ] Configured API keys and tokens in local D1 are verified to be encrypted hex string blobs.
- [ ] `plans/README.md` status row updated.

## STOP conditions
- Environment doesn't support Web Crypto API (e.g. legacy node). (Ensure using modern Node LTS / Cloudflare Workers environment).
- Encryption secret is missing from local `.env` and fallback fails.

## Maintenance notes
- Document `DB_ENCRYPTION_KEY` in `.env.example` as a required environment variable for production deployments.
