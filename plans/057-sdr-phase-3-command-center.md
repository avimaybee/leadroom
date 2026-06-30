# Phase 3: Prioritization & Command Center UI

## Agent Context
**Goal**: The user experience must shift from a generic CRM to an "Inbox" model where the Founder reviews explicitly scored prospects with cited evidence in under 60 seconds.
**Tech Stack**: Next.js App Router (`src/app`), React Server Components, Tailwind CSS, shadcn/ui.

## Step 1: Scaffold the Command Center Dashboard
**File to modify**: `src/app/(dashboard)/page.tsx`
1. Transform the generic leads table into a "Ready to Review" inbox.
2. Query `leads` where `status = 'NEEDS_REVIEW'` or `priorityTier = 'TIER_1'`.
3. Sort the query by `fitScore` (DESC) and `confidenceScore` (DESC).
4. Build a top metrics bar using Tailwind:
   - "Total Prospects in Queue"
   - "High Fit (Tier 1)"
   - "Pending Approvals"
5. Add a warning indicator row: If any lead has `confidenceScore < 50`, show a yellow alert banner alerting the user that the AI had trouble extracting data for some prospects (e.g. `bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-4 py-3 rounded-md flex items-center`).

## Step 2: Overhaul the Prospect Detail Page (Split View)
**File to modify**: `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx`
1. The UI currently stacks generic CRM sections. Refactor it into a two-column Split View for the "Research & Audit" tab.
2. **Left Column (Company Context)**:
   - Use `col-span-12 lg:col-span-5` or similar Tailwind grid layout.
   - Display the Lead summary, industry, and the exact `WebsiteAnalysisSchema.summary` extracted in Phase 2.
3. **Right Column (Score Breakdown & Evidence)**:
   - Use `col-span-12 lg:col-span-7`.
   - Display a large visual `Fit Score` and `Confidence Score` (decoupled).
   - Render the `ICPFitSchema.signalsFound` array as a list.
   - **Crucial**: For every signal, render the `quote` directly below it in a muted, italicized block quote (`text-muted-foreground italic border-l-2 pl-3 py-1`). Provide a clickable link using `sourceUrl`.
4. If `confidenceScore < 50`, render a prominent warning banner at the top of the Right Column explaining that the score might be inaccurate due to sparse data.
5. If `disqualifiedReason` is present, render a red banner (`bg-destructive/10 text-destructive border-destructive/20`) stating the exact disqualification reason, and disable outreach buttons.

## Step 3: Implement Manual Score Overrides
**File to modify**: `src/app/actions/audits.ts` (or `src/app/actions/scoring.ts`)
1. Create a Server Action `overrideLeadScoreAction`.
   ```typescript
   'use server';
   import { z } from 'zod';
   import { db } from '@/db';
   import { leads } from '@/db/schema/core';
   import { revalidatePath } from 'next/cache';

   const OverrideSchema = z.object({
     leadId: z.string(),
     newScore: z.number().min(0).max(100),
     reason: z.string().min(5),
   });

   export async function overrideLeadScoreAction(formData: FormData) {
     // 1. Validate formData with Zod
     // 2. Auth checks
     // 3. Update the leads table: set fitScore = newScore
     // 4. Recalculate priorityTier based on the newScore
     // 5. Insert an activity log in the `activities` table with the `reason`
     // 6. revalidatePath(`/leads/${leadId}`);
   }
   ```
2. **File to modify**: `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx`
   - Add a "Manual Override" button next to the Fit Score.
   - Use `shadcn/ui` Dialog to open a modal with a form containing a Number input (Score) and a Textarea (Reason).
   - Wire the form submission to `overrideLeadScoreAction`.

## Verification
- Load a lead in the UI. Ensure the two-column layout renders correctly on desktop and stacks on mobile.
- Verify that overriding a score instantly updates the UI via `revalidatePath`.
