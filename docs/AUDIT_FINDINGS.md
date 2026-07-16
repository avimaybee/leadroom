# Audit Findings — Leadroom

Generated 2026-07-15 by 20 parallel sub-agents covering build, deps, edge runtime,
error paths, DB schema, auth, Zod, AI, scraper, async safety, imports, scripts,
memory/performance, security, logging, queue/jobs, CF limits, error UX, CSS,
and Next.js patterns.

Legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · ⚪ Info

---

## 0. Build & Immediate Fixes

| # | Sev | File:Line | Issue | Notes |
|---|-----|-----------|-------|-------|
| 0.1 | | *global* | 21 dashboard pages used `export const revalidate = N` causing WeakMap+stringify crash during `next build`. All changed to `export const dynamic = 'force-dynamic'`. | Pages depend on user session so ISR pre-render was invalid. |
| 0.2 | 🔴 | `src/lib/scraper.ts:206-208` | Buffer truncation: `total` not incremented → `RangeError` on sites >512KB HTML | **Fixed** |
| 0.3 | 🟠 | `src/lib/ai.ts` (19 sites) | `signal` (per-attempt deadline) not propagated to `callAnthropic`/`callOpenAICompatible` — fallback timeout was 60s regardless of chain budget | **Fixed** |
| 0.4 | 🟡 | `src/workflows/discovery-search.ts:164` | Cancellation sets `FAILED` not `CANCELLED`; notification shows "Failed" not "Cancelled" | **Fixed** |
| 0.5 | 🟡 | `src/services/logging.ts:29-73` | Timer flush has no `waitUntil` — logs silently dropped on worker termination | **Fixed** |

---

## 1. Dependencies & Package Config

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 1.1 | 🟡 | `package.json:29` | `dotenv` in `dependencies` (never imported in `src/`) — dead weight |
| 1.2 | 🟡 | `package.json:39` | `shadcn` in `dependencies` — CLI tool, should be devDependency |
| 1.3 | 🟡 | `package.json:24` | `@cloudflare/puppeteer` — never imported, dead dependency |
| 1.4 | 🟡 | `package.json:25` | `@google/jules-sdk` — never imported, dead dependency |
| 1.5 | 🟡 | `package.json:47` | `@google/jules-cli` installed from unversioned Firebase Storage URL — supply-chain risk |
| 1.6 | 🟡 | `package.json:6` | `build` script uses `--webpack` flag that doesn't exist in Next.js CLI |
| 1.7 | 🟡 | `package.json:*` | Missing `"type": "module"` — ESM projects should declare this |
| 1.8 | 🟡 | `.gitignore:10` | `package-lock.json` gitignored — breaks reproducible builds |
| 1.9 | 🟡 | `eslint.config.mjs:2` | `@eslint/js` imported but not in devDependencies (transitive dep) |
| 1.10 | 🟡 | `package.json:10` | Test script `"node --import tsx --test"` has no glob pattern — may skip test files |
| 1.11 | 🔵 | `package.json:17-19` | Three deploy variants (`preview`, `deploy`, `upload`) — unclear what `upload` does vs `deploy` |
| 1.12 | 🔵 | `.gitignore:11,18` | Duplicate `.wrangler` entry (once without slash, once with) |

---

## 2. tsconfig & TypeScript Config

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 2.1 | 🟡 | `tsconfig.json:43` | `src/entry.ts` excluded from type-checking — 3 workflow files + entry point not validated |
| 2.2 | 🔵 | `tsconfig.json:39` | Includes `.next/dev/types/**/*.ts` — dir may not exist in CI/production |
| 2.3 | 🔵 | *(missing)* | No `.nvmrc` or `.node-version` — teams/CI may use incompatible Node versions |

---

## 3. Deployment Config (Wrangler / OpenNext)

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 3.1 | 🟠 | `wrangler.jsonc:24-26` | Browser binding `BROWSER` may fail in local dev without dev proxy config |
| 3.2 | 🟠 | `wrangler.jsonc:*` | No `[vars]` section — many production secrets must be configured via `wrangler secret put` |
| 3.3 | 🟠 | (*missing from .env.example*) | `CRON_SECRET` env var not documented anywhere, used in `src/app/api/cron/sweeps/route.ts:12` |
| 3.4 | 🟡 | `cloudflare-env.d.ts` | Auto-generated file tracked in git — can get out of sync with wrangler.jsonc |
| 3.5 | 🟡 | `open-next.config.ts:1-8` | No `queue` or `middleware` handler configuration — accept OpenNext defaults |
| 3.6 | 🟡 | `next.config.mjs:37-38` | Dynamic import `import("@opennextjs/cloudflare").then(...)` has no `.catch()` — unhandled rejection in dev |
| 3.7 | 🟡 | `src/entry.ts:1` | `// @ts-ignore` on `import handler from '../.open-next/worker.js'` — fragile, silent failure if build path changes |
| 3.8 | 🟡 | `src/entry.ts:7-11` | `process.on('unhandledRejection')` — dead code in Workers (process.on unavailable even with nodejs_compat) |
| 3.9 | 🔵 | `wrangler.jsonc:45-61` | No workflow retry/timeout config — all retry logic is embedded per-workflow-step |

---

## 4. Environment Variables & Secrets

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 4.1 | 🔴 | `.env` | Plaintext credentials (JULES_API_KEY, CLOUDFLARE_ACCOUNT_ID) on disk — check git tracking |
| 4.2 | 🔴 | `.dev.vars` | Plaintext AUTH_SECRET, APIFY_API_TOKEN — local security risk |
| 4.3 | 🟠 | `src/services/calendar.ts:11` | `DB_ENCRYPTION_KEY` used with no validation — missing key causes cryptic crypto failure |
| 4.4 | 🟠 | `src/services/integrations.ts:7` | Same — `DB_ENCRYPTION_KEY` no startup validation |
| 4.5 | 🟡 | `src/lib/ai.ts:254-255` | No soft fallback when all AI API keys missing — hard throw, no mock data path |
| 4.6 | 🟡 | `src/app/(dashboard)/settings/integrations/page.tsx:23` | `process.env.DB_ENCRYPTION_KEY` may not resolve with CF Secrets (vs vars) |
| 4.7 | 🟡 | `src/lib/rate-limit.ts:114-115` | `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` have defaults but no `.env.example` docs |

