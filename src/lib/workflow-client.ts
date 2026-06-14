import { getDb, type Db } from '@/db';
import { fetchSiteContent } from '@/lib/scraper';
import { generateResearch, runTriageAI, generateAudit } from '@/lib/ai';
import { jobRuns, researchSnapshots } from '@/db/schema/research';
import { leads, activities } from '@/db/schema/core';
import { candidateLeads } from '@/db/schema/discovery';
import { AuditService } from '@/services/audits';
import { checkApifyRunStatus, fetchApifyResults } from '@/lib/discovery/apify';
import { eq } from 'drizzle-orm';

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
        return;
      }

      // 3. Fetch Site Content
      let siteContent = null;
      try {
        siteContent = await fetchSiteContent(lead.website);
      } catch (err: unknown) {
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
        return;
      }

      // 4. AI Triage Analysis
      const triageResult = await runTriageAI(db, siteContent.content.substring(0, 5000));
      const priority = triageResult.status === 'MODERN' ? 'SKIP' : 'MEDIUM';

      // 5. Save Triage Result
      await db.update(leads)
        .set({ triagePriority: priority, triageReason: triageResult.reason })
        .where(eq(leads.id, leadId));
        
      await db.insert(activities).values({
        id: crypto.randomUUID(),
        leadId,
        type: 'Triage complete',
        summary: `Scored ${priority} priority. Reason: ${triageResult.reason} (Simulation)`,
        timestamp: new Date(),
      });

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
      // 1. Wait/poll Apify
      let status = await checkApifyRunStatus(runId);
      const startTime = Date.now();
      const timeoutMs = 240_000; // 4 minutes

      while (status === 'RUNNING' || status === 'READY') {
        if (Date.now() - startTime > timeoutMs) {
          throw new Error('Apify actor run timed out during local simulation');
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
        status = await checkApifyRunStatus(runId);
      }

      if (status !== 'SUCCEEDED') {
        throw new Error(`Apify actor run ended with status: ${status}`);
      }

      // 2. Fetch Apify results
      const results = await fetchApifyResults(datasetId, niche, location);

      // 3. Save candidates & complete job
      const now = new Date();
      if (results.length > 0) {
        await db.insert(candidateLeads).values(
          results.map((r) => ({
            id: crypto.randomUUID(),
            discoveryScopeId: scopeId || null,
            rawName: r.name,
            rawWebsiteUrl: r.website,
            rawContactInfo: r.phone || null,
            rawLocation: [r.city, r.region].filter(Boolean).join(', ') || null,
            notes: r.industry ? `Industry: ${r.industry}` : null,
            status: 'NEW' as const,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }

      await db.update(jobRuns)
        .set({ status: 'COMPLETED', finishedAt: now })
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

      // Step 2: Fetch and scrape website
      let scraped = null;
      if (lead.website) {
        try {
          scraped = await fetchSiteContent(lead.website);
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(`[WorkflowClient Simulation] Website scraping failed for audit:`, error);
          scraped = {
            title: '',
            url: lead.website,
            content: `[Failed to scrape website: ${errMsg}]`,
            description: '',
          };
        }
      }

      // Step 3: LLM Inference
      const auditResult = await generateAudit(
        db,
        lead.name,
        lead.company || null,
        lead.website || null,
        lead.industry || null,
        scraped?.content || null
      );

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


