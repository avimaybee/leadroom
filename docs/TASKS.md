# TASKS.md — SDR Pivot Execution Plan

> **Executor instructions**: This is the authoritative execution plan. Read `AGENTS.md`, `PRD.md`, `DATA_MODEL.md`, `ARCHITECTURE.md`, and `PIVOT.md` first. Execute phases in order. Run each phase's verification gate before proceeding. If a STOP condition occurs, stop and report; do not improvise or broaden scope.

---

## Phase 1: Data Model Realignment (Configuration Foundation)

### Goal

Establish the strategy configuration layer (Workspace, Offer, ICP Profile, Market) and realign the execution table (Leads → Prospects) with SDR-specific scoring fields.

### Prerequisites

- `git status` is clean (no uncommitted changes)
- `npx tsc --noEmit` exits 0
- `npm test` results recorded (expect 142 pass / 1 pre-existing fail in `routes.test.ts`)

### In scope

- `src/db/schema/strategy.ts` — new file for Workspace, Offer, ICPProfile, Market tables
- `src/db/schema.ts` — re-export new strategy module
- `src/db/schema/core.ts` — rename `leads` table to `prospects`, add SDR columns, keep backward-compat alias
- `src/db/schema/research.ts` — update FK references from `leads.id` to `prospects.id`
- `src/db/schema/outreach.ts` — update FK references from `leads.id` to `prospects.id`
- `src/db/schema/audits.ts` — update FK references from `leads.id` to `prospects.id`
- `src/db/schema/core.ts` — update FK references in `tasks`, `notes`, `activities`, `lead_stage_history`, `reminders`, `nba_action_logs`
- `src/app/api/__tests__/routes.test.ts` — update inline `CREATE TABLE leads(...)` to match new `prospects` schema + add strategy tables
- Drizzle migration generation and local-D1 verification

### Out of scope

- Updating ALL import references across the app that destructure `{ leads }` from `@/db/schema/core` (the backward-compat alias keeps them working)
- Dropping old CRM-era columns (`email`, `phone`, `city`, `region`, `industry`, `stage`, `isRead`, `scoreDirty`, `stageUpdatedAt`, `lastActivityAt`) — deferred to later phase
- Refactoring services or server actions to use `prospects` nomenclature
- UI changes or new pages
- Renaming FK column names (`lead_id` → `prospect_id`) in other tables — deferred to avoid complex migration

### Files to create

**`src/db/schema/strategy.ts`** — Four new tables following `DATA_MODEL.md`:

1. **`workspaces`**
   | Column | Type | Constraints |
   |--------|------|-------------|
   | `id` | `text` | `primaryKey` |
   | `name` | `text` | `notNull` |
   | `created_at` | `integer` | `default(sql\`(strftime('%s', 'now'))\`)` |
   | `updated_at` | `integer` | `default(sql\`(strftime('%s', 'now'))\`)` |

2. **`offers`**
   | Column | Type | Constraints |
   |--------|------|-------------|
   | `id` | `text` | `primaryKey` |
   | `workspace_id` | `text` | `notNull`, `references(() => workspaces.id)` |
   | `name` | `text` | `notNull` |
   | `target_pain` | `text` | — |
   | `desired_outcome` | `text` | — |
   | `proof_points` | `text` | JSON array of strings |
   | `forbidden_claims` | `text` | JSON array of strings |
   | `created_at` | `integer` | timestamp default |
   | `updated_at` | `integer` | timestamp default |

3. **`icp_profiles`**
   | Column | Type | Constraints |
   |--------|------|-------------|
   | `id` | `text` | `primaryKey` |
   | `workspace_id` | `text` | `notNull`, `references(() => workspaces.id)` |
   | `name` | `text` | `notNull` |
   | `positive_signals` | `text` | JSON array with weights |
   | `negative_signals` | `text` | JSON array with weights |
   | `disqualifiers` | `text` | JSON array |
   | `created_at` | `integer` | timestamp default |
   | `updated_at` | `integer` | timestamp default |