---

## 5. Edge Runtime Compatibility

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 5.1 | 🟡 | `src/app/actions/research.ts:13` | `import crypto from 'crypto'` — should use global `crypto.randomUUID()` instead of Node.js module |
| 5.2 | 🟡 | `src/app/(dashboard)/settings/integrations/page.tsx:23` | `process.env` in server component — may not have CF Secrets |
| 5.3 | 🟡 | `src/services/calendar.ts:55` | `Buffer.from(...).toString('base64')` — works with nodejs_compat but Workers-native `btoa()` is cleaner |
| 5.4 | 🟡 | `src/entry.ts:7-11` | `process.on('unhandledRejection')` — not available in Workers, dead code |
| 5.5 | 🟠 | `src/layout.tsx:2` | `next/font/google` Geist font — fragile with OpenNext; verify renders in deployed preview |
| 5.6 | 🟠 | `src/lib/auth.ts:2` (and 3 API routes) | `cookies()` from `next/headers` — depends on OpenNext async-local-storage context propagation |
| 5.7 | 🟡 | `src/app/api/settings/models/route.ts:54` | `AbortSignal.timeout()` — verify with `compatibility_date: 2026-07-12` |

---

## 6. Database Schema & Queries

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 6.1 | 🟠 | `src/db/schema/discovery.ts:17` | `discoveryScopes.createdByUserId` NOT NULL, no default, no FK |
| 6.2 | 🟠 | `src/workflows/research-snapshot.ts:347` | **ALL** research tasks for prospect set to FAILED on ANY task failure (broad `where(prospectId)`) |
| 6.3 | 🟠 | `migrations/0007_goofy_earthquake.sql` | Uses `DROP COLUMN` — incompatible with SQLite < 3.35.0 |
| 6.4 | 🟠 | `migrations/meta/` | Missing snapshots for 7 migrations (0022-0029) — `drizzle-kit generate` may break |
| 6.5 | 🟡 | `migrations/meta/_journal.json` | Migrations 0023/0024 have reversed chronological timestamps — merge/rebase issue |
| 6.6 | 🟡 | `src/services/scoring.ts:205-211` | Non-atomic batch — partial failure leaves inconsistent state (scores + lead fitReasoning) |
| 6.7 | 🟡 | `src/services/lead.ts:461-472` | Non-atomic stage update batch — partial failure corrupts stage history |
| 6.8 | 🟡 | `src/app/actions/strategy.ts:65,137` | `db.select()` no `.limit()` on offers/icp_profiles — full table scan |
| 6.9 | 🟡 | `src/db/index.ts:50-61` | Dynamic `require('./local-mock')` pulls in `better-sqlite3` (~2MB) — can't be tree-shaken |
| 6.10 | 🔵 | *Multiple schema files* | ~20 columns store JSON as plain `text()` without `{ mode: 'json' }` — manual parse required everywhere |
| 6.11 | 🔵 | `.env:2-4` | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN` — dead config, never read by code |
| 6.12 | 🔵 | `src/db/schema.ts:9` | `leads` alias for `prospects` table — inconsistent naming across 15+ files |

---

## 7. Query Performance (Missing LIMITs)

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 7.1 | 🔴 | `src/services/lead.ts:820-827` | `getAvgDaysInAllStages()` — no `.limit()`, full table scan on `leadStageHistory` |
| 7.2 | 🔴 | `src/services/lead.ts:780-793` | `getStageFunnel()` — two full table scans, no `.limit()`, no date range filter |
| 7.3 | 🟠 | `src/app/(dashboard)/leads/page.tsx:50` | `leadScores` query without `.limit()` |
| 7.4 | 🟠 | `src/app/(dashboard)/leads/page.tsx:55-57` | `discoveryScopes` left join without `.limit()` |
| 7.5 | 🟠 | `src/app/(dashboard)/leads/page.tsx:67` | `tasks` query without `.limit()` |
| 7.6 | 🟠 | `src/app/(dashboard)/leads/page.tsx:74-75` | `jobRuns` + `discoveryScopes` without `.limit()` |
| 7.7 | 🟡 | `src/services/discovery.ts:37,77,114,125` | 4 queries by ID without `.limit(1)` |

---

## 8. Auth & Middleware

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 8.1 | 🔴 | `src/app/api/prospects/signals/route.ts:1-47` | **No authentication at all** — anyone can POST prospectIds and extract research signals (data leak) |
| 8.2 | 🟡 | `src/app/actions/leads.ts:172-177` | `verifyStageRequirementsAction` — no auth check, unauthenticated callers can probe stage requirements |
| 8.3 | 🟡 | `src/app/actions/prospects.ts:172-177` | Duplicate of 8.2 — same function in prospects file |
| 8.4 | 🟡 | `src/app/actions/leads.ts:179-182` | `getUnmetStageRequirementsAction` — no auth check |
| 8.5 | 🟡 | `src/app/actions/prospects.ts:179-182` | Duplicate of 8.4 |
| 8.6 | 🔵 | `src/app/actions/outreach.ts:22-37` | `getModelInfoAction` — no auth check (returns model metadata only, low risk) |
| 8.7 | 🟡 | `src/app/api/approvals/count/route.ts:13` | Returns `{ count: 0 }` instead of 401 for unauthenticated |
| 8.8 | 🟡 | `src/app/api/learning/count/route.ts:13` | Same — returns `{ count: 0 }` instead of 401 |
| 8.9 | 🟡 | `src/middleware.ts:26` | Matcher excludes `api/cron` prefix — any future route under that path without own auth is unprotected |
| 8.10 | 🔵 | `src/middleware.ts:18` | Login redirect doesn't preserve original URL (`?redirectTo=`) — UX issue |

---

## 9. Zod Schemas & Input Validation

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 9.1 | 🔴 | `src/lib/ai.ts` (30+ locations) | `.parse()` not wrapped in try/catch — AI output that structurally valid but wrong types crashes the operation |
| 9.2 | 🟠 | `src/lib/ai.ts:76` | `CitedEvidenceItemSchema.sourceUrl` — no `.url()` validation |
| 9.3 | 🟠 | `src/lib/ai.ts:1727` | `AIExtractedSignalsSchema.signals[].sourceUrl` — no `.url()` |
| 9.4 | 🟠 | `src/lib/domain/schemas.ts:38` | `DisqualifierSchema.sourceUrl` — no `.url()` |
| 9.5 | 🟠 | `src/lib/domain/schemas.ts:48` | `DraftOutputSchema.citedEvidence[].sourceUrl` — no `.url()` |
| 9.6 | 🟠 | `src/lib/ai.ts:37` | `AIContactExtractionSchema.people[].email` — no `.email()` validation |
| 9.7 | 🟠 | `src/app/actions/research.ts:308` | `addContactAction` — email from formData not validated with `.email()` |
| 9.8 | 🟠 | `src/app/actions/research.ts:310` | `addContactAction` — linkedinUrl from formData not validated with `.url()` |
| 9.9 | 🟡 | `src/lib/ai.ts:11-19` | AI string fields accepting empty strings — no `.min(1)` on summary fields |
| 9.10 | 🟡 | `src/db/models/discovery.ts:12` | `.default(true).optional()` combo — `undefined` bypasses default |
| 9.11 | 🟡 | *7 API routes* | `request.json()` cast with `as` — no Zod validation (settings/models, discovery/import, discovery/search, prospects/signals, candidates, scopes, auth/firebase) |
| 9.12 | 🟡 | `src/app/actions/research.ts:104-186` | CSV import parsed with manual `.split(',')` — no schema, no escape handling |
| 9.13 | 🟡 | `src/app/actions/strategy.ts:98-99,169-171` | `JSON.parse(proofsRaw)` not in try/catch — malformed form data crashes |

---

## 10. AI Service Reliability

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 10.1 | 🔴 | `src/lib/ai.ts:393,619,1004,1167,1343` | Gemini API key sent in URL query parameter (`?key=...`) — logged by every proxy/CDN |
| 10.2 | 🔴 | `src/lib/ai.ts` (14+ locations) | `JSON.parse(textResult)` in Gemini/Anthropic branches not wrapped in try/catch — invalid AI output crashes |
| 10.3 | 🟠 | `src/lib/ai.ts:808-810` | No 429 vs 500 distinction — rate limits and server errors treated identically |
| 10.4 | 🟠 | `src/lib/ai.ts:293` | Backoff max 2 seconds — rate limit windows are typically 30-60s; no jitter |
| 10.5 | 🟠 | `src/lib/ai.ts:317-389` (4+ functions) | No prompt truncation — scraped content (up to 15K chars) embedded verbatim, could exceed model context |
| 10.6 | 🟠 | *Entire `src/`* | No token usage tracking — impossible to monitor AI spending |
| 10.7 | 🟠 | `src/lib/ai.ts:262-297` | No intra-provider retry — one attempt per provider then failover |
| 10.8 | 🟡 | `src/lib/ai.ts:777` | `max_tokens: 4096` too low for OpenAI-compatible research — output may be truncated |
| 10.9 | 🟡 | `src/lib/ai.ts:1958-1967` | 7 AI functions have no fallback for parse failure (only `generateContactExtraction` and `extractICPSignals` do) |
| 10.10 | 🟡 | `src/lib/ai.ts:292` | Error messages may leak API keys — `lastError.message` not sanitized before logging |
| 10.11 | 🟡 | `src/app/(dashboard)/settings/integrations/actions.ts:53` | Gemini API key in URL query param during model validation |
| 10.12 | 🔵 | `src/lib/ai.ts:94,116` | API keys cached in-memory maps with 30-60s TTL |
| 10.13 | 🔵 | `src/lib/ai.ts:1570-1610` | `generateMockOutreachDraft` — exported but never called, dead code |
| 10.14 | 🔵 | `src/lib/ai.ts:787-802` | NVIDIA strict-schema failure permanently cached — transient 400 permanently downgrades to json_object mode |

---

## 11. Scraper Reliability

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 11.1 | 🟡 | `src/lib/scraper.ts:220-224` | No distinction between transient network errors and permanent DNS failures — both consume fallback budget |
| 11.2 | 🟡 | `src/lib/scraper.ts:184` | HTTP status codes discarded — 404 (permanent) and 503 (transient) treated identically |
| 11.3 | 🟡 | `src/lib/scraper.ts:142` | No per-hop timeout in redirect chain — single slow hop can hang entire scraper |
| 11.4 | 🟡 | `src/lib/scraper.ts:194-197` | Content-Type check happens after body download starts — wastes bandwidth on PDFs/images |
| 11.5 | 🟡 | `src/lib/scraper.ts:195` | `application/xhtml+xml` and other valid HTML variants rejected |
| 11.6 | 🟡 | `src/lib/scraper.ts:176` | User-Agent hardcoded (not configurable via env) |
| 11.7 | 🟡 | `src/lib/contacts/extract.ts:78-109` | Relative URLs not resolved against base URL in contact extraction |
| 11.8 | 🟡 | *Entire `src/`* | No robots.txt compliance — scraper crawls URLs regardless of disallowances |
| 11.9 | 🟡 | `src/lib/scraper.ts:164-224,527-538` | No politeness/crawl delay in direct scraper |
| 11.10 | 🟡 | `src/lib/scraper.ts` | No URL deduplication — same URL can be fetched multiple times concurrently |
| 11.11 | 🟡 | `src/lib/contacts/extract.ts:82-85` | No validation of extracted href values — `javascript:`, `data:` URIs captured as social links |
| 11.12 | 🟡 | `src/lib/scraper.ts:415` | `JSON.parse(responseText)` not in try/catch — Jina response parsing can crash |

---

## 12. Unhandled JSON.parse() (Systemic)

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 12.1 | 🔴 | `src/services/learning.ts:158` | `JSON.parse(suggestion.suggestedChange || '{}')` — not in try/catch |
| 12.2 | 🔴 | `src/services/lead.ts:534` | `JSON.parse(row.metadata)` — not in try/catch |
| 12.3 | 🔴 | `src/services/scoring.ts:19,404` | `JSON.parse(...)` — not in try/catch |
| 12.4 | 🔴 | `src/components/pipeline/PipelineBoard.tsx:196` | `JSON.parse(p.fitReasoning)` — not in try/catch |
| 12.5 | 🔴 | `src/app/(dashboard)/approvals/page.tsx:28` | `JSON.parse(d.riskFlags)` — not in try/catch |
| 12.6 | 🔴 | `src/app/(dashboard)/research/ResearchQueueTable.tsx:54` | `JSON.parse(raw)` — not in try/catch |
| 12.7 | 🔴 | `src/components/settings/SignalRow.tsx:33` | `parseInt(e.target.value)` without isNaN — NaN corrupts signal weights |
| 12.8 | 🔴 | `src/app/api/discovery/recent/route.ts:45` | `JSON.parse(...)` — not in try/catch |
| 12.9 | 🔴 | `src/app/api/prospects/signals/route.ts:27` | `JSON.parse(...)` — not in try/catch |
| 12.10 | 🔴 | `src/app/actions/pipeline.ts:190` | `JSON.parse(draftRulesJson)` — not in try/catch |
| 12.11 | 🟠 | `src/lib/ai.ts:430,440,454,691,701,712,1036,1050,1060,1223,1239,1290,1514,1524,1561,1684,1697,1706,1853,1863,1874,2068,2077,2086,2240,2249,2258,2433,2442,2451` | AI output `JSON.parse()` without try/catch — 30+ locations |

---

## 13. Async Safety & Null Dereference

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 13.1 | 🔴 | `src/app/actions/outcomes.ts:53,128,210` | `Promise.race(learningLoop)` not awaited — response sent before loop completes |
| 13.2 | 🔴 | `src/app/(dashboard)/leads/[id]/components/outreach/useOutreachState.ts:285-303` | `new Promise` with `FileReader.onabort` not handled — promise hangs forever |
| 13.3 | 🔴 | `src/services/logging.ts:41` | `promise.catch(() => {})` — flush errors silently swallowed, log entries lost |
| 13.4 | 🔴 | `src/lib/workflow-client.ts:50` | `.catch(() => {})` — simulation errors silently swallowed |
| 13.5 | 🟠 | `src/services/sweeps.ts:273-278` | 6 sweep errors silently swallowed via `.catch(() => 0)` — no logging |
| 13.6 | 🟠 | `src/services/scoring.ts:71` | `icpRows[0]` without null check — empty query = undefined dereference |
| 13.7 | 🟠 | `src/services/research-workflow.ts:310` | `rows[0]` without null check — empty ICP query = crash |
| 13.8 | 🟠 | `src/lib/domain/drafting.ts:57` | `scored[0].contact` without length check — empty array = crash |
| 13.9 | 🟠 | `src/app/actions/outreach.ts:118` | `failoverHistory[0].provider` without length check |
| 13.10 | 🟠 | `src/app/(dashboard)/leads/[id]/page.tsx:54` | `.then(r => r[0])` without `|| null` fallback |
| 13.11 | 🟠 | `src/app/(dashboard)/prospects/[id]/page.tsx:86` | `.then(r => r[0])` without `|| null` fallback |
| 13.12 | 🟡 | `src/components/settings/NbaRulesEditor.tsx:45` | `setTimeout(async () => ...)` without .catch — stuck "simulating" state on error |
| 13.13 | 🟡 | `src/services/sweeps.ts:90,125` (and `lead.ts:1205`, `bulk.ts:47`) | Concurrent Set pattern — `.finally()` can run before `.add()` on sync resolution, leaking promises |
| 13.14 | 🟡 | `src/app/(dashboard)/layout.tsx:62` | `.catch(() => {})` — auth fetch failure silently ignored |
| 13.15 | 🟡 | *12 locations* | Empty `catch (e) {}` blocks in `learning.ts`, `outreach.ts`, `apify.ts`, `integrations/actions.ts` |
| 13.16 | 🟡 | `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx:730` | `void handleArchiveLead()` — fire-and-forget with no error handling |
| 13.17 | 🟡 | `src/app/(dashboard)/prospects/[id]/ProspectDetailsWorkspace.tsx:728` | Same pattern |
| 13.18 | 🟡 | `src/services/lead.ts:600-604,666-670` | Calendar sync fire-and-forget — logged but not awaited |
| 13.19 | 🟡 | `src/services/outreach.ts:89,175` | Background attachment cleanup fire-and-forget |
| 13.20 | 🟡 | Multiple files | `logNbaActionAction(...).catch(() => {})` — 6 locations silently swallow |

---

## 14. Form Data / Type Assertion Issues

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 14.1 | 🟡 | *100+ locations across actions/* | `formData.get('field') as string` — `get()` returns `string | File | null`, blind cast allows null through |
| 14.2 | 🟡 | *15+ locations* | `(process.env as any).VARIABLE_NAME` — blind env access bypasses type safety |
| 14.3 | 🟡 | `src/services/lead.ts:63` | `stage as PipelineStage` — arbitrary string cast to enum without validation |
| 14.4 | 🟡 | `src/app/actions/bulk.ts:74,97` | `lead.stage as PipelineStage` — same |
| 14.5 | 🟡 | `src/components/ClientStageDropdown.tsx:33,35` | `currentStage as PipelineStage` — same |
| 14.6 | 🟡 | `src/app/actions/outcomes.ts:78-80,153-155` | `(d as any).citedEvidence` — property doesn't exist on type, runtime undefined |
| 14.7 | 🟡 | `src/app/actions/research.ts:13` | `import crypto from 'crypto'` — unnecessary Node.js module import |

---

## 15. Fire-and-Forget & Empty Catches

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 15.1 | 🟡 | `src/app/api/prospects/signals/route.ts:35` | `catch {}` — JSON parse errors silently ignored |
| 15.2 | 🟡 | `src/app/actions/learning.ts:76,103` | `catch (e) {}` — revalidatePath errors silenced |
| 15.3 | 🟡 | `src/app/actions/outreach.ts:114,161,195,234,271,368` | `catch (e) {}` — revalidatePath errors silenced (6 locations) |
| 15.4 | 🟡 | `src/lib/discovery/apify.ts:38` | `catch (e) {}` — Cloudflare context errors silenced |
| 15.5 | 🟡 | `src/app/(dashboard)/settings/integrations/actions.ts:145,341,361` | `catch (e) {}` — revalidatePath errors silenced |
| 15.6 | 🔵 | `src/components/command-center/ProspectTableWithSignals.tsx:36-38` | `.catch(() => { // Signals are a nice-to-have })` — comment acknowledges silent failure |

---

## 16. Imports & Type Safety

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 16.1 | 🟡 | *18 files* | `Db` imported as value (e.g. `import { Db }`) instead of `import type { Db }` — bundler may fail on type-only export |
| 16.2 | 🟡 | `src/services/learning.ts:8` | `ExtractedSignal` imported as value instead of `import type` |
| 16.3 | 🟡 | `src/lib/domain/outcomes.ts:1` | `ExtractedSignal, IcpProfile` imported as value instead of `import type` |
| 16.4 | 🟡 | *7 files* | `require('@opennextjs/cloudflare')` — CJS require mixed with ESM, duplicated across 7 files |
| 16.5 | 🟡 | `src/services/discovery.ts:276` | Dynamic import without try/catch |
| 16.6 | 🟡 | `src/services/outreach.ts:253` | Dynamic import without try/catch |
| 16.7 | 🟡 | `src/app/actions/tracking.ts:33` | Dynamic import without try/catch |
| 16.8 | 🟡 | `src/services/lead.ts:877,893` | Dynamic imports at module-like scope without try/catch |
| 16.9 | 🟡 | `src/lib/ai.ts:292` | `catch (e: any)` — should use `unknown` and narrow |
| 16.10 | 🟡 | *15+ locations* | `catch (e: any)` patterns should use `unknown` |
| 16.11 | 🔵 | `src/entry.ts:1` | `// @ts-ignore` should be `@ts-expect-error` |
| 16.12 | 🔵 | `src/db/__tests__/schema.test.ts:3` | `.js` extension import in `.ts` file |

---

## 17. Cloudflare Workers Limits

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 17.1 | 🔴 | `src/lib/ai.ts:242` | Provider chain total timeout 120s — 2x the 30s CPU limit |
| 17.2 | 🔴 | `src/lib/ai.ts:393+` | All LLM calls use `AbortSignal.timeout(60000)` — 2x the 30s CPU limit |
| 17.3 | 🔴 | `src/lib/workflow-client.ts:252` | Research simulation: 10min timeout in `ctx.waitUntil` — CPU limit still applies |
| 17.4 | 🔴 | `src/lib/workflow-client.ts:440` | Discovery simulation: 15min timeout in `ctx.waitUntil` |
| 17.5 | 🟠 | `src/services/sweeps.ts:267-285` | Cron sweeps process 500 rows sequentially — likely exceed 30s CPU |
| 17.6 | 🟠 | `src/services/research-workflow.ts:106-137` | Sequential AI calls: 3× LLM, each up to 60s |
| 17.7 | 🟠 | `src/workflows/discovery-search.ts:51` | 40 retries × 1 fetch per poll + Apify calls = 42 subrequests |
| 17.8 | 🟠 | `src/lib/workflow-client.ts:321` | Simulation: 120 Apify status poll fetches |
| 17.9 | 🟠 | `src/lib/discovery/apify.ts:182` | Loads full dataset into memory (~10MB potential) |
| 17.10 | 🟠 | `src/services/outreach.ts:57` | Loads 100 drafts × base64 attachments into memory |
| 17.11 | 🟠 | Bundle estimate | OpenNext worker (401KB) + all deps + workflows likely exceeds 1MB free limit |
| 17.12 | 🟠 | `src/workflows/research-snapshot.ts:160-172` | Workflow step output `merged` may exceed 128KB DO limit |

---

## 18. Queue & Job System

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 18.1 | 🔴 | `src/app/api/jobs/[id]/cancel/route.ts:50` | Cancel sets `FAILED` not `CANCELLED` — running workflow checks for `CANCELLED`, won't stop |
| 18.2 | 🔴 | `src/services/sweeps.ts:136-164` | No stale-job recovery for `jobRuns` in `RUNNING` status — only `researchTasks` reset |
| 18.3 | 🔴 | `src/app/api/leads/[id]/research/route.ts:38-56` (and `bulk.ts:141-156`, `audits.ts:36-55`) | TOCTOU race in idempotency guard — SELECT-then-INSERT without UNIQUE constraint = duplicate jobs |
| 18.4 | 🔴 | `src/services/sweeps.ts:72-97,112-130` | `Promise.race` concurrency limiter can exceed `SWEEP_CONCURRENCY` (spikes to 8-10 when many settle same microtask) |
| 18.5 | 🔴 | `src/lib/workflow-client.ts:53-60` | Simulation queue silently drops oldest entry when full (max 50) with no error to caller |
| 18.6 | 🟠 | `wrangler.jsonc:22` + `src/services/sweeps.ts:15` | 4-min lock TTL vs 5-min cron margin — sweep running 4+ min allows concurrent sweep |
| 18.7 | 🟠 | `src/app/actions/bulk.ts:138-183` | Bulk research has no backpressure — 100 leads spawn 100 workflow instances simultaneously |
| 18.8 | 🟡 | `src/lib/workflow-client.ts:127` | Simulation never receives BROWSER binding — scraping always falls through to Jina |
| 18.9 | 🟡 | `src/workflows/discovery-search.ts:96-157` | Partial D1 batch failure not recoverable — job marked COMPLETED regardless |
| 18.10 | 🟡 | `src/db/schema/research.ts:8` | `status` is free-text — `CANCELLED` not in documented enum |
| 18.11 | 🟡 | `src/workflows/research-snapshot.ts:391-393` | Empty catch on error-recovery DB write — inconsistent state not logged |
| 18.12 | 🟡 | `src/workflows/discovery-search.ts:60` | Cancellation detected via `errorSummary` free-text instead of `status === 'CANCELLED'` |
| 18.13 | 🟡 | `src/lib/workflow-client.ts:464` | Fixed workflow ID `monitor-stalled-${leadId}` — second trigger silently ignored |
| 18.14 | 🟡 | `src/services/sweeps.ts:204-208` | Pruning only deletes COMPLETED/FAILED jobs — CANCELLED jobs accumulate |

---

## 19. Security

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 19.1 | 🔴 | `src/app/api/prospects/signals/route.ts` | No auth — see #8.1 |
| 19.2 | 🔴 | `src/lib/ai.ts` (12 locations) | Gemini API key in URL query param — see #10.1 |
| 19.3 | 🔴 | `src/app/api/auth/firebase/route.ts:10` | Firebase API key `AIzaSyCaf1FHg56-HIa-39FkPEY3146guGiZCX8` hardcoded in source |
| 19.4 | 🔴 | *Entire app* | No CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers anywhere |
| 19.5 | 🔴 | `src/app/api/cron/sweeps/route.ts:19` | Bearer token comparison with `!==` — timing attack possible |
| 19.6 | 🔴 | *Most API routes* | No rate limiting — login, research trigger, import all unprotected |
| 19.7 | 🟠 | `src/services/calendar.ts:55,62` | Calendar OAuth `state` param is unsigned base64 JSON — tamperable |
| 19.8 | 🟠 | `src/services/calendar.ts:85-86` | Google OAuth error response body (may contain tokens) returned to HTTP caller |
| 19.9 | 🟠 | `src/lib/rate-limit.ts:13-65` | In-memory rate limiter doesn't work across Worker isolates; `D1RateLimiter` exists but unused |
| 19.10 | 🟠 | `src/lib/auth.ts:102` | PBKDF2 with only 10,000 iterations — below 2026 OWASP guidance (600,000) |
| 19.11 | 🟠 | `src/app/api/auth/**` | Session cookie named `session` not `__Secure-session` — `Secure` flag check is fragile |
| 19.12 | 🟠 | `src/app/api/calendar/callback/route.ts` | No CSRF state validation in OAuth callback |
| 19.13 | 🟠 | `src/app/(dashboard)/leads/[id]/components/research/ResearchDisplay.tsx:157,167` | ReactMarkdown renders AI output without sanitizer — potential XSS |
| 19.14 | 🟠 | `src/app/(dashboard)/leads/[id]/components/audit/AuditDisplay.tsx:64,75,87` | Same — ReactMarkdown without sanitizer |
| 19.15 | 🟠 | `src/app/(dashboard)/leads/[id]/components/outreach/DraftCompareDialog.tsx:95,137` | Same |
| 19.16 | 🟠 | `src/lib/discovery/apify.ts:94-165` | No private IP validation on Apify requests |
| 19.17 | 🟠 | `src/app/api/settings/models/route.ts:47-173` | No private IP validation on model fetch requests |
| 19.18 | 🟡 | `src/lib/scraper.ts:450-520` | No rate limiting on scraper — can be used to DOS third-party sites |
| 19.19 | 🔵 | `src/lib/actions/with-logging.ts:39` | Secret sanitizer in logging — good, but only covers function args |

---

## 20. Logging & Observability

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 20.1 | 🔴 | *Entire app* | No health check endpoint (`GET /api/health`) |
| 20.2 | 🔴 | *Entire app* | No metrics endpoint (prometheus, OpenTelemetry) |
| 20.3 | 🟠 | `src/services/logging.ts:22-27` | `LogEntry` has no `requestId`, `userId`, or `correlationId` — impossible to correlate logs across services |
| 20.4 | 🟠 | `src/lib/logger.ts:69-71` | `requestId` is module-level singleton — not propagated through async workflows |
| 20.5 | 🟠 | *23 locations in workflows/actions/services* | `error.message` extracted, stack trace discarded — debugging impossible from log |
| 20.6 | 🟠 | `src/services/logging.ts:36-44` | Fire-and-forget flush with no shutdown drain — buffered logs lost on termination |
| 20.7 | 🟠 | `src/app/actions/outcomes.ts:69,144,224` | `log.error('revalidatePath failed', e?.message || e)` — passes string instead of Error object |
| 20.8 | 🟡 | `src/entry.ts:9,26` | `console.error`/`console.log` instead of StructuredLogger |
| 20.9 | 🟡 | `src/app/api/prospects/signals/route.ts:44` | `console.error` instead of `log.error` |
| 20.10 | 🟡 | `src/lib/logger.ts:52` | `JSON.stringify(error)` on non-Error objects loses structure, throws on circular refs |
| 20.11 | 🟡 | *Entire `src/`* | No structured JSON output for log aggregation (Datadog, Cloudflare Logpush) |
| 20.12 | 🟡 | `src/entry.ts` | No Cloudflare Workers analytics/tail configuration |
| 20.13 | 🔵 | `src/services/calendar.ts:254` | Raw API error body logged during calendar sync |
| 20.14 | 🔵 | `src/lib/client-logger.ts:42-44` | Buffer overflow silently drops oldest entries — no warning |

---

## 21. Memory & Performance

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 21.1 | 🟠 | `src/services/logging.ts:29,91-94` | Unbounded log buffer growth on persistent DB failures — no max cap |
| 21.2 | 🟠 | `src/services/logging.ts:29,33,91` | Module-level mutable state not safe for concurrent requests — races on `splice`/`push`/`_flushTimer` |
| 21.3 | 🟠 | `src/lib/ai.ts:241-250` | 9 expensive regex passes with backtracking on full HTML (pruneHtml) |
| 21.4 | 🟠 | `src/lib/scraper.ts:253-269` | Tag-stripping regex can cause catastrophic backtracking on malformed HTML |
| 21.5 | 🟠 | `src/services/research-workflow.ts:358-369` | Multiple `JSON.stringify` on same large objects |
| 21.6 | 🟠 | `src/lib/scraper.ts:414` | `.map().join('')` creates 2x memory for response body |
| 21.7 | 🟠 | `src/lib/ai.ts` (many lines) | No HTTP connection reuse — new TCP+TLS per AI API call (~100-300ms overhead) |
| 21.8 | 🟠 | `src/lib/ai.ts` (2453 lines) | Monolithic file with all prompts + schemas + provider logic — prevents tree-shaking |
| 21.9 | 🟡 | `src/db/index.ts:15` | Dynamic `require('@opennextjs/cloudflare')` prevents tree-shaking |
| 21.10 | 🟡 | `src/lib/domain/schemas.ts` | Barrel import causes all Zod schemas to bundle together |
| 21.11 | 🟡 | `src/lib/rate-limit.ts:14` | In-memory Map with eviction thrashing at capacity — D1RateLimiter exists but unused |
| 21.12 | 🟡 | `src/lib/scraper.ts:170-182` | `addEventListener` not cleaned up if fetch throws synchronously before cleanup line |
| 21.13 | 🟡 | `src/components/NotificationProvider.tsx:124-139` | Effect re-runs when `router` identity changes — timer storm |
| 21.14 | 🟡 | `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx:200` | `setInterval` without cleanup on unmount |
| 21.15 | 🟡 | `src/app/(dashboard)/prospects/[id]/ProspectDetailsWorkspace.tsx:198` | Same |
| 21.16 | 🟡 | `src/app/(dashboard)/scopes/[id]/page.tsx:220` | Same |
| 21.17 | 🔵 | `src/db/local-mock.ts:66-90` | SQLite file handle never explicitly closed — leaks FD on hot reload |
| 21.18 | 🔵 | `src/db/local-mock.ts:158` | Migration statements not wrapped in transaction — partial migration corrupts DB |

---

## 22. Error Boundaries & UX

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 22.1 | 🟠 | *Entire app* | No `not-found.tsx` anywhere — `notFound()` calls render default Next.js 404 |
| 22.2 | 🟠 | `src/app/api/notifications/*/route.ts` | 3 notification API routes have no try/catch — DB failure returns raw HTML |
| 22.3 | 🟠 | `src/app/api/market-metrics/route.ts:15` | Returns plain text for 401 — client at `scopes/new/page.tsx:46` calls `res.json()` → parse error |
| 22.4 | 🟠 | `src/app/(dashboard)/scopes/new/page.tsx:42-56` | Market metrics fetch has no `.catch()` — unhandled promise rejection |
| 22.5 | 🟠 | `src/app/(dashboard)/scopes/new/page.tsx:136-138` | Crawler search failure silently logged — user not notified |
| 22.6 | 🟡 | *17 route groups* missing `error.tsx` boundary |
| 22.7 | 🟡 | `src/app/(dashboard)/leads/[id]/ErrorBoundary.tsx:33-34` | Reset can infinite-loop on persistent errors |
| 22.8 | 🟡 | All forms | Validation errors shown as generic top-level banners, never inline per-field |
| 22.9 | 🟡 | `useActionState` forms | Input values lost on validation error — user must re-type |
| 22.10 | 🟡 | `src/app/error.tsx:68`, `src/components/ErrorPage.tsx:43-47` | `error.message` shown to users — may leak internals |
| 22.11 | 🟡 | `src/app/login/page.tsx` | No `error.tsx` or `loading.tsx` for login page |
| 22.12 | 🟡 | *8 route groups* missing `loading.tsx` (Suspense boundary) |
| 22.13 | 🟡 | `src/app/actions/outreach.ts:118` | Failover warning exposes internal error string to user |
| 22.14 | 🟡 | `src/app/api/calendar/callback/route.ts:11,19` | Returns plain text not JSON |
| 22.15 | 🟡 | *Entire app* | No optimistic updates — all mutations synchronous with full revalidation |

---

## 23. Scraper (Additional)

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 23.1 | 🟡 | `src/lib/scraper.ts:198` | 512KB streaming — adequate but combined HTML cleanup creates 3-5MB transient memory per scrape |
| 23.2 | 🟡 | `src/lib/scraper.ts:298` | Browser Run timeout 30s = full CPU budget |
| 23.3 | 🟡 | `src/lib/discovery/apify.ts:182` | Full Apify dataset loaded as JSON — 500 items × ~20KB = ~10MB, borderline for response limit |
| 23.4 | 🟡 | `src/lib/discovery/apify.ts:207` | Apify poll loop timeout: 4 min — on paid plan OK, free tier times out |

---

## 24. CSS & Frontend Rendering

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 24.1 | 🔴 | `src/app/globals.css:69-78` | `@keyframes fade-in` declared **inside** `@theme` block — keyframes never registered, `animate-fade-in` broken everywhere |
| 24.2 | 🔴 | `src/components/ErrorPage.tsx:49` | `text-mono-11` not defined in theme (only mono-12/14 exist) |
| 24.3 | 🟠 | `src/app/globals.css:3` | `@import "shadcn/tailwind.css"` — shadcn CLI doesn't ship CSS, likely invalid import |
| 24.4 | 🟠 | *~35 locations across 15+ files* | `heading-*`, `label-*`, `copy-*` classes used without `text-` prefix (e.g. `heading-xl` instead of `text-heading-xl`) — these utilities produce NO styling |
| 24.5 | 🟠 | `src/components/settings/PipelineAutomationCard.tsx:58,65` | `toggle toggle-primary` — DaisyUI classes, DaisyUI not installed, unstyled checkboxes |
| 24.6 | 🟠 | `src/components/ui/input.tsx:12` | `file:copy-14` — `file:` modifier on invalid utility, file selector button unstyled |
| 24.7 | 🟡 | *25+ locations* | `<label>` elements without `htmlFor` association |
| 24.8 | 🟡 | *10+ locations* | `<select>` elements without explicit labels |
| 24.9 | 🟡 | *Entire app* | Dark mode unreachable — no theme toggle, no way to add `.dark` to `<html>` |
| 24.10 | 🟡 | `src/components/ui/dialog.tsx:74` | `<XIcon />` without `className` — renders at 24×24 vs consistent 16×16 |
| 24.11 | 🟡 | `src/app/(dashboard)/markets/[marketId]/prospects/new/page.tsx:186` | `accept=".csv"` should be `accept=".csv, text/csv"` |

---

## 25. Next.js Patterns

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 25.1 | 🟠 | `next.config.mjs:37-38` | Dynamic import without error handling — see #3.6 |
| 25.2 | 🟡 | `src/middleware.ts:25-27` | Matcher pattern should be verified on Workers (uses Next.js custom glob syntax) |
| 25.3 | 🟡 | `src/entry.ts:1-2` | Generated `.open-next/worker.js` import — must build before deploy |
| 25.4 | 🔵 | `src/app/api/discovery/import/route.ts:11` | Unused `import { cookies }` — dead code |

---

## 26. Error Serialization (Stacktrace Loss)

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 26.1 | 🟠 | `src/workflows/discovery-search.ts:160` | `error.message` extracted, stack discarded |
| 26.2 | 🟠 | `src/workflows/research-snapshot.ts:124,332` | Same pattern |
| 26.3 | 🟠 | `src/services/research-workflow.ts:156` | Same |
| 26.4 | 🟠 | `src/lib/workflow-client.ts:151,197,411` | Same (3 locations) |
| 26.5 | 🟠 | `src/lib/scraper.ts:343` | Same |
| 26.6 | 🟠 | `src/app/actions/scopes.ts:55` | Same |
| 26.7 | 🟠 | `src/app/actions/prospects.ts:57,133` | Same |
| 26.8 | 🟠 | `src/app/actions/leads.ts:57,133` | Same |
| 26.9 | 🟠 | `src/app/actions/discovery-market.ts:82` | Same |
| 26.10 | 🟠 | `src/app/actions/discovery-candidate.ts:84,123,154,185` | Same (4 locations) |
| 26.11 | 🟠 | `src/app/actions/outreach.ts:122,165,198,237,275,324,371` | Same (7 locations) |
| 26.12 | 🟠 | `src/app/actions/learning.ts:80,107` | Same |
| 26.13 | 🟠 | `src/app/actions/outcomes.ts:85,160,229` | Same |
| 26.14 | 🟠 | `src/app/api/candidates/route.ts:91` | Same |

---

## 27. Stale Job / Lock Issues

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 27.1 | 🟡 | `src/services/sweeps.ts:230` | Clock drift vulnerability — `Date.now()` vs SQLite `strftime('%s','now')` comparisons |
| 27.2 | 🔵 | `src/workflows/monitor-stalled-lead.ts:31,486` | 5-second tolerance for stage-change detection is fragile under platform pauses |
| 27.3 | 🔵 | `src/workflows/discovery-search.ts:86-89` | Results truncated to 500 without caller notification |

---

## 28. Seed & Test Files (Non-Production)

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| 28.1 | 🔵 | `src/db/seed.ts` | Uses Node.js `fs`, `path`, `better-sqlite3` — acceptable (local-only) |
| 28.2 | 🔵 | `src/db/__tests__/*` | Uses `console.log` for diagnostics — not structured |

---

## Summary

| Severity | Count | Key Areas |
|----------|-------|-----------|
| 🔴 Critical | ~40 | No auth on signals API, Gemini keys in URLs, JSON.parse unhandled (30+), missing CSS keyframes, build-breaking DB queries, memory/logging races, CPU limit violations |
| 🟠 High | ~80 | Broad FAILED on research tasks, no cursor pagination, AI fallback gaps, empty catches, `as` assertions, import type issues, Workflow step DO limits |
| 🟡 Medium | ~150 | Missing `.limit()`s, scoped auth gaps, Zod validation holes, unoptimized regex, formData blind casts, missed revalidatePaths, event listener leaks, interval cleanup |
| 🔵 Low | ~60 | Code style, warnings, unused deps, test-only issues, comment/docs gaps |

**Total identified: ~330 individual issues** (many are grouped into one row when systemic, like "30+ JSON.parse locations").
