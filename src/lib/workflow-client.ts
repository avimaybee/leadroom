import { getDb, type Db } from '@/db';
import { fetchSiteContent } from '@/lib/scraper';
import { generateResearch, runTriageAI, generateAudit } from '@/lib/ai';
import { heuristicTriage } from '@/lib/triage/heuristics';
import { enrichCandidate } from '@/lib/triage/enricher';
import { jobRuns, researchSnapshots } from '@/db/schema/research';
import { leads, activities } from '@/db/schema/core';
import { candidateLeads } from '@/db/schema/discovery';
import { AuditService } from '@/services/audits';
import { ScoringService } from '@/services/scoring';
import { checkApifyRunStatus, fetchApifyResults } from '@/lib/discovery/apify';
import { eq, desc as drizzleDesc } from 'drizzle-orm';

export interface CloudflareWorkflow {
  create(options: { params: Record<string, unknown> }): Promise<unknown>;
}

/**
 * Triggers the Research Snapshot Workflow.
 * If running under Cloudflare with the Workflow binding available, it triggers the real durable workflow.
 * If running locally in Node.js (Next.js dev server, tests) where the binding is absent, it simulates
 * the identical step-by-step workflow asynchronously in the background.
 */
export async function triggerResearchWorkflow(
  db: Db,
  workflowBinding: CloudflareWorkflow | undefined | null,
  leadId: string,
  jobId: string,
  userId?: string | null
) {
  if (workflowBinding && typeof workflowBinding.create === 'function') {
    console.log(`[WorkflowClient] Triggering Cloudflare Workflow for lead: ${leadId}, job: ${jobId}`);
    try {
      await workflowBinding.create({
        params: { leadId, jobId, userId: userId || null }
      });
      return;
    } catch (err: unknown) {
      console.error('[WorkflowClient] Failed to trigger Cloudflare Workflow binding. Falling back to simulation.', err);
    }
  }

  // Simulation mode
  console.log(`[WorkflowClient] Local simulation mode for lead: ${leadId}, job: ${jobId}`);

  const runSimulation = async () => {
    try {
      // Step 1: Fetch Lead Info
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      if (!lead) {
        throw new Error(`Lead not found: ${leadId}`);
      }

      // Update job run status to RUNNING
      await db.update(jobRuns)
        .set({ status: 'RUNNING', startedAt: new Date() })
        .where(eq(jobRuns.id, jobId));

      // Step 2: Fetch and scrape website
      let scraped = null;
      if (lead.website) {
        try {
          scraped = await fetchSiteContent(lead.website);
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(`[WorkflowClient Simulation] Website scraping failed for ${lead.website}:`, error);
          scraped = {
            title: '',
            url: lead.website,
            content: `[Failed to scrape website: ${errMsg}]`,
            description: '',
          };
        }
      }

      // Step 3: LLM Inference
      const location = [lead.city, lead.region].filter(Boolean).join(', ') || null;
      const research = await generateResearch(
        db,
        lead.name,
        lead.company || null,
        lead.website || null,
        lead.industry || null,
        scraped?.content || null,
        location
      );

      // Step 4: Save Snapshot & Activity
      const snapshotId = crypto.randomUUID();
      await db.insert(researchSnapshots).values({
        id: snapshotId,
        leadId,
        createdByUserId: userId || null,
        origin: 'AI_GENERATED',
        snapshotTitle: scraped?.title ? `Research Snapshot: ${scraped.title}` : 'AI Research Snapshot',
        companySummary: research.companySummary,
        productsServicesSummary: research.productsServicesSummary,
        digitalPresenceNotes: research.digitalPresenceNotes,
        websiteNotes: research.websiteNotes,
        brandingNotes: research.brandingNotes,
        painPointsHypotheses: research.painPointsHypotheses,
        opportunityHypotheses: research.opportunityHypotheses,
        sources: JSON.stringify(research.sources || [lead.website].filter(Boolean)),
        confidenceLevel: research.confidenceLevel,
        jobRunId: jobId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Log system activity
      await db.insert(activities).values({
        id: crypto.randomUUID(),
        leadId,
        type: 'Research generated',
        summary: `AI research snapshot generated with ${research.confidenceLevel} confidence`,
        timestamp: new Date(),
      });

      // Step 5: Mark Job Complete
      await db.update(jobRuns)
        .set({
          status: 'COMPLETED',
          finishedAt: new Date(),
        })
        .where(eq(jobRuns.id, jobId));

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error occurred during simulation';
      console.error(`[WorkflowClient Simulation] Research workflow failed for lead ${leadId}:`, error);

      // Update job run to FAILED in DB
      try {
        await db.update(jobRuns)
          .set({
            status: 'FAILED',
            errorSummary: errMsg,
            finishedAt: new Date(),
          })
          .where(eq(jobRuns.id, jobId));

        await db.insert(activities).values({
          id: crypto.randomUUID(),
          leadId,
          type: 'Enrichment failed',
          summary: `AI research generation failed: ${errMsg}`,
          timestamp: new Date(),
        });
      } catch (dbErr: unknown) {
        console.error('[WorkflowClient Simulation] Failed to write failure status to DB:', dbErr);
      }
    }
  };

  let ctx: any = undefined;
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    ctx = getCloudflareContext().ctx;
  } catch (e) {}

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(runSimulation());
  } else {
    runSimulation().catch((err) => console.error('[WorkflowClient] Unhandled research simulation error:', err));
  }
}

