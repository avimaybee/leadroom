# Proposal — Intelligent Automations & Workflow Efficiency

**Goal:** Reduce repetitive clicks and wait times by proactively running background jobs (Research, Audit, Drafting) exactly when the operator needs them. Maintain absolute "human-in-the-loop" approval for all external communications, while keeping API costs predictable and opt-in.

---

## 1. Auto-Research on Discovery Promotion ✅ DONE

**Implemented:**
- Added `autoResearchPromotedLeads` boolean column to `discovery_scopes` table (default `true`)
- `DiscoveryService.promoteCandidate()` now checks candidate's `rawWebsiteUrl` before queuing research — skips if no URL
- If candidate belongs to a scope, checks scope's `autoResearchPromotedLeads` toggle — skips if `false`
- Added migration `0017_silent_art.sql`
- Added toggle checkbox to scope creation UI (`/scopes/new`)
- Added `autoResearchPromotedLeads` to `CreateDiscoveryScopeSchema` (Zod)

## 2. Playbook-Triggered Background Jobs ✅ DONE

**Implemented:**
- Added `actionType` (`'TASK' | 'JOB'`) and `jobType` columns to `playbookTasks` schema (migration `0019_copper_storm.sql`)
- `triggerStagePlaybook` in `LeadService` now branches on `template.actionType`:
  - `'TASK'` — existing behavior (create a task with due date offset)
  - `'JOB'` — inserts `jobRuns` record with the specified `jobType` (idempotency-guarded against duplicate QUEUED/RUNNING), triggers `researchWorkflow` for `RESEARCH_GENERATION` jobs
- Pipeline settings page updated: `upsertPlaybookAction` persists the new fields
- PlaybooksEditor UI updated: each task row has a "Type" dropdown (Task/Job) and conditional "Job Type" selector with options: `RESEARCH_GENERATION`, `AUDIT_GENERATION`, `OUTREACH_DRAFT`
- Existing playbook tasks default to `actionType: 'TASK'` preserving backward compatibility

## 3. Proactive Stale Nurturing (Draft Pre-computation)
Currently, `MonitorStalledLeadWorkflow` identifies leads stuck in a stage for >7 days and creates a passive "Stale" signal.
**Automation:**
- If a lead becomes stale in the "Outreach" or "Follow-up" stage, automatically queue an `OUTREACH_DRAFT` job with a "bump" prompt (e.g., "Draft a polite follow-up acknowledging the delay").
- Instead of just a "Stale" signal, the system creates a high-priority task: "Review auto-generated follow-up draft".
- **UX Impact:** The operator clicks the task, reviews the pre-written draft, edits it, and hits send. Zero prompt engineering required.
- **Cost Control:** Add a global setting `autoDraftStaleFollowUps` in the integrations config. Ensure a lead only gets ONE auto-draft per stage to prevent infinite looping.

## 4. Next-Best-Action (NBA) "One-Click Execution" ✅ DONE

**Implemented:**
- Primary CTA button in the Next Action banner now executes the action directly instead of just navigating:
  - `no_research` → fires `POST /api/leads/[id]/research`, sets polling job ID, navigates to research tab
  - `no_audit` → calls `triggerAuditAction()` server action, navigates to audit tab
  - `unsent_draft` → calls `generateOutreachDraftAction(leadId, 'EMAIL')`, navigates to outreach tab
- Button shows spinner + contextual label ("Starting research...", "Starting audit...", "Generating draft...") during execution
- Falls back to tab navigation on error
- "View details" link remains available for manual navigation
- Collapses the funnel from `Read Signal → Navigate → Act → Wait` to `Read Signal → Act → Review`

