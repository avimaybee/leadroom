# Phase 2: Agentic Research Queue

## Agent Context
**Goal**: Break down monolithic AI extractions into explicit, deterministic agent steps. The AI must be restricted to extracting strictly typed JSON schemas using the AI SDK's `generateObject`. The system then uses this extracted JSON to calculate scores using standard code logic, completely decoupling LLM extraction from score calculation.

## Step 1: Define `research_tasks` schema
**File to modify**: `src/db/schema/jobs.ts` (or `src/db/schema/core.ts` if jobs.ts doesn't exist)
1. Import Drizzle types.
2. Define the table:
   ```typescript
   export const researchTasks = sqliteTable('research_tasks', {
     id: text('id').primaryKey(),
     leadId: text('lead_id').references(() => leads.id).notNull(),
     taskType: text('task_type').notNull(), // Enum: 'WEBSITE_ANALYST', 'ICP_FIT', 'PAIN_EXTRACTOR'
     status: text('status').notNull().default('PENDING'), // 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'
     rawArtifacts: text('raw_artifacts'), // JSON blob of scraped HTML/Text
     extractedSignals: text('extracted_signals'), // JSON blob of the Zod output
     createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
     completedAt: integer('completed_at', { mode: 'timestamp' }),
   });
   ```
3. Run `npm run db:generate`.
4. Update integration test SQLite mock schema.

## Step 2: Define Zod Extraction Schemas
**File to create**: `src/lib/ai/schemas.ts`
1. Use `zod` to strictly define the exact data shape the LLM must return.
   ```typescript
   import { z } from 'zod';

   export const WebsiteAnalysisSchema = z.object({
     summary: z.string().describe("A 2 sentence summary of what the company does."),
     industry: z.string(),
     sizeEstimate: z.string().describe("Estimate based on team page or locations. E.g. 10-50 employees."),
   });

   export const ICPFitSchema = z.object({
     signalsFound: z.array(z.object({
       name: z.string().describe("The exact name of the positive or negative signal matched from the ICP profile."),
       quote: z.string().describe("The EXACT VERBATIM quote from the scraped text proving this signal exists. DO NOT PARAPHRASE."),
       sourceUrl: z.string().describe("The URL where this quote was found."),
     })),
     disqualifiersFound: z.array(z.string()).describe("List any hard disqualifiers found from the ICP profile list."),
   });
   ```

## Step 3: Implement Deterministic Scoring
**File to create**: `src/lib/domain/scoring.ts`
1. Write a function `calculateLeadScore(leadId: string)` that executes SQL queries against the DB.
2. Fetch the Lead's associated `market` and `icpProfile`.
3. Fetch all `researchTasks` for the Lead where `status = 'COMPLETED'`.
4. Iterate over `extractedSignals.signalsFound`.
   - If the signal name matches an `icpProfile.positiveSignals` name, add the configured weight to `fitScore`.
   - If the signal name matches an `icpProfile.negativeSignals` name, subtract the configured weight from `fitScore`.
5. Check `extractedSignals.disqualifiersFound`. If length > 0, set `priorityTier = 'DISQUALIFIED'` and record the `disqualifiedReason`.
6. Calculate `confidenceScore`. Example heuristic: `(successful_tasks / total_tasks) * 100`.
7. Determine `priorityTier` (e.g., > 75 = 'TIER_1', > 50 = 'TIER_2').
8. Run a SQL `UPDATE` to save `fitScore`, `confidenceScore`, `priorityTier`, and `disqualifiedReason` back to the `leads` table.

## Step 4: Refactor Cloudflare Workflows
**File to modify**: `src/lib/workflows/enrichment.ts` (or equivalent workflow/queue handler)
1. Locate the existing monolithic LLM call.
2. Split it into discrete steps using the Vercel AI SDK `generateObject`.
   ```typescript
   import { generateObject } from 'ai';
   import { WebsiteAnalysisSchema, ICPFitSchema } from '@/lib/ai/schemas';

   // Step 1: Website Analyst
   const { object: websiteData } = await generateObject({
     model,
     schema: WebsiteAnalysisSchema,
     prompt: `Analyze this text: ${scrapedText}`,
   });
   
   // Insert into research_tasks as COMPLETED
   
   // Step 2: ICP Fit Scorer
   const { object: fitData } = await generateObject({
     model,
     schema: ICPFitSchema,
     prompt: `Here is the ICP Profile... Here is the website data... Find the signals.`,
   });

   // Insert into research_tasks as COMPLETED
   ```
3. Invoke `calculateLeadScore(leadId)` at the very end of the workflow execution.

## Verification
- Run `npm test`. Write a specific unit test in `src/lib/domain/__tests__/scoring.test.ts` to mock out the database and assert that `calculateLeadScore` correctly adds/subtracts weights and handles disqualifications deterministically.