4. **`markets`**
   | Column | Type | Constraints |
   |--------|------|-------------|
   | `id` | `text` | `primaryKey` |
   | `workspace_id` | `text` | `notNull`, `references(() => workspaces.id)` |
   | `name` | `text` | `notNull` |
   | `icp_profile_id` | `text` | `references(() => icp_profiles.id)` |
   | `offer_id` | `text` | `references(() => offers.id)` |
   | `status` | `text` | `default('active')` |
   | `created_at` | `integer` | timestamp default |
   | `updated_at` | `integer` | timestamp default |

   Indexes:
   - `workspace_id + status` composite index on `markets`

### Files to modify

**`src/db/schema.ts`** — Add line: `export * from './schema/strategy';`

**`src/db/schema/core.ts`** — Changes:

1. Rename the `leads` table definition to `prospects`:
   - Change `export const leads = sqliteTable('leads', ...)` → `export const prospects = sqliteTable('prospects', ...)`
   - Keep ALL existing columns unchanged (column names, types, defaults, indexes)

2. Add new columns to `prospects`:
   ```ts
   workspaceId: text('workspace_id').references(() => workspaces.id),
   marketId: text('market_id').references(() => markets.id),
   fitScore: integer('fit_score'),
   confidenceScore: integer('confidence_score'),
   priorityTier: text('priority_tier'),
   disqualifiedReason: text('disqualified_reason'),
   ```
   Add these after the existing `status` column (line 25 in current file).

3. Add backward-compatibility alias right after the `prospects` table definition:
   ```ts
   export const leads = prospects;
   ```

4. Update FK references in dependent tables from `() => leads.id` to `() => prospects.id`:
   - `tasks.leadId` (line 47)
   - `notes.leadId` (line 70)
   - `activities.leadId` (line 80)
   - `lead_stage_history.leadId` (line 95)
   - `reminders.leadId` (line 146)
   - `nba_action_logs.leadId` (line 160)

5. Update imports at top of file to include the new strategy tables:
   ```ts
   import { workspaces, markets } from './strategy';
   ```

**`src/db/schema/research.ts`** — Changes:
1. Update imports: replace `import { users, leads } from './core'` with `import { users, prospects } from './core'` then `import { leads } from './core'` is not needed (but `leads` alias already works)
   - Actually, keep using `leads` import since the alias exists. Just change the import.
   - Update FKs: `() => leads.id` → `() => prospects.id` in:
     - `jobRuns.targetLeadId` (line 9)
     - `researchSnapshots.leadId` (line 28)
     - `contacts.leadId` (line 53)

**`src/db/schema/outreach.ts`** — Changes:
1. Update imports: change `leads` import path to reference through `prospects` 
2. Update FK: `outreachDrafts.leadId` → `() => prospects.id` (line 7)

**`src/db/schema/audits.ts`** — Changes:
1. Update imports: change `leads` import path
2. Update FKs:
   - `audits.leadId` (line 8) → `() => prospects.id`
   - `leadScores.leadId` (line 26) → `() => prospects.id`

**`src/app/api/__tests__/routes.test.ts`** — Changes:
1. Update import: `import { leads, users } from '@/db/schema/core'` → `import { prospects, users, workspaces, markets } from '@/db/schema/core'`
   - Actually the backward-compat alias `leads = prospects` means `import { leads }` still works. Keep the import as-is. But...
   - The test creates an in-memory SQLite with `CREATE TABLE leads (...)`. Change this to `CREATE TABLE prospects (...)`. Add CREATE TABLE statements for `workspaces` and `markets` (the strategy tables that prospects now has FKs to).
   - Insert a workspace and market in the test setup so FK inserts don't fail.
   - OR: since better-sqlite3 in the test likely doesn't enforce FKs by default, the FK constraints might be ignored. Check `PRAGMA foreign_keys` setting in the test. If off (default), strategy tables in the mock aren't needed.
   - **Simplest safe approach**: Add `CREATE TABLE workspaces(...)` and `CREATE TABLE markets(...)` with minimal columns to the test setup SQL, plus insert a default workspace and market record.