/**
 * Triggers the Triage Workflow.
 * If running under Cloudflare with the Workflow binding available, it triggers the real durable workflow.
 * If running locally in Node.js (Next.js dev server, tests) where the binding is absent, it simulates
 * the identical triage process asynchronously in the background.
 */
export async function triggerTriageWorkflow(
  db: Db,
  workflowBinding: CloudflareWorkflow | undefined | null,
  leadId: string
) {
  if (workflowBinding && typeof workflowBinding.create === 'function') {
    console.log(`[WorkflowClient] Triggering Cloudflare Triage Workflow for lead: ${leadId}`);
    try {
      await workflowBinding.create({
        params: { leadId }
      });
      return;
    } catch (err: unknown) {
      console.error('[WorkflowClient] Failed to trigger Cloudflare Triage Workflow binding. Falling back to simulation.', err);
    }
  }

  // Simulation mode
  console.log(`[WorkflowClient] Local simulation mode for triage on lead: ${leadId}`);

  const runTriageSimulation = async () => {
    try {
      // 1. Fetch Lead
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      if (!lead) {
        throw new Error(`Lead not found: ${leadId}`);
      }

      // 2. Initial Website Check
      if (!lead.website) {
        await db.update(leads)
          .set({ triagePriority: 'HIGH', triageReason: 'No website detected.' })
          .where(eq(leads.id, leadId));
          
        await db.insert(activities).values({
          id: crypto.randomUUID(),
          leadId,
          type: 'Triage complete',
          summary: 'Scored HIGH priority due to missing website (Simulation).',
          timestamp: new Date(),
        });
        const scoringService = new ScoringService(db);
        await scoringService.recalculateScore(leadId);
        return;
      }

      // 3. Fetch Site Content
      let siteContent = null;
      let triageSource = 'scraped_website';
      try {
        siteContent = await fetchSiteContent(lead.website);
      } catch (err: unknown) {
        // Try to fall back to research snapshot
        const [snapshot] = await db.select()
          .from(researchSnapshots)
          .where(eq(researchSnapshots.leadId, leadId))
          .orderBy(drizzleDesc(researchSnapshots.createdAt))
          .limit(1);

        if (snapshot && (snapshot.websiteNotes || snapshot.brandingNotes)) {
          siteContent = {
            title: '',
            url: lead.website,
            content: `Website Notes: ${snapshot.websiteNotes || ''}\nBranding Notes: ${snapshot.brandingNotes || ''}`,
            description: '',
          };
          triageSource = 'research_snapshot';
        } else {
          // Unreachable website is high priority opportunity
          await db.update(leads)
            .set({ triagePriority: 'HIGH', triageReason: 'Website failed to load or is unreachable.' })
            .where(eq(leads.id, leadId));

          await db.insert(activities).values({
            id: crypto.randomUUID(),
            leadId,
            type: 'Triage complete',
            summary: 'Scored HIGH priority due to unreachable website (Simulation).',
            timestamp: new Date(),
          });
          const scoringService = new ScoringService(db);
          await scoringService.recalculateScore(leadId);
          return;
        }
      }

      // 4. AI Triage Analysis
      const triageResult = await runTriageAI(db, siteContent.content.substring(0, 5000));
      const priority = triageResult.status === 'MODERN' ? 'SKIP' : 'MEDIUM';
      const suffix = triageSource === 'research_snapshot' ? ' (Evaluated from research snapshot)' : '';

      // 5. Save Triage Result
      await db.update(leads)
        .set({ triagePriority: priority, triageReason: triageResult.reason + suffix })
        .where(eq(leads.id, leadId));
        
      await db.insert(activities).values({
        id: crypto.randomUUID(),
        leadId,
        type: 'Triage complete',
        summary: `Scored ${priority} priority. Reason: ${triageResult.reason}${suffix} (Simulation)`,
        timestamp: new Date(),
      });

      const scoringService = new ScoringService(db);
      await scoringService.recalculateScore(leadId);

    } catch (error: unknown) {
      console.error(`[WorkflowClient Simulation] Triage workflow failed for lead ${leadId}:`, error);
    }
  };

  let ctx: any = undefined;
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    ctx = getCloudflareContext().ctx;
  } catch (e) {}

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(runTriageSimulation());
  } else {
    runTriageSimulation().catch((err) => console.error('[WorkflowClient] Unhandled triage simulation error:', err));
  }
}

