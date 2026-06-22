# [027] Fix Cancel Research Polling Bug

**Commit:** 95449cc
**Category:** Correctness / Bugs
**Effort:** S
**Impact:** Prevents the UI from losing track of a background research job if the cancellation API call fails.

## Context

In `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx`, the `handleCancelResearch` function is responsible for stopping an active enrichment job. It makes a POST request to `/api/leads/[id]/research/cancel`. However, the `finally` block of this function unconditionally clears the frontend polling state (`pollingJobId`, `jobStatus`, `isEnriching`), regardless of whether the API call succeeds or fails.

```typescript
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel research enrichment');
    } finally {
      setIsCancelling(false);
      setPollingJobId(null);
      setJobStatus(null);
      setIsEnriching(false);
      setJobError(null);
      router.refresh();
    }
```

If the API call fails (e.g., due to a temporary network error or 500 status), the frontend stops polling, but the background job continues running. The user is left in a disconnected state where the job is still mutating the database but the UI shows no active process.

## Done Criteria

- The `finally` block in `handleCancelResearch` only sets `setIsCancelling(false)` and calls `router.refresh()`.
- The clearing of polling state (`setPollingJobId(null)`, `setJobStatus(null)`, etc.) is moved inside the `try` block, immediately after the successful API response and toast notification.
- The UI retains its `isEnriching = true` state and continues polling if the cancellation fails.

## Steps

1. Open `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx`.
2. Locate the `handleCancelResearch` function.
3. Move the following state updates from the `finally` block to the end of the `try` block:
   - `setPollingJobId(null)`
   - `setJobStatus(null)`
   - `setIsEnriching(false)`
   - `setJobError(null)`
4. Ensure the `catch` block remains unchanged (logs error and shows toast).
5. Ensure the `finally` block only contains `setIsCancelling(false); router.refresh();`.
6. Run `npm run build` to verify no TypeScript compilation errors.

## Verification

- Simulate a failure in `/api/leads/[id]/research/cancel/route.ts` (e.g., throw an error temporarily).
- Click "Cancel Research" in the UI.
- Verify that the error toast appears and the "Research enrichment active" banner remains visible and polling continues.

## Escape Hatches
- If the `handleCancelResearch` function has already been refactored or moved, stop and report the drift.