### Migration

```bash
npx wrangler d1 migrations create leadroom phase1_strategy_and_prospects
```

The migration file must contain only single SQL statements (semicolons at statement level only). Split across multiple migration files if Drizzle Kit produces multi-statement SQL.

Expected SQL operations:
1. `ALTER TABLE leads RENAME TO prospects;`
2. `ALTER TABLE prospects ADD COLUMN workspace_id TEXT REFERENCES workspaces(id);`
3. `ALTER TABLE prospects ADD COLUMN market_id TEXT REFERENCES markets(id);`
4. `ALTER TABLE prospects ADD COLUMN fit_score INTEGER;`
5. `ALTER TABLE prospects ADD COLUMN confidence_score INTEGER;`
6. `ALTER TABLE prospects ADD COLUMN priority_tier TEXT;`
7. `ALTER TABLE prospects ADD COLUMN disqualified_reason TEXT;`
8. `CREATE TABLE workspaces (...);`
9. `CREATE TABLE offers (...);`
10. `CREATE TABLE icp_profiles (...);`
11. `CREATE TABLE markets (...);`

If Drizzle Kit's `generate` produces a single file with multiple ALTER TABLE statements joined by `->`, split each into its own numbered migration file (like the 0019–0025 fix pattern from the previous session).

### Verification

1. `npx tsc --noEmit` exits 0
2. `npm test` passes (142 pass, 1 pre-existing failure in routes.test.ts — the routes.test.ts mock was updated so this should now pass or be a different failure)
3. `npx wrangler d1 migrations apply leadroom --local` succeeds
4. Manual check: migration SQL files contain only single statements
5. The backward-compat alias works: `import { leads } from '@/db/schema/core'` resolves without errors and `leads` is the same reference as `prospects`

### STOP conditions

- Multi-statement migration SQL is generated without explicit per-file splitting — stop and split before applying
- `routes.test.ts` test failure persists after mock update — stop and reconcile the mock schema with the actual schema
- Any table other than the 8 listed above is modified — stop and report scope creep

### Definition of Done

