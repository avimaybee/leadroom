# Plan 003: Validate triage AI responses with Zod

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d6c7ea6..HEAD -- src/lib/ai.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness/bugs
- **Planned at**: commit `d6c7ea6`, 2026-06-14

## Why this matters

The `runTriageAI` function parses the LLM's JSON response using `JSON.parse()` but never validates it against a schema. If the LLM drifts from the prompt (e.g., returning `{"status": "GOOD"}` instead of `"MODERN"`), the caller (`workflow-client.ts`) accesses `.status` and gets a value it doesn't expect, leading to silent data corruption where leads remain stuck in the `UNASSESSED` state or get `null` priority. Zod validation ensures we catch format errors and can fall back safely.

## Current state

- `src/lib/ai.ts`: Lines 542, 571, 600, 629, 665 all use `return JSON.parse(text || '{}');` without any shape validation.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`                   | exit 0, no errors   |

## Scope

**In scope**:
- `src/lib/ai.ts`

## Git workflow

- Branch: `advisor/003-triage-zod-validation`
- Commit style: `fix(ai): validate triage LLM responses with Zod`

## Steps

### Step 1: Define the Zod schema

At the top of `src/lib/ai.ts` (near line 31, after `AIAuditOutput`), add:

```typescript
export const AITriageSchema = z.object({
  status: z.enum(['MODERN', 'OUTDATED']),
  reason: z.string(),
});

export type AITriageOutput = z.infer<typeof AITriageSchema>;
```

### Step 2: Update the return type of `runTriageAI`

Change the signature of `runTriageAI` to use the type:

```typescript
export async function runTriageAI(
  db: Db,
  scrapedContent: string
): Promise<AITriageOutput> {
```

### Step 3: Validate all return paths in `runTriageAI`

In `runTriageAI`, find all 5 instances of:
```typescript
return JSON.parse(text || '{}');
```
Replace them with:
```typescript
const parsed = JSON.parse(text || '{}');
return AITriageSchema.parse(parsed);
```

Ensure this is done for:
- OpenRouter (line ~542)
- NVIDIA (line ~571)
- Groq (line ~600)
- AIML (line ~629)
- Gemini (line ~665)

The surrounding `try/catch` block in `runTriageAI` will automatically catch Zod validation errors (`ZodError`) and return the fallback object:
`{ status: 'OUTDATED', reason: ... }` which is the desired safe behavior.

**Verify**: `npx tsc --noEmit` exits 0.

## Done criteria

- [ ] `AITriageSchema` is defined and used.
- [ ] 5 instances of `JSON.parse` inside `runTriageAI` are wrapped with `AITriageSchema.parse()`.
- [ ] `npx tsc --noEmit` passes.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If `AITriageSchema` conflicts with any other existing type.
