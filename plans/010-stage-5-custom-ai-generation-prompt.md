# Plan 010: Add Custom Prompt Input to Outreach Generation

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

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: features
- **Planned at**: commit `3ea78d2`, 2026-06-14

## Why this matters

The AI outreach generator currently provides no way for the operator to steer the messaging (e.g. "Focus on website speed", "Mention our specific e-commerce case study"). Adding an optional custom prompt input text area allows the human-in-the-loop to direct the LLM before generation, massively increasing draft quality and operator productivity.

## Current state

- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`: Currently has a single "Generate AI Draft" button without any text input for instructions.
- `src/app/actions/outreach.ts`: `generateOutreachDraftAction(leadId, channel)` does not accept a custom prompt parameter.
- `src/lib/ai.ts`: `generateOutreachDraft` uses a hardcoded instruction template.

**Conventions**: 
- Zod is used for data shapes. 
- UI components use Tailwind CSS matching the existing aesthetic (e.g., `bg-indigo-600 hover:bg-indigo-700`).
- Actions return `{ success: true, draft: ... }` or `{ error: string }`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`
- `src/app/actions/outreach.ts`
- `src/lib/ai.ts`

**Out of scope**:
- Database schema changes (the custom prompt doesn't need to be saved to DB).
- Other AI generation functions.

## Git workflow

- Branch: `advisor/010-custom-ai-prompt`
- Commit message style: `feat(outreach): add custom prompt input to draft generation`

## Steps

### Step 1: Update `ai.ts` signature and prompt

In `src/lib/ai.ts`, modify `generateOutreachDraft` to accept `customPrompt?: string | null`. 
In the prompt template, add a conditional injection for the custom prompt if provided.
Example shape:
```typescript
export async function generateOutreachDraft(
  // ... existing params
  auditSnapshot: any,
  customPrompt?: string | null
) { ... }

// inside the prompt:
${customPrompt ? `\nSPECIAL INSTRUCTIONS FROM THE OPERATOR:\n${customPrompt}\n` : ''}
```

**Verify**: `npm run typecheck` → passes (wait until Step 2 is done to fix action signature).

### Step 2: Update `generateOutreachDraftAction` signature

In `src/app/actions/outreach.ts`, update `generateOutreachDraftAction` to accept `customPrompt?: string` as a third parameter.
Pass it down to `generateOutreachDraft`.

```typescript
export async function generateOutreachDraftAction(leadId: string, channel: 'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING', customPrompt?: string)
```

**Verify**: `npm run typecheck` → passes.

### Step 3: Update `OutreachAssistant.tsx` UI

In `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`:
1. Add `const [customPrompt, setCustomPrompt] = useState('');`
2. Update the `handleGenerate` call to pass `customPrompt`.
3. Clear `customPrompt` when changing channels.
4. Add a `textarea` for the custom prompt just above the "Generate AI Draft" buttons in both the empty state view AND the side-panel "Create New Draft" area (or wherever appropriate before clicking generate). 
   - Label it "Custom Instructions (Optional)"
   - Use standard Tailwind classes (`text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl p-3 focus:border-indigo-500 focus:outline-none`).

**Verify**: `npm run build` → exit 0.

## Test plan

- Manual Verification: Go to a Lead detail page, enter a custom instruction in the Outreach Assistant, and verify the resulting draft references your specific instructions.
- Verification command: `npm run typecheck && npm run build` → all pass.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `generateOutreachDraftAction` accepts a 3rd parameter.
- [ ] `OutreachAssistant.tsx` renders a textarea for custom instructions.
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- `generateOutreachDraftAction` signature is used elsewhere in the codebase and breaks the build (search for usages first).
- The `generateOutreachDraft` function is missing from `src/lib/ai.ts`.

## Maintenance notes

- Future improvements might persist custom prompts in the draft metadata so operators can see what prompt generated a specific draft.