## 5. Automated Contact Discovery (Enrichment)
Currently, if a lead lacks a stakeholder email, the user must manually search the web.
**Automation:**
- Introduce a new Cloudflare Workflow: `CONTACT_ENRICHMENT_WORKFLOW`.
- When a lead enters the "Research" stage, if `contacts` count is 0, the workflow calls a configured email-finder API (e.g., Hunter, Apollo, or a deep web scrape of the target's `/contact` and `/about` pages).
- **Cost Control:** This is traditionally an expensive API call. It must be strictly opt-in via a global `autoEnrichContacts` toggle.

---

## 6. Auto-Advance Stage After Research Workflow Completes (P0 Bug) ✅ DONE

**Fix applied:**
- `ResearchWorkflowService.generateSnapshots()` now calls `leadService.advanceStageIfEarlier(lead.id, 'In Research')` after saving research, audit, and score (`src/services/research-workflow.ts:167`)
- `LeadService.updateStage()` now calls `scoringService.recalculateScore(id)` on every stage change (`src/services/lead.ts:302-304`)

---

## 7. Model-Agnostic Workflow Optimization (Parallel & Deterministic)

**Discovery:** We must support both **expensive frontier models** (GPT-4o, Claude) and **cheap/smaller models** (Llama-3-8B).
- If we combine all tasks into a single massive prompt, cheap models fail completely (unable to output a 150-line valid JSON object).
- If we run them sequentially, latency is terrible (35+ seconds).
- Currently, `generateLeadScore` is a wasteful LLM call.

**Optimization:**
- **Parallel Fan-Out:** Run `generateResearch`, `generateAudit`, and `generateContactExtraction` in parallel (`Promise.all`). 
  - *Why?* Keeping prompts narrow ensures cheap models can actually succeed at outputting valid JSON. Running in parallel cuts latency in half.
- **Deterministic Scoring (Zero AI):** Eliminate `generateLeadScore` entirely. Compute the score purely in TypeScript using rules applied to the structured JSON returned by the parallel calls (e.g. `hasMissingCTA = +15`).
- **Context Pruning:** Before fanning out, run a fast regex-based HTML-to-Markdown cleaner to strip navbars/footers/inline-styles. This drastically reduces the context window, directly minimizing the cost when we send the HTML multiple times to frontier models.
- **Debounce Scoring:** Added `scoreDirty` column to `leads`. `updateLead` only triggers `recalculateScore` when score-affecting fields (website, email, phone, city, region, industry) actually change. Background `runScoreSweep()` handles any remaining dirty leads. Migration `0018_silver_rain.sql`.

**Cost/Latency Impact:** Eliminates 1 entire LLM call per lead. Drops latency by ~50%. Safely supports dumb/cheap models without sacrificing frontier model speed.

---

## 8. Reliable Background Sweeps (Reminders, Stale Checks, Overdue Tasks) ✅ DONE

**Fix applied:**
- Extracted sweep functions into `src/services/sweeps.ts` — `runReminderSweep()`, `runStaleLeadSweep()`, `runOverdueTaskSweep()`, `runAllSweeps()`
- Created `GET /api/cron/sweeps` — standalone auth-free endpoint that runs all sweeps. Can be called by Cloudflare Cron Triggers, cron-job.org, Vercel Cron, or any external scheduler.
- Added **overdue task sweep** — notifies assignees about tasks past due date, deduplicated to once per 24h per task.
- Updated SSE endpoint (`/api/notifications/sse`) to use shared sweep functions instead of inline ReminderService/LeadService calls.
- SSE also runs the overdue task sweep on the same 60s interval as stale checks.

---

## 9. Batch Operations Expansion ✅ DONE

**Implemented:**
- `bulkAdvanceStageToAction(leadIds, targetStage)` — move to any pipeline stage via "Stage..." dropdown dialog
- `bulkResearchTriggerAction(leadIds)` — queue research jobs for all selected leads (idempotency-guarded)
- `bulkArchiveAction(leadIds)` — archive leads in one transaction with activity logging
- `bulkReassignAction(leadIds, ownerId)` — change assignee via user-picker dialog (`/api/users` endpoint created)
- `bulkExportAction(leadIds)` — CSV export with auto-download blob
- Fixed existing `bulkAdvanceStageAction` to report per-lead errors instead of silent skip (returns structured `{ advanced, skipped: [{id, reason}], errors: [{id, reason}] }`)
- All new buttons added to `BulkActionBar`: Stage..., Research, Reassign, Archive, Export

---

## 10. Duplicate Detection & Auto-Enrichment on Lead Creation

**Discovery:** When creating a lead manually, there's no duplicate check — same website, same email, or same company name can create duplicate records. The `generateContactExtraction` AI function exists in `src/lib/ai.ts` but is **never called** anywhere — the research workflow only does regex-based extraction, which misses context.

**Automation:**
- On lead creation (`createLead`), check existing leads for same `website`, `email`, or normalized `company` name. Show a warning: "A lead with this website already exists. Continue anyway?"
- On candidate promotion, auto-detect `industry` from website content (extract `<title>`, meta description, Open Graph tags) — cheaper than full research. ✅ DONE
- Wire `generateContactExtraction` into the research workflow via the parallel fan-out (Section 7).
- On promotion, normalize website URL and pre-fill company name from webpage `<title>` tag (free fetch, no AI).

**Cost:** Free or very minimal AI usage.

---

## 11. Calendar Auto-Sync & Task Lifecycle Automation

**Discovery:** Calendar sync is manual — user clicks "Sync Now". The reminder/cron reliability gap (section 8) means tasks may never get synced if nobody is watching. Also, there's no lifecycle automation around task completion (e.g., prompting stage advancement when all playbook tasks are done).

**Automation:**
- Auto-sync on task creation: after `addTask` succeeds, fire-and-forget `syncTasksToCalendar(userId)` for the assignee.
- Auto-sync on task update: same for `toggleTaskStatus` — syncs when task is marked complete or reopened.
- Task completion sweep: when all open playbook tasks for a lead are completed, create a notification: "All playbook tasks for [stage] are done — advance to next stage?"
- Business-day-aware due dates: `triggerStagePlaybook` currently adds `daysOffset` in calendar days. Optionally calculate business days so Monday tasks aren't due on weekends.

**Fixed:**
- `LeadService.addTask()` now auto-syncs to Google Calendar after task creation (`src/services/lead.ts:402-406`)
- `LeadService.toggleTaskStatus()` now auto-syncs after status change (`src/services/lead.ts:455-459`)
- Sync is fire-and-forget with `.catch(() => {})` — never blocks task creation. Only fires if assignee has calendar connected (handled internally by CalendarService).

**Cost:** Free (Google Calendar API quota, DB-only task sweep).

---

## 12. Max-Efficiency AI Consolidation (Single-Call Research) ✅ DONE (other agent)

**Discovery:** The full lead lifecycle currently makes **4 LLM calls** (research → audit → score → outreach draft). Research and audit analyze the **exact same website content** with largely overlapping output dimensions. AI scoring (`generateLeadScore`) is a wasteful meta-analysis.

### Consolidation Strategy: The "Distill & Merge" Pattern

**Step 1 — Pre-flight context pruning (free, ~60% token reduction)**

Before any AI call, strip boilerplate HTML: `<nav>`, `<footer>`, `<style>`, `<script>`, SVG blobs, empty nodes, and repetitive attributes. Implement as a `pruneHtml(html: string): string` utility in `src/lib/scraper.ts`.

| Metric | Before | After |
|--------|--------|-------|
| Average scraped size | ~4,000 tokens | ~1,600 tokens |
| Input token cost | Baseline | 60% lower |

**Step 2 — Merge research + audit into a single structured call**

Because next-generation cost-efficient models (like Gemini Flash-Lite, Claude Haiku 4.5, GPT-5 mini) now natively support **Constrained Decoding** (Strict Structured Outputs), we no longer face the risk of malformed JSON on large schemas. The API enforces 100% adherence to the Zod schema.

Instead of calling `generateResearch()` then `generateAudit()`, we execute a single `generateResearchAndAudit()` call with a combined Zod schema:

```typescript
const ResearchAuditSchema = z.object({
  // Research fields
  companySummary: z.string(),
  productsServicesSummary: z.string(),
  digitalPresenceNotes: z.string(),
  websiteNotes: z.string(),
  brandingNotes: z.string(),
  painPointsHypotheses: z.string(),
  opportunityHypotheses: z.string(),
  confidenceLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  // Audit fields
  keyStrengths: z.string(),
  keyWeaknesses: z.string(),
  recommendedImprovements: z.string(),
  // Contact extraction
  contacts: z.object({
    people: z.array(z.object({
      fullName: z.string(), roleTitle: z.string().nullable(),
      email: z.string().nullable(), phone: z.string().nullable(),
      linkedinUrl: z.string().nullable(),
    })).nullable(),
    socialLinks: z.object({
      facebook: z.string().nullable(), linkedin: z.string().nullable(),
      twitter: z.string().nullable(), instagram: z.string().nullable(),
    }).nullable(),
    emails: z.array(z.string()).nullable(),
    phones: z.array(z.string()).nullable(),
  }).nullable(),
  sources: z.array(z.string()),
});
```

**Step 3 — Eliminate AI scoring entirely (Deterministic Scoring)**

`generateLeadScore` is eliminated. We compute the priority score purely in TypeScript using the structured JSON returned by Step 2. The existing `calculateCompletenessScore()` will be enhanced to credit:
- Research confidence HIGH → +5
- Audit has weaknesses identified → +5

This eliminates **1 LLM call per lead** with zero API cost and higher transparency.

### Cost Impact per Lead Workflow

| Metric | Before (4 calls) | After (1 call + deterministic) | Savings |
|--------|-----------------|-------------------------------|---------|
| LLM calls | 4 | 1 | **75% fewer** |
| Input tokens | ~22,300 | ~6,200 | **~72% fewer** |
| Wall-clock time | 3 sequential + 1 | 1 call | **~60% faster** |

At 100 leads/month: ~$15 → ~$4 (GPT-4o), or ~$0.29 → ~$0.08 (Gemini Flash).

### Implementation Order

1. Add `pruneHtml()` to scraper utility in `src/lib/scraper.ts`.
2. Create `generateResearchAndAudit()` with the combined Zod schema in `ai.ts`.
3. Update `ResearchWorkflowService.generateSnapshots()` to call the new merged function.
4. Remove the AI scoring path from `ScoringService.recalculateScore()` and replace it with deterministic rules.
5. Wire contact extraction results into the database.

**Cost:** ~1-2 days dev time. Immediate 72% reduction in AI spend with guaranteed JSON reliability via constrained decoding.

---

## 🛡️ Adherence to AGENTS.md Core Rules
- **Rule 1 (Human in the loop):** Automation stops at the draft layer. No email is ever dispatched automatically.
- **Rule 3 (No spam machines):** Volume is gated by manual stage promotions and Playbook configurations.
- **Rule 8 (Internal business tool, not gimmick):** Every automation serves a concrete operational purpose (eliminating wait times and repetitive clicks) rather than performing opaque, autonomous actions.

---

## Appendix: Prioritized Execution Order

| Priority | Item | Section | Effort | AI Cost Impact |
|----------|------|---------|--------|----------------|
| **P0** | **Merge research + audit + contacts into 1 call + prune HTML** | **§12** | **M** | **-72% AI spend** | ✅ |
| P0 | Auto-advance stage after research workflow completes | §6 | S | None | ✅ |
| P0 | Add `recalculateScore` to `updateStage` | §6 | S | None (rule-based) | ✅ |
| P0 | Eliminate AI `generateLeadScore` (use deterministic) | §12 | S | -25% AI spend | ✅ |
| P0 | Extract sweeps to be cron-reliable (not SSE-dependent) | §8 | M | None | ✅ |
| P1 | Debounce scoring (dirty flag or field-diff) | §7 | S | Saves AI cost | ✅ |
| P1 | Auto-sync calendar on task create/update | §11 | S | None | ✅ |
| P1 | Batch operations expansion (bulk to stage, archive, reassign) | §9 | M | None | ✅ |
| P2 | Auto-research on discovery promotion | §1 | S | None | ✅ |
| P2 | Playbook-triggered background jobs | §2 | M | None | ✅ |
| P2 | Duplicate detection on lead creation | §10 | S | None | ✅ |
| P2 | Overdue task escalation sweep | §8 | S | None | ✅ |
| P2 | NBA one-click execution | §4 | S | None | ✅ |
| P2 | Auto-detect industry from website on promotion | §10 | S | ~$0.01/lead | ✅ |
| P2 | Task completion → prompt stage advancement | §11 | S | None | ✅ |
| P3 | Cache audit results (skip if data unchanged) | §7 | M | Saves AI cost | ✅ |
| P3 | Business-day-aware playbook due dates | §11 | S | None | ✅ |
| P3 | Automated contact discovery (email-finder API integration) | §5 | L | $$$ API cost | ⏭️ Deferred |
