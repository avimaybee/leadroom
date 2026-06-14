# Plan 017: Throttle attachment cleanup and cache vision capability check

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3ea78d2..HEAD -- src/services/outreach.ts src/lib/ai.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

Two performance issues waste network calls and compute on every lead detail page load and every outreach generation:

1. **`cleanOldAttachments`** runs a full-table scan of `outreach_drafts` on every `getDraftsForLead` call (and again on every `createDraft` call). This happens on every lead detail page load. The 15-minute expiry makes it pointless to run more than once per 15 minutes.

2. **`checkModelVisionCapability`** makes an external HTTP request to the provider's `/models` endpoint on every outreach generation (and on every component mount via `getModelInfoAction`). A model's vision capability doesn't change between requests — the result can be safely cached.

## Current state

### Attachment cleanup
- `src/services/outreach.ts` lines 20-59: `cleanOldAttachments()` selects all drafts older than 15 minutes with non-null attachments, parses their JSON, strips base64 data, and writes back.
- Line 66: Called as a fire-and-forget promise in `getDraftsForLead`.
- Line 119: Also called in `createDraft`.
- **No throttling or debouncing**.

### Vision capability check
- `src/lib/ai.ts` lines 1242-1311: `checkModelVisionCapability` makes HTTP requests to provider model list endpoints.
- Line 1187: Called from `generateOutreachDraft` for every generation (inside the non-Gemini branch).
- Line 1335: Called from `getModelInfo` which is called from `getModelInfoAction` which runs on component mount.
- **No caching**.

## Commands you will need

| Purpose   | Command                                                       | Expected on success |
|-----------|---------------------------------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                                           | exit 0, no errors   |
| Tests     | `npx tsx --test src/db/__tests__/outreach.integration.test.ts`| all pass            |

## Scope

**In scope**:
- `src/services/outreach.ts` (add throttle to cleanOldAttachments)
- `src/lib/ai.ts` (add caching to checkModelVisionCapability)

**Out of scope**:
- UI components
- Schema changes
- Other AI functions

## Git workflow

- Branch: `advisor/017-throttle-and-cache`
- Commit message: `perf(outreach): throttle attachment cleanup and cache vision checks`

## Steps

### Step 1: Add throttle to cleanOldAttachments

Open `src/services/outreach.ts`. Add a module-level timestamp variable at the top of the file, after the imports but before the class:

```typescript
/** Module-level timestamp for throttling attachment cleanup. */
let _lastCleanupTimestamp = 0;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
```

Modify the `cleanOldAttachments` method to check the throttle first. At the very beginning of the method body (line 21, after `async cleanOldAttachments() {`), add:

```typescript
    const now = Date.now();
    if (now - _lastCleanupTimestamp < CLEANUP_INTERVAL_MS) {
      return; // Already ran recently, skip
    }
    _lastCleanupTimestamp = now;
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Add caching to checkModelVisionCapability

Open `src/lib/ai.ts`. Add a module-level cache near the top of the file, after the Zod schema declarations (around line 48):

```typescript
/** Cache for vision capability checks. Key: "provider:modelName", Value: { result: boolean, timestamp: number } */
const _visionCapabilityCache = new Map<string, { result: boolean; timestamp: number }>();
const VISION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

At the very beginning of the `checkModelVisionCapability` function (line 1243, after the function signature), add:

```typescript
  const cacheKey = `${provider}:${modelName}`;
  const cached = _visionCapabilityCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < VISION_CACHE_TTL_MS) {
    return cached.result;
  }
```

At the end of the function, just before the final `return` statement (line 1310), wrap the result in a cache write. The current final return is:

```typescript
  const visionKeywords = ['vision', 'llava', 'pixtral', 'gemini', 'claude-3', 'gpt-4o', 'gpt-4-vision', 'llama-3.2-11b', 'llama-3.2-90b'];
  return visionKeywords.some(keyword => m.includes(keyword)) && !m.includes('embedding');
```

Replace it with:

```typescript
  const visionKeywords = ['vision', 'llava', 'pixtral', 'gemini', 'claude-3', 'gpt-4o', 'gpt-4-vision', 'llama-3.2-11b', 'llama-3.2-90b'];
  const fallbackResult = visionKeywords.some(keyword => m.includes(keyword)) && !m.includes('embedding');
  _visionCapabilityCache.set(cacheKey, { result: fallbackResult, timestamp: Date.now() });
  return fallbackResult;
```

Also, inside each provider branch that successfully determines vision capability (the `return` statements at lines ~1263, ~1278, ~1301), store the result in the cache before returning. For example, change:

```typescript
  return modelObj.architecture.input_modalities.includes('image');
```

to:

```typescript
  const result = modelObj.architecture.input_modalities.includes('image');
  _visionCapabilityCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
```

Apply the same pattern to each of the successful `return` statements inside provider branches (OpenRouter, Gemini, Groq/Nvidia/AIML).

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Verify existing tests still pass

**Verify**: `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass

## Test plan

- No new test file needed — this is a performance optimization that doesn't change observable behavior.
- Existing tests must still pass.
- Manual verification: open a lead detail page twice quickly; confirm that the second load doesn't trigger an attachment cleanup log.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx tsx --test src/db/__tests__/outreach.integration.test.ts` exits 0
- [ ] `cleanOldAttachments` short-circuits if called within 15 minutes of the last run
- [ ] `checkModelVisionCapability` returns cached results for 5 minutes
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The module-level `_lastCleanupTimestamp` variable causes issues with Cloudflare Workers' isolate model (Workers reuse isolates, so module-level state persists across requests — this is actually desirable for throttling).
- The `checkModelVisionCapability` function signature or return type changed since this plan was written.

## Maintenance notes

- The module-level cache for vision capability is per-isolate in Cloudflare Workers. If the worker is recycled, the cache resets — this is fine since the TTL is only 5 minutes.
- If a user switches models in settings, the stale cache entry (up to 5 minutes) could return the wrong vision capability for the old model. This is acceptable because the cache key includes the model name, so changing the model in settings will use a new cache key.
- The cleanup throttle means base64 data may persist up to 30 minutes (15 min expiry + 15 min throttle window) instead of 15 minutes. This is an acceptable trade-off.