- [ ] `strategy.ts` exists with all 4 tables, correct columns, types, defaults, and indexes
- [ ] `core.ts` has `prospects` table with all old columns + 5 new columns, and `export const leads = prospects` alias
- [ ] All FK references across `research.ts`, `outreach.ts`, `audits.ts`, `core.ts` point to `prospects.id`
- [ ] `schema.ts` re-exports strategy module
- [ ] `routes.test.ts` mock includes `prospects`, `workspaces`, `markets` tables with matching schemas
- [ ] Migration files are generated, single-statement, and verified against local D1
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` passes (or only documented pre-existing failures remain)
- [ ] Git diff contains no files outside approved scope

---

## Phase 2: Agentic Research Queue

### Goal

Define the granular research task infrastructure and the deterministic scoring service that transforms AI-extracted signals into scored, evidence-backed prospect evaluations.

### Prerequisites

- Phase 1 data model is deployed and verified
- `npx tsc --noEmit` exits 0
- `npm test` passes

### In scope

- `src/db/schema/jobs.ts` — new `researchTasks` table
- `src/lib/domain/schemas.ts` — Zod schemas for agent outputs
- `src/lib/domain/scoring.ts` — deterministic scoring service
- Refactoring existing Cloudflare workflows into step-by-step tasks

### Out of scope

- Actual AI provider integration or prompt design
- UI for the command center or research queue
- Contact discovery or enrichment logic

### Files to create

**`src/db/schema/jobs.ts`** — `researchTasks` table:

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | `primaryKey` |
| `prospect_id` | `text` | `notNull`, `references(() => prospects.id)` |
| `task_type` | `text` | `notNull` — `'WEBSITE_ANALYST' \| 'ICP_FIT' \| 'PAIN_EXTRACTOR' \| 'DISQUALIFIER_CHECK'` |
| `status` | `text` | `notNull`, `default('PENDING')` — `'PENDING' \| 'RUNNING' \| 'COMPLETED' \| 'FAILED'` |
| `raw_artifacts` | `text` | JSON blob |
| `extracted_signals` | `text` | JSON array of `{signal_name, matched_icp_rule, evidence_quote, source_url}` |
| `confidence` | `integer` | 0–100 |
| `error_message` | `text` | — |
| `started_at` | `integer` | timestamp |
| `completed_at` | `integer` | timestamp |
| `created_at` | `integer` | timestamp default |
| `updated_at` | `integer` | timestamp default |

Indexes:
- `prospect_id + task_type` composite index
- `status` index for queue polling

**`src/lib/domain/schemas.ts`** — Zod output schemas:

1. `WebsiteAnalysisSchema`:
   - `companyName`: string
   - `websiteSummary`: string (1–2 sentences)
   - `productsServices`: string[]
   - `targetAudience`: string
   - `painSignalsFound`: array of `{signal: string, evidenceQuote: string, sourceUrl: string}`
   - `confidence`: number (0–100)

2. `ICPFitSchema`:
   - `matchedPositiveSignals`: array of `{signalName: string, evidenceQuote: string, sourceUrl: string, matchStrength: 'strong' | 'partial' | 'weak'}`
   - `matchedNegativeSignals`: same structure
   - `disqualifiersTriggered`: string[]
   - `overallAssessment`: string
   - `confidence`: number (0–100)

3. `DisqualifierSchema`:
   - `disqualified`: boolean
   - `reason`: string | null
   - `triggeredRules`: string[]
   - `evidenceQuote`: string | null
   - `sourceUrl`: string | null
   - `confidence`: number (0–100)

**`src/lib/domain/scoring.ts`** — Deterministic scoring service:

```ts
export interface ScoringInput {
  icpProfile: {
    positiveSignals: Array<{ name: string; weight: number; description: string }>;
    negativeSignals: Array<{ name: string; weight: number; description: string }>;
    disqualifiers: string[];
  };
  extractedSignals: Array<{
    signalName: string;
    matchedIcpRule: string;
    matchStrength: 'strong' | 'partial' | 'weak';
    evidenceQuote: string;
    sourceUrl: string;
  }>;
  researchConfidence: number;
}

export interface ScoringOutput {
  fitScore: number;           // 0–100
  confidenceScore: number;    // 0–100
  priorityTier: 'tier1' | 'tier2' | 'tier3' | 'disqualified';
  breakdown: Array<{
    factor: string;
    contribution: number;
    evidenceQuote: string;
    sourceUrl: string;
  }>;
}
```

Rules:
- Fit Score is computed deterministically from matched signal weights
- If any disqualifier is triggered, `priorityTier = 'disqualified'` and `fitScore = 0`
- Confidence Score is derived from `researchConfidence` adjusted for signal completeness (ratio of signals with evidence vs total possible)
- `tier1`: fitScore >= 70, `tier2`: 40–69, `tier3`: < 40
- Every point in the score must trace back to at least one evidence entry in the breakdown

### Files to modify

**`src/db/schema.ts`** — Add: `export * from './schema/jobs';`

**Existing workflow files** (`src/lib/workflows/discovery.ts`, `src/lib/workflows/enrichment.ts`):
- Refactor monolithic workflow into discrete steps that each create a `researchTasks` record
- Each step writes its output to `researchTasks.extractedSignals` and `researchTasks.raw_artifacts`
- Failed steps set status to `FAILED` with error_message
- Add retry logic with max 3 retries per task

### Migration

```bash
npx wrangler d1 migrations create leadroom phase2_research_tasks
```

Single migration file with:
1. `CREATE TABLE research_tasks (...);`

### Verification

1. `npx tsc --noEmit` exits 0
2. `npm test` passes
3. Zod schemas reject invalid output: write a quick assertion that validates a known-good payload and fails a known-bad payload
4. Scoring service unit tests: given a known ICP and known signals, the output fitScore matches the expected deterministic value
5. Migration applies locally without errors

### Definition of Done

- [ ] `researchTasks` table exists in schema and DB
- [ ] Three Zod schemas defined with strict validation
- [ ] Scoring service computes fitScore, confidenceScore, priorityTier deterministically
- [ ] Existing workflow files create `researchTasks` records for each step
- [ ] Failed tasks set status and error_message
- [ ] Retry logic implemented
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` passes