/**
 * Triggers the Discovery Search Workflow.
 * If running under Cloudflare with the Workflow binding available, it triggers the real durable workflow.
 * If running locally in Node.js (Next.js dev server, tests) where the binding is absent, it simulates
 * the identical discovery polling and saving steps asynchronously in the background.
 */
export async function triggerDiscoverySearchWorkflow(
  db: Db,
  workflowBinding: CloudflareWorkflow | undefined | null,
  jobId: string,
  runId: string,
  datasetId: string,
  niche: string,
  location: string,
  scopeId: string | null,
  userId: string
) {
  if (workflowBinding && typeof workflowBinding.create === 'function') {
    console.log(`[WorkflowClient] Triggering Cloudflare Discovery Search Workflow for job: ${jobId}`);
    try {
      await workflowBinding.create({
        params: { jobId, runId, datasetId, niche, location, scopeId: scopeId || null, userId }
      });
      return;
    } catch (err: unknown) {
      console.error('[WorkflowClient] Failed to trigger Cloudflare Discovery Search Workflow binding. Falling back to simulation.', err);
    }
  }

  // Simulation mode
  console.log(`[WorkflowClient] Local simulation mode for discovery search job: ${jobId}`);

  const runSimulation = async () => {
    try {
      // Mark RUNNING immediately so the UI stops showing "QUEUED"
      const now = new Date();
      await db.update(jobRuns)
        .set({ status: 'RUNNING', startedAt: now, currentStage: 'Starting Apify crawler...' })
        .where(eq(jobRuns.id, jobId));

      // 1. Wait/poll Apify (max ~10 min for simulation, matching user's ≤10 min target)
      let status = await checkApifyRunStatus(runId);
      let apifyRetries = 0;
      const apifyMaxRetries = 120; // 120 × 5s = 600s = 10 min

      await db.update(jobRuns)
        .set({ currentStage: `Waiting for Apify crawler (status: ${status})...` })
        .where(eq(jobRuns.id, jobId));

      while (status === 'RUNNING' || status === 'READY') {
        if (apifyRetries >= apifyMaxRetries) {
          throw new Error(`Apify actor did not finish within ${(apifyMaxRetries * 5) / 60} minutes`);
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const [j] = await db.select().from(jobRuns).where(eq(jobRuns.id, jobId)).limit(1);
        if (j && (j.status === 'FAILED' || j.errorSummary === 'Cancelled by user')) {
          throw new Error('Cancelled by user');
        }

        status = await checkApifyRunStatus(runId);
        apifyRetries++;
      }

      await db.update(jobRuns)
        .set({ currentStage: `Apify finished with status: ${status}. Fetching results...` })
        .where(eq(jobRuns.id, jobId));

      if (status !== 'SUCCEEDED') {
        throw new Error(`Apify actor run ended with status: ${status}`);
      }

      // 2. Fetch Apify results
      const results = await fetchApifyResults(datasetId, niche, location);

      // 3. Save all candidates immediately with heuristic triage (zero cost)
      if (results.length > 0) {
        const candidates = results.map((r) => {
          const heuristic = heuristicTriage({ website: r.website || null, phone: r.phone || null });
          return {
            id: crypto.randomUUID(),
            discoveryScopeId: scopeId || null,
            rawName: r.name || 'Unknown Business',
            rawWebsiteUrl: r.website || null,
            rawContactInfo: r.phone || null,
            rawLocation: [r.city, r.region].filter(Boolean).join(', ') || null,
            notes: r.industry ? `Industry: ${r.industry}` : null,
            status: 'NEW' as const,
            triagePriority: heuristic.triagePriority,
            triageReason: heuristic.triageReason,
            createdAt: now,
            updatedAt: now,
          };
        });

        await db.insert(candidateLeads).values(candidates);
      }

      await db.update(jobRuns)
        .set({
          totalItems: results.length,
          itemsProcessed: 0,
          currentStage: 'Enriching candidates',
        })
        .where(eq(jobRuns.id, jobId));

      // 4. Enrich candidates (three-level, only for UNASSESSED)
      if (results.length > 0) {
        const BATCH_SIZE = 10;
        let processed = 0;

        // Only enrich candidates that heuristics flagged as UNASSESSED
        const toEnrich = results.filter((r) => {
          const heuristic = heuristicTriage({ website: r.website, phone: r.phone });
          return heuristic.triagePriority === 'UNASSESSED';
        });

        for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
          const [j] = await db.select().from(jobRuns).where(eq(jobRuns.id, jobId)).limit(1);
          if (j && (j.status === 'FAILED' || j.errorSummary === 'Cancelled by user')) {
            throw new Error('Cancelled by user');
          }

          const batch = toEnrich.slice(i, i + BATCH_SIZE);

          const batchResults = await Promise.allSettled(
            batch.map(async (r) => {
              if (!r.website) return null;
              try {
                return await enrichCandidate(r.website, db);
              } catch {
                return null;
              }
            }),
          );
          for (let j = 0; j < batch.length; j++) {
            const r = batch[j];
            const batchResult = batchResults[j];
            let triagePriority: 'HIGH' | 'MEDIUM' | 'SKIP' = 'MEDIUM';
            let triageReason = 'Enrichment failed (unreachable or blocked). Needs manual triage.';

            if (batchResult.status === 'fulfilled' && batchResult.value) {
              triagePriority = batchResult.value.triagePriority;
              triageReason = batchResult.value.triageReason;
            }

            if (r.website) {
              await db
                .update(candidateLeads)
                .set({ triagePriority, triageReason, updatedAt: new Date() })
                .where(eq(candidateLeads.rawWebsiteUrl, r.website));
            }
          }

          processed += batch.length;
          const sample = (() => {
            for (const r of batchResults) {
              if (r.status === 'fulfilled' && r.value?.triageReason) return r.value.triageReason;
            }
            return undefined;
          })();

          await db.update(jobRuns)
            .set({
              itemsProcessed: processed,
              currentStage: `Enriching ${processed} of ${toEnrich.length}${sample ? ` — ${sample.substring(0, 60)}` : ''}`,
            })
            .where(eq(jobRuns.id, jobId));
        }
      }

      await db.update(jobRuns)
        .set({
          status: 'COMPLETED',
          itemsProcessed: results.length,
          currentStage: 'Complete',
          finishedAt: new Date(),
        })
        .where(eq(jobRuns.id, jobId));

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error during local simulation';
      console.error(`[WorkflowClient Simulation] Discovery search failed for job ${jobId}:`, error);

      try {
        await db.update(jobRuns)
          .set({ status: 'FAILED', errorSummary: errMsg, finishedAt: new Date() })
          .where(eq(jobRuns.id, jobId));
      } catch (dbErr) {
        console.error('[WorkflowClient Simulation] Failed to write failure status to DB:', dbErr);
      }
    }
  };

  let ctx: any = undefined;
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    ctx = getCloudflareContext().ctx;
  } catch (e) {}

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(runSimulation());
  } else {
    runSimulation().catch((err) => console.error('[WorkflowClient] Unhandled discovery search simulation error:', err));
  }
}

