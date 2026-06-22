# [028] Fix Stage Update Page Reload

**Commit:** 95449cc
**Category:** DX / Performance
**Effort:** S
**Impact:** Avoids a full page reload when changing a lead's stage from the header.

## Context

In `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx`, the pipeline stage dropdown uses a standard HTML `<form action={updateStageAction}>` with a submit button.

```typescript
        <form action={updateStageAction} className="flex items-center gap-2">
          <input type="hidden" name="leadId" value={lead.id} />
          <select name="stage" ...>...</select>
          <Button type="submit" size="sm">Update</Button>
        </form>
```

When submitted, this triggers a full page reload, which is jarring in a modern SPA-like dashboard.

## Done Criteria

- The stage update form uses `startTransition` or React 19 `useActionState` to perform the update without a full page reload.
- The UX feels instant and smooth.

## Steps

1. Modify `LeadDetailsWorkspace.tsx` to handle the form submission using `startTransition` or similar React primitives.
2. If `updateStageAction` does not already return a state/error, consider wrapping it or handling the error locally.
3. Trigger the action `onChange` of the select element, or keep the button but make it a smooth client-side transition.

## Escape Hatches
- If the form is too complex to convert easily, stop and discuss alternatives.