---

## Phase 3: Prioritization & Command Center UI

### Goal

Turn research artifacts into a ranked, evidence-backed prospect list and detail view that lets a founder review a prospect in under 60 seconds.

### Prerequisites

- Phase 1 and 2 data models are deployed
- Scoring service is functional
- Research tasks can produce signals

### In scope

- `src/app/(dashboard)/page.tsx` — Command Center dashboard
- `src/app/(dashboard)/prospects/[id]/page.tsx` — Prospect detail page (new route)
- Display components for fit score, confidence, evidence breakdown, priority tier
- Manual override UI for fit score

### Out of scope

- Renovating other existing pages (leads list, campaigns, settings)
- Backend logic for research triggers or approval workflows
- The old lead detail page at `/leads/[id]` (it still works but routes to the new prospect detail)

### Files to create

**`src/app/(dashboard)/page.tsx`** — Command Center:
- "Ready to Review" prospects table
- Columns: Company, Fit Score (with color), Confidence (with meter), Priority Tier (badge), Top Signal, Last Researched, Action
- Sortable by fit score descending by default
- Filter bar: by market, priority tier, status
- Empty state: "Add prospects and run research to see your command center"
- Loading state: skeleton table

**`src/app/(dashboard)/prospects/[id]/page.tsx`** — Prospect Detail:
- Split view layout:
  - **Left panel**: Company context (name, domain, summary), Contacts, Status
  - **Right panel**: Score Breakdown & Evidence
    - Fit Score with breakdown of contributing signals
    - Confidence Score with explanation
    - Priority Tier badge
    - Each signal links to its evidence quote and source URL
- Warning state: banner when `confidenceScore < 50`
- Manual override UI: "Override Score" button → inline form for new score + reason
- Empty state: "Research in progress — check back soon"

**`src/components/prospects/ScoreBreakdown.tsx`** — Reusable score display:
- Props: `{ fitScore: number; confidenceScore: number; priorityTier: string; breakdown: Array<{factor: string; contribution: number; evidenceQuote: string; sourceUrl: string}> }`
- Visual: circular gauge for fit score, bar for confidence, badge for tier
- Expandable rows for each breakdown factor showing evidence

**`src/components/prospects/EvidenceCard.tsx`** — Reusable evidence display:
- Props: `{ evidenceQuote: string; sourceUrl: string; confidence: number }`
- Visual: quoted text with clickable source link, confidence indicator

### Files to modify

**`src/lib/domain/scoring.ts`** — Add manual override function:
```ts
export function applyManualOverride(
  currentScore: ScoringOutput,
  override: { fitScore?: number; reason: string; userId: string }
): ScoringOutput & { isOverridden: boolean; overrideReason: string; overriddenBy: string }
```

### Verification

1. `npx tsc --noEmit` exits 0
2. `npm run build` exits 0
3. Command Center renders with seeded prospects and scores
4. Clicking a prospect navigates to detail page
5. Detail page shows score breakdown with expandable evidence
6. Low-confidence warning banner appears when applicable
7. Manual override form accepts new score and reason, updates display
8. Responsive: 320 px has no horizontal overflow; 1280 px shows split view
9. Keyboard navigation works for table rows and expandable evidence
10. `npx playwright test` (if available) or manual screenshot comparison