/**
 * Triggers the Audit Snapshot Workflow.
 * If running under Cloudflare with the Workflow binding available, it triggers the real durable workflow.
 * If running locally in Node.js, it simulates the background execution.
 */
export async function triggerAuditWorkflow(
  db: Db,
  workflowBinding: CloudflareWorkflow | undefined | null,
  leadId: string,
  jobId: string,
  userId?: string | null
) {
  if (workflowBinding && typeof workflowBinding.create === 'function') {
    console.log(`[WorkflowClient] Triggering Cloudflare Audit Workflow for lead: ${leadId}, job: ${jobId}`);
    try {
      await workflowBinding.create({
        params: { leadId, jobId, userId: userId || null }
      });
      return;
    } catch (err: unknown) {
      console.error('[WorkflowClient] Failed to trigger Cloudflare Audit Workflow binding. Falling back to simulation.', err);
    }
  }

  // Simulation mode
  console.log(`[WorkflowClient] Local simulation mode for audit on lead: ${leadId}, job: ${jobId}`);

  const runSimulation = async () => {
    try {
      // Step 1: Fetch Lead Info
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      if (!lead) {
        throw new Error(`Lead not found: ${leadId}`);
      }

      // Update job run status to RUNNING
      await db.update(jobRuns)
        .set({ status: 'RUNNING', startedAt: new Date() })
        .where(eq(jobRuns.id, jobId));

      // Step 2: Check research snapshot for website existence
      let websiteConfirmed = true;
      if (leadId) {
        try {
          const [snapshot] = await db.select()
            .from(researchSnapshots)
            .where(eq(researchSnapshots.leadId, leadId))
            .orderBy(drizzleDesc(researchSnapshots.createdAt))
            .limit(1);
          if (snapshot) {
            const notes = snapshot.websiteNotes || '';
            const noWebsiteKeywords = ['no website', 'does not have a website', 'website not found', 'no web presence'];
            const noWebsite = notes.length === 0 || noWebsiteKeywords.some(k => notes.toLowerCase().includes(k));
            websiteConfirmed = !noWebsite;
          }
        } catch (e) {
          // Snapshot query failed — proceed assuming website exists
        }
      }

      // Step 3: Fetch and scrape website (skip if research confirmed no website)
      let scraped = null;
      if (lead.website && websiteConfirmed) {
        try {
          scraped = await fetchSiteContent(lead.website);
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.warn(`[WorkflowClient Simulation] Website scraping failed for audit on ${lead.website}, will rely on research snapshot context. Error: ${errMsg}`);
          scraped = {
            title: '',
            url: lead.website,
            content: `[Failed to scrape website: ${errMsg}]`,
            description: '',
          };
        }
      }

      // Step 4: LLM Inference (skip AI call if research confirmed no website)
      let auditResult;
      if (!websiteConfirmed) {
        const name = lead.company || lead.name;
        auditResult = {
          websiteQualityScore: 0,
          designAestheticScore: 0,
          messagingClarityScore: 0,
          socialPresenceScore: 15,
          overallBrandingScore: 0,
          keyStrengths: '',
          keyWeaknesses: '- No website exists for this business\n- No digital presence to evaluate',
          recommendedImprovements: '- Build a professional website\n- Establish a basic digital footprint',
          sources: [] as string[],
        };
      } else {
        auditResult = await generateAudit(
          db,
          lead.name,
          lead.company || null,
          lead.website || null,
          lead.industry || null,
          scraped?.content || null,
          leadId
        );
      }

      // Step 4: Save Audit snapshot & trigger scoring
      const auditService = new AuditService(db);
      await auditService.createAudit({
        leadId,
        createdByUserId: userId || null,
        origin: 'AI_GENERATED',
        websiteQualityScore: auditResult.websiteQualityScore,
        designAestheticScore: auditResult.designAestheticScore,
        messagingClarityScore: auditResult.messagingClarityScore,
        socialPresenceScore: auditResult.socialPresenceScore,
        overallBrandingScore: auditResult.overallBrandingScore,
        keyStrengths: auditResult.keyStrengths,
        keyWeaknesses: auditResult.keyWeaknesses,
        recommendedImprovements: auditResult.recommendedImprovements,
        sources: auditResult.sources || [lead.website || ''].filter(Boolean),
        jobRunId: jobId,
      });

      // Step 5: Mark Job COMPLETED
      await db.update(jobRuns)
        .set({ status: 'COMPLETED', finishedAt: new Date() })
        .where(eq(jobRuns.id, jobId));

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error during local audit simulation';
      console.error(`[WorkflowClient Simulation] Audit execution failed for job ${jobId}:`, error);

      try {
        await db.update(jobRuns)
          .set({ status: 'FAILED', errorSummary: errMsg, finishedAt: new Date() })
          .where(eq(jobRuns.id, jobId));
      } catch (dbErr) {
        console.error('[WorkflowClient Simulation] Failed to write failure status to DB:', dbErr);
      }
    }
  };

  let ctx: any = undefined;
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    ctx = getCloudflareContext().ctx;
  } catch (e) {}

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(runSimulation());
  } else {
    runSimulation().catch((err) => console.error('[WorkflowClient] Unhandled audit simulation error:', err));
  }
}


