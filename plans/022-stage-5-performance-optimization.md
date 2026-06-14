# Plan 022: Stage 5 performance optimization — router.refresh batching, attachment upload UX, model info caching

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3ea78d2..HEAD -- src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx src/app/actions/outreach.ts src/lib/ai.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf, ux

## Why this matters

Three small but impactful performance/UX issues: (1) `router.refresh()` is called redundantly after sequential operations (e.g., auto-save then approve), causing two back-to-back re-renders; (2) the attachment upload area provides no progress feedback while files are being read; (3) `getModelInfoAction` is fetched fresh on every mount but rarely changes — it should be cached longer.

## Current state

### router.refresh() batching
In `handleApproval` (the auto-save path, plan 021), both the save and the approval call `router.refresh()`. If auto-save fires, two refreshes happen within milliseconds.

In `handleGenerate`, `handleDuplicate`, and `handleSaveEdits`, `router.refresh()` is called after the local state update — but since `router.refresh()` is async (it triggers a server re-render), calling it once is sufficient.

### Attachment upload UX
The `handleFileChange` function reads files with FileReader synchronously (per file) with no loading indicator. For large files, the UI freezes during read.

### Model info caching
`getModelInfoAction` is called once on mount via `useEffect`. But there's no mechanism to avoid refetching on page navigation (soft navs re-mount the component). The server action itself doesn't cache — it reads from DB each time.

## Scope

**In scope** (files to modify):
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx` — batch refreshes, attachment upload progress
- `src/app/actions/outreach.ts` — add model info caching via revalidation period

**Out of scope**:
- Other components or pages
- Server-side caching infrastructure (Redis, etc.)
- Adding new npm packages

## Steps

### Step 1: Batch router.refresh() calls

In `OutreachAssistant.tsx`, modify the auto-save path in `handleApproval` to avoid calling `router.refresh()` after the save when an approval refresh will follow immediately.

Find the `handleApproval` function. Currently it has:

```tsx
        if (hasChanges) {
          const saveRes = await updateDraftAction(activeDraft.id, currentSubject, currentBody);
          if (saveRes.error) {
            throw new Error(saveRes.error);
          }
          setDrafts(drafts.map(d =>
            d.id === activeDraft.id
              ? { ...d, subject: currentSubject, body: currentBody, updatedAt: new Date() }
              : d
          ));
        }
```

Remove the `router.refresh()` call from inside the auto-save branch (there shouldn't be one in the auto-save path currently — just verify). Then ensure there's only ONE `router.refresh()` call at the end of the successful approval, not one in the save and one in the approval.

Current flow should be:
1. Auto-save (if needed) — updates local state, NO refresh
2. Record approval — updates local state
3. Single `router.refresh()` at the end

Also check `handleGenerate` and `handleDuplicate` — they each call `router.refresh()` once, which is fine.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Add attachment upload progress

In `OutreachAssistant.tsx`, modify `handleFileChange` to show a loading state while files are being read. Use the existing `isGenerating` state is not appropriate — add an `isUploadingAttachments` state.

Add state:
```tsx
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
```

Modify `handleFileChange` to wrap the FileReader operations:

```tsx
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setIsUploadingAttachments(true);
    setErrorMsg(null);

    try {
      const results = await Promise.all(
        filesArray.map((file) => {
          return new Promise<{ name: string; type: string; base64: string }>((resolve, reject) => {
            const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
            if (!validTypes.includes(file.type)) {
              reject(new Error(`Unsupported file type: ${file.name}. Only images (PNG, JPEG, WEBP) and PDFs are allowed.`));
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = (reader.result as string).split(',')[1];
              resolve({ name: file.name, type: file.type, base64: base64String });
            };
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
          });
        })
      );

      setAttachments((prev) => [...prev, ...results]);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to upload attachments');
    } finally {
      setIsUploadingAttachments(false);
    }

    e.target.value = '';
  };
```

Show a spinner in the file upload area when uploading. Find the file select label (around line 131) and add a loading indicator:

```tsx
      <label className="flex items-center justify-center border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
        <input
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          {isUploadingAttachments ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Choose Files</span>
            </>
          )}
        </div>
      </label>
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Add model info caching with revalidation period

In `src/app/actions/outreach.ts`, find the `getModelInfoAction` function. Add a module-level cache with a 5-minute TTL (matching the pattern already used in the service layer in `src/lib/ai.ts`).

```tsx
// Module-level cache for model info (5-min TTL)
let cachedModelInfo: { provider: string; modelName: string; hasVision: boolean } | null = null;
let cachedModelInfoTime = 0;
const MODEL_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getModelInfoAction() {
  const now = Date.now();
  if (cachedModelInfo && (now - cachedModelInfoTime) < MODEL_INFO_CACHE_TTL) {
    return { success: true, info: cachedModelInfo };
  }

  try {
    // existing implementation...
    const session = await auth();
    if (!session?.userId) return { success: false, error: 'Unauthorized' };

    const config = await getProviderConfig();
    const modelName = config.modelName || openAIConfig.modelName;
    const provider = config.provider || 'openai';
    const hasVision = await checkModelVisionCapability(modelName);

    const info = { provider, modelName, hasVision };
    cachedModelInfo = info;
    cachedModelInfoTime = now;
    return { success: true, info };
  } catch (error) {
    return { success: false, error: 'Failed to fetch model info' };
  }
}
```

The key changes:
1. Add module-level cache variables
2. Check cache at the top of the function
3. Set cache after successful fetch

**Verify**: `npx tsc --noEmit` → exit 0

## Test plan

- All existing tests must continue to pass.
- Verification: `npx tsx --test src/db/__tests__/outreach.integration.test.ts` → all pass
- Verification: `npx tsx --test src/db/__tests__/outreach.actions.test.ts` → all pass
- Manual: attachment upload shows spinner during FileReader operations
- Manual: switching between leads (soft nav) reuses cached model info for 5 min

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx tsx --test src/db/__tests__/outreach.integration.test.ts` exits 0
- [ ] `npx tsx --test src/db/__tests__/outreach.actions.test.ts` exits 0
- [ ] `handleApproval` calls `router.refresh()` at most once
- [ ] Attachment upload shows "Uploading..." spinner during FileReader reads
- [ ] `getModelInfoAction` caches results for 5 minutes
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The `getModelInfoAction` function has a different signature or return type than expected
- The file upload UI has been significantly restructured
- Any step causes a TypeScript error that can't be fixed with a simple type annotation