### Definition of Done

- [ ] Command Center table is sortable, filterable, and shows all required columns
- [ ] Prospect detail has left/right split view with evidence and score
- [ ] `ScoreBreakdown` component is reusable and shows gauge + breakdown rows
- [ ] `EvidenceCard` component shows quoted evidence with source link
- [ ] Low-confidence warning is visually distinct
- [ ] Manual override works and stores reason
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] No horizontal overflow at 320 px

---

## Phase 4: Approval-Gated Outreach & Learning Loop

### Goal

Generate personalized, evidence-backed outreach drafts, require explicit human approval before any outbound action, and track outcomes to feed ICP refinement suggestions.

### Prerequisites

- Phase 1–3 complete
- Prospects have research signals and scores
- Command Center and Prospect Detail are functional

### In scope

- `src/db/schema/outreach.ts` — add `Outcome` and `LearningSuggestion` tables
- `src/lib/domain/drafting.ts` — agentic draft generator using Offer + Prospect Signals
- `src/lib/domain/outcomes.ts` — outcome logging and learning suggestion engine
- UI: side-by-side draft review with evidence inspector, approve/reject/rejection-reason

### Out of scope

- Actual email sending or integration with email/LinkedIn APIs
- Automated outbound sequences
- CRM export or third-party integration
- Multi-step sequences

### Files to modify

**`src/db/schema/outreach.ts`** — Add these new tables:

1. **`outcomes`**
   | Column | Type | Constraints |
   |--------|------|-------------|
   | `id` | `text` | `primaryKey` |
   | `prospect_id` | `text` | `notNull`, `references(() => prospects.id)` |
   | `outreach_draft_id` | `text` | `references(() => outreachDrafts.id)` |
   | `outcome_type` | `text` | `notNull` — `'REPLIED' \| 'MEETING_BOOKED' \| 'BOUNCED' \| 'NOT_INTERESTED' \| 'WON' \| 'LOST'` |
   | `notes` | `text` | — |
   | `logged_by_user_id` | `text` | `references(() => users.id)` |
   | `created_at` | `integer` | timestamp default |

   Index: `prospect_id + outcome_type` composite

2. **`learning_suggestions`**
   | Column | Type | Constraints |
   |--------|------|-------------|
   | `id` | `text` | `primaryKey` |
   | `workspace_id` | `text` | `notNull`, `references(() => workspaces.id)` |
   | `suggested_change` | `text` | JSON — describes the ICP/offer change |
   | `supporting_evidence` | `text` | JSON — outcome data backing the suggestion |
   | `status` | `text` | `notNull`, `default('PENDING')` — `'PENDING' \| 'APPLIED' \| 'DISMISSED'` |
   | `created_at` | `integer` | timestamp default |
   | `reviewed_at` | `integer` | timestamp |
   | `reviewed_by_user_id` | `text` | `references(() => users.id)` |

3. Update `outreachDrafts` to add columns for Phase 4:
   - `cited_evidence` — `text` (JSON array of `{signalName, evidenceQuote, sourceUrl}`)
   - `risk_flags` — `text` (JSON array of warning strings)
   - `rejection_reason` — `text`

**`src/lib/domain/drafting.ts`** — Agentic draft generator:
```ts
export interface DraftInput {
  offer: { name: string; targetPain: string; desiredOutcome: string; proofPoints: string[]; forbiddenClaims: string[] };
  prospect: { companyName: string; domain: string; signals: Signal[]; contacts: Contact[] };
}

export interface DraftOutput {
  subjectLine: string;
  body: string;
  citedEvidence: Array<{ sentence: string; evidenceQuote: string; sourceUrl: string }>;
  riskFlags: string[];
  confidence: number;
}
```

