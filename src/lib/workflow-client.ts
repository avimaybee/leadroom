import { getDb, type Db } from '@/db';
import { ResearchWorkflowService } from '@/services/research-workflow';
import { LoggingService } from '@/services/logging';
import { jobRuns, candidateLeads, activities } from '@/db/schema';
import { checkApifyRunStatus, fetchApifyResults } from '@/lib/discovery/apify';
import { eq, desc as drizzleDesc } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';

const logger = getLogger('WorkflowClient');

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
    logger.info('Triggering Cloudflare Workflow', { leadId, jobId });
    try {
      await workflowBinding.create({
        params: { leadId, jobId, userId: userId || null }
      });
      return;
    } catch (err: unknown) {
      logger.error('Failed to trigger Cloudflare Workflow binding. Falling back to simulation.', err, { leadId, jobId });
    }
  }

  // Simulation mode
  logger.info('Local simulation mode', { leadId, jobId });

  const runSimulation = async () => {
    const workflowService = new ResearchWorkflowService(db);
    try {
      // Step 1: Fetch Lead Info
      const lead = await workflowService.fetchLead(leadId);

      // Update job run status to RUNNING
      await db.update(jobRuns)
        .set({ status: 'RUNNING', startedAt: new Date() })
        .where(eq(jobRuns.id, jobId));

      // Step 2: Fetch and scrape website
      let scraped = null;
      try {
        scraped = await workflowService.scrapeWebsite(lead.website);
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error('Website scraping failed', error, { website: lead.website });
        scraped = {
          title: '',
          url: lead.website || '',
          content: `[Failed to scrape website: ${errMsg}]`,
          description: '',
        };
      }

      // Save any contacts extracted from the website scrape
      await workflowService.saveContacts(leadId, scraped, userId);

      // Step 3: LLM Inference & Persist Snapshot/Audit/Score/Activity
      await workflowService.generateSnapshots(lead, scraped, userId || null, jobId);

      // Step 4: Mark Job Complete
      await db.update(jobRuns)
        .set({
          status: 'COMPLETED',
          finishedAt: new Date(),
        })
        .where(eq(jobRuns.id, jobId));

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error occurred during simulation';
      logger.error('Research workflow failed during simulation', error, { leadId, jobId });

      // Update job run to FAILED in DB
      try {
        await db.update(jobRuns)
          .set({
            status: 'FAILED',
            errorSummary: errMsg,
            finishedAt: new Date(),
          })
          .where(eq(jobRuns.id, jobId));

        await new LoggingService(db).log({
          leadId,
          type: 'Enrichment failed',
          summary: `AI research generation failed: ${errMsg}`,
          metadata: {
            error: {
              message: errMsg,
              stack: error instanceof Error ? error.stack : undefined,
            }
          }
        });
      } catch (dbErr: unknown) {
        logger.error('Failed to write failure status to DB', dbErr);
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
    runSimulation().catch((err) => logger.error('Unhandled research simulation error', err));
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
    logger.info('Triggering Cloudflare Discovery Search Workflow', { jobId });
    try {
      await workflowBinding.create({
        params: { jobId, runId, datasetId, niche, location, scopeId: scopeId || null, userId }
      });
      return;
    } catch (err: unknown) {
      logger.error('Failed to trigger Cloudflare Discovery Search Workflow binding. Falling back to simulation.', err, { jobId });
    }
  }

  // Simulation mode
  logger.info('Local simulation mode for discovery search', { jobId });

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
      const apifyMaxRetries = 120; // 120 * 5s = 600s = 10 min

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

      // 3. Save all candidates immediately
      if (results.length > 0) {
        const candidates = results.map((r) => {
          return {
            id: crypto.randomUUID(),
            discoveryScopeId: scopeId || null,
            rawName: r.name || 'Unknown Business',
            rawWebsiteUrl: r.website || null,
            rawContactInfo: r.phone || null,
            rawLocation: [r.city, r.region].filter(Boolean).join(', ') || null,
            notes: r.industry ? `Industry: ${r.industry}` : null,
            status: 'NEW' as const,
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
      logger.error('Discovery search failed during simulation', error, { jobId });

      try {
        await db.update(jobRuns)
          .set({ status: 'FAILED', errorSummary: errMsg, finishedAt: new Date() })
          .where(eq(jobRuns.id, jobId));
      } catch (dbErr) {
        logger.error('Failed to write failure status to DB', dbErr);
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
    runSimulation().catch((err) => logger.error('Unhandled discovery search simulation error', err));
  }
}
