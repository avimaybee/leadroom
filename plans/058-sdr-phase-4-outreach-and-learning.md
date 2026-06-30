# Phase 4: Approval-Gated Outreach & Learning Loop

## Agent Context
**Goal**: Build a strict human-in-the-loop sending architecture. Generate hyper-personalized drafts containing embedded risk flags. Track outcomes to suggest ICP profile modifications.
**Core Principle**: The system must *never* send outreach automatically. Every claim the AI makes in an email must be linked back to the evidence extracted in Phase 2.

## Step 1: Define Outreach & Learning Schemas
**File to create**: `src/db/schema/outreach.ts`
1. Define the `outreachDrafts` table:
   ```typescript
   import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
   import { leads } from './core';

   export const outreachDrafts = sqliteTable('outreach_drafts', {
     id: text('id').primaryKey(),
     leadId: text('lead_id').references(() => leads.id).notNull(),
     draftContent: text('draft_content').notNull(),
     citedEvidence: text('cited_evidence'), // JSON Array linking sentence index to signal name
     riskFlags: text('risk_flags'), // JSON Array of strings (e.g., "Hallucination warning")
     approvalStatus: text('approval_status').notNull().default('DRAFT'), // 'DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED'
     rejectionReason: text('rejection_reason'),
     createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
   });
   ```
2. Define the `outcomes` table:
   ```typescript
   export const outcomes = sqliteTable('outcomes', {
     id: text('id').primaryKey(),
     leadId: text('lead_id').references(() => leads.id).notNull(),
     outcomeType: text('outcome_type').notNull(), // 'REPLIED', 'MEETING_BOOKED', 'BOUNCED', 'NOT_INTERESTED'
     timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
   });
   ```
3. Run `npm run db:generate`.

## Step 2: Implement Agentic Drafting with Risk Flags
**File to modify**: `src/app/actions/outreach.ts`
1. Locate `generateOutreachDraftAction`.
2. Fetch the Lead's `Offer` (which contains `proofPoints` and `forbiddenClaims`) and the `extractedSignals`.
3. Build a strict Zod schema for the AI output:
   ```typescript
   const DraftSchema = z.object({
     subject: z.string(),
     body: z.string(),
     citedEvidence: z.array(z.object({
       claim: z.string(),
       sourceSignal: z.string()
     })),
     riskFlags: z.array(z.string()).describe("List any assumptions you made that aren't strictly backed by the evidence.")
   });
   ```
4. Use `generateObject` with the AI SDK to ensure the draft strictly adheres to the schema.
5. Save the result to `outreachDrafts`.

## Step 3: Build the Side-by-Side Review UI
**File to modify**: `src/app/(dashboard)/leads/[id]/OutreachAssistant.tsx`
1. Overhaul the UI into a two-column view.
2. **Left Panel**: The editable textarea containing `draftContent`.
3. **Right Panel**: The AI's self-evaluation.
   - If `riskFlags.length > 0`, render a highly visible block (`bg-yellow-500/10 border-l-4 border-yellow-500 p-4`) listing the warnings.
   - Render the `citedEvidence` list so the user can see exactly why the AI wrote what it did.
4. **Action Bar**:
   - `Approve`: Calls a Server Action to change `approvalStatus` to `APPROVED` and lock edits.
   - `Reject & Regenerate`: Opens a popover to enter a `rejectionReason`. Passes this reason back to `generateOutreachDraftAction` as a system prompt instruction to rewrite the draft.

## Step 4: Outcome Tracking & The Learning Loop
**File to modify**: `src/app/actions/outcomes.ts` (create new)
1. Write `logOutcomeAction(leadId: string, outcomeType: string)` to insert a record into the `outcomes` table.
2. After inserting the outcome, do a naive background check:
   - Query all leads with the same `marketId` that have an outcome of `MEETING_BOOKED`.
   - Aggregate their `extractedSignals`.
   - If a specific signal (e.g., "uses_hubspot") appears in >75% of booked meetings, insert a record into `learningSuggestions` (schema up to you, or just log it for now).
3. **UI Integration**: Add outcome buttons ("Log Reply", "Log Bounce") to the Lead Controls section in `LeadDetailsWorkspace.tsx`.

## Verification
- Generate a draft and verify that the Risk Flags correctly populate in the UI when the AI makes an assumption.
- Ensure clicking "Approve" successfully locks the draft from further edits.