Implementation rules:
- Every sentence in the draft must be supported by at least one cited evidence entry
- If a sentence references a signal, the corresponding evidence quote and source URL must be attached
- A "Risk Flag" is generated for any sentence where evidence is weak or inferred, not directly quoted
- The drafter must never invent evidence, contacts, funding, or technology not in the input signals
- Forbidden claims from the Offer must be checked and flagged

**`src/lib/domain/outcomes.ts`** — Outcome and learning logic:
```ts
export function generateLearningSuggestions(
  workspaceId: string,
  outcomes: Array<{ prospectId: string; outcomeType: string; signals: Signal[] }>,
  currentIcp: ICPProfile
): Array<{ suggestedChange: object; supportingEvidence: object }>
```

Rule:
- If a signal appears in 80%+ of positive outcomes and has weight < 5, suggest increasing weight
- If a signal appears in 80%+ of negative outcomes and has weight > 0, suggest decreasing or making it a negative signal
- If a disqualifier never fires in positive outcomes, suggest removing it

### UI Changes

**`src/app/(dashboard)/prospects/[id]/page.tsx`** — Add an "Outreach" tab to the prospect detail:
- Shows existing drafts for this prospect
- "Generate Draft" button that calls `drafting.ts`
- Side-by-side review: draft text on left, cited evidence on right
- Approve / Reject with Reason / Regenerate actions
- After approval: prompt to log outcome (if sent externally)

**`src/components/prospects/outreach/DraftReview.tsx`** — New component:
- Left panel: draft body with highlighted sentences
- Right panel: evidence inspector showing cited quotes, source URLs
- Bottom action bar: Approve (confirms without sending), Reject (with reason input), Regenerate
- Risk flags displayed as warning banners above the draft
- States: empty (no drafts), generating (skeleton), ready (show draft), approved (locked view), rejected (with reason)

**`src/components/prospects/outreach/OutcomeLogger.tsx`** — New component:
- Radio/button group for outcome type (Replied, Meeting Booked, Bounced, Not Interested, Won, Lost)
- Optional notes field
- Submit button
- After submit: show "Outcome logged" confirmation

### Migration

```bash
npx wrangler d1 migrations create leadroom phase4_outreach_and_outcomes
```

Expected SQL:
1. `CREATE TABLE outcomes (...);`
2. `CREATE TABLE learning_suggestions (...);`
3. `ALTER TABLE outreach_drafts ADD COLUMN cited_evidence TEXT;`
4. `ALTER TABLE outreach_drafts ADD COLUMN risk_flags TEXT;`
5. `ALTER TABLE outreach_drafts ADD COLUMN rejection_reason TEXT;`

### Verification

1. `npx tsc --noEmit` exits 0
2. `npm test` passes
3. Generate draft: given a mock Offer + Prospect signals, `drafting.ts` returns a valid `DraftOutput` with cited evidence for every sentence
4. Risk flags appear for weak evidence
5. Approve: draft status changes to APPROVED; user sees confirmation that sending was not performed
6. Reject with reason: draft status changes to REJECTED; rejection_reason is stored
7. Log outcome: outcome record is created; learning suggestion is generated if pattern detected
8. Side-by-side review renders correctly at 768 and 1280 px
9. No keyboard or screen-reader regression on new components

### STOP conditions (all phases)

- Any automated outbound messaging capability is introduced without an explicit human approval step
- Evidence linkage is dropped (AI claims without source references)
- A phase requires a new paid dependency or external service not already in the stack
- Typecheck or build fails outside the touched scope and cannot be proven pre-existing

### Definition of Done (full plan)

- [x] Phase 1: Strategy tables + Prospect rename deployed and verified
- [x] Phase 2: Research tasks, Zod schemas, and scoring service operational
- [x] Phase 3: Command Center and Prospect Detail with evidence-backed scores
- [x] Phase 4: Approval-gated outreach with cited evidence, outcome tracking, and learning suggestions
- [x] All phases pass `npx tsc --noEmit` and `npm test`
- [x] No scope creep: only files listed above are created or modified
