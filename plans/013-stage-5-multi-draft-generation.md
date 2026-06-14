# Plan 013: Multi-Draft Generation & Comparison

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3ea78d2..HEAD -- src/lib/ai.ts src/app/actions/outreach.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: features
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

Generative AI produces varying results. Currently, the user clicks "Generate", waits, and gets a single draft. If they don't like it, they must regenerate and overwrite or duplicate. Modifying the AI prompt to output two distinct options (e.g., Option A: Direct/Value-led, Option B: Conversational/Soft) gives the operator immediate choice, halving the API waiting time and improving draft quality.

## Current state

- `src/lib/ai.ts`: `AIOutreachDraftSchema` defines a single object `{ subject, body }`. `generateOutreachDraft` asks the LLM for one draft.
- `src/app/actions/outreach.ts`: `generateOutreachDraftAction` creates a single draft in the database.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/lib/ai.ts`
- `src/app/actions/outreach.ts`

**Out of scope**:
- Changing UI beyond displaying two drafts in the list.

## Git workflow

- Branch: `advisor/013-multi-draft-generation`
- Commit message style: `feat(outreach): generate multiple AI draft variations`

## Steps

### Step 1: Update AI Schema

In `src/lib/ai.ts`, modify `AIOutreachDraftSchema` to be an array of objects, or wrap it in a parent object:
```typescript
export const AIOutreachDraftResponseSchema = z.object({
  drafts: z.array(z.object({
    subject: z.string().nullable(),
    body: z.string(),
    variationTone: z.string().optional() // e.g. "Direct", "Conversational"
  })).min(1).max(2)
});
```
Update the prompt in `generateOutreachDraft` to request "Generate two distinct variations of the outreach message (e.g., one direct/value-led, one softer/conversational) and return them in the 'drafts' array."

**Verify**: `npm run typecheck` (will fail until action is updated).

### Step 2: Update Server Action

In `src/app/actions/outreach.ts`, update `generateOutreachDraftAction` to handle the array.
```typescript
const draftContent = await generateOutreachDraft(...);
const newDrafts = [];
for (const draft of draftContent.drafts) {
  const newDraft = await outreachService.createDraft({
    // ...
    subject: draft.subject || null,
    body: `[Tone: ${draft.variationTone}]\n\n${draft.body}`,
  });
  newDrafts.push(newDraft);
}
// Return array of drafts
return { success: true, drafts: newDrafts };
```

### Step 3: Update UI (if needed)

In `OutreachAssistant.tsx`, update the success handler of `handleGenerate` to accept `res.drafts` (an array) instead of `res.draft`, and prepend both to the `drafts` state array. Set the active draft to the first one in the list.

**Verify**: `npm run build` → exit 0.

## Test plan

- Execute a draft generation. Verify the history sidebar instantly populates with 2 new drafts.
- `npm run typecheck && npm run build`

## Done criteria

- [ ] AI prompt updated to return multiple drafts.
- [ ] Action creates multiple records.
- [ ] UI handles appending multiple records.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If Gemini or OpenRouter rate limits reject larger JSON schemas frequently.
