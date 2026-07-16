import { getLogger } from '../lib/logger';
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { getDb } from '../db';
import { checkApifyRunStatus, fetchApifyResults } from '../lib/discovery/apify';
import { candidateLeads } from '../db/schema/discovery';
import { jobRuns } from '../db/schema/research';
import { notifications } from '../db/schema/core';
import { eq } from 'drizzle-orm';

const log = getLogger('DiscoverySearchWorkflow');

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

type DiscoveryParams = {
  jobId: string;
  runId: string;
  datasetId: string;
  niche: string;
  location: string;
  scopeId: string | null;
  userId: string;
};

type Env = {
  DB: D1Database;
  BROWSER?: unknown;
};

export class DiscoverySearchWorkflow extends WorkflowEntrypoint<Env, DiscoveryParams> {
  async run(event: WorkflowEvent<DiscoveryParams>, step: WorkflowStep) {
    const { jobId, runId, datasetId, niche, location, scopeId, userId } = event.payload;

    const db = getDb(this.env);

    try {
      // Mark RUNNING immediately so the UI shows progress
      await step.do('set-job-running', { timeout: '10 seconds', retries: { limit: 2, delay: 500 } }, async () => {
        await db.update(jobRuns)
          .set({ status: 'RUNNING', currentStage: 'Starting Apify crawler...' })
          .where(eq(jobRuns.id, jobId));
      });

      // Step 1: Wait for Apify Google Maps run to succeed (single step, retries internally)
      const status = await step.do(
        'poll-apify-complete',
        {
          retries: { limit: 10, delay: 60000, backoff: 'constant' },
          timeout: '30 seconds',
        },
        async () => {
          const s = await checkApifyRunStatus(runId);
          if (s === 'SUCCEEDED') return s;
          if (s === 'FAILED') throw new Error(`Apify actor run failed with status: ${s}`);

          const [j] = await db.select().from(jobRuns).where(eq(jobRuns.id, jobId)).limit(1);
          if (j && (j.status === 'FAILED' || j.status === 'CANCELLED')) {
            throw new Error('Cancelled by user');
          }
          throw new Error('STILL_RUNNING');
        },
      );

      if (status !== 'SUCCEEDED') {
        throw new Error(`Apify actor run failed with status: ${status}`);
      }

      await step.do('update-status-apify-done', { timeout: '10 seconds' }, async () => {
        await db.update(jobRuns)
          .set({ currentStage: 'Apify finished. Fetching results...' })
          .where(eq(jobRuns.id, jobId));
      });

      // Step 2: Fetch Apify results
      const results = await step.do(
        'fetch-results',
        {
          retries: { limit: 5, delay: 3000, backoff: 'exponential' },
          timeout: '3 minutes',
        },
        async () => {
          const results = await fetchApifyResults(datasetId, niche, location);
          if (results.length > 500) {
            log.warn(`Truncating fetch-results from ${results.length} to 500 to limit step output`);
            results.length = 500;
          }
          return results;
        },
      );

      // Step 3: Save all candidates immediately
      await step.do(
        'save-candidates-raw',
        {
          retries: { limit: 3, delay: 1000, backoff: 'linear' },
          timeout: '1 minute',
        },
          async () => {
            const now = new Date();
            if (results.length > 0) {
              // Dedup: skip candidates already saved for this scope
              const existing = scopeId ? await db
                .select({ rawWebsiteUrl: candidateLeads.rawWebsiteUrl, rawName: candidateLeads.rawName })
                .from(candidateLeads)
                .where(eq(candidateLeads.discoveryScopeId, scopeId))
                .limit(5000) : [];
              const existingSet = new Set(existing.map(e => `${e.rawWebsiteUrl ?? ''}|${e.rawName}`));

              const candidates = results
                .filter((r) => !existingSet.has(`${r.website ?? ''}|${r.name ?? 'Unknown Business'}`))
                .map((r) => ({
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
                }));

              for (const batch of chunkArray(candidates, 10)) {
                await db.insert(candidateLeads).values(batch);
              }
            }

          await db.update(jobRuns)
            .set({
              status: 'COMPLETED',
              totalItems: results.length,
              itemsProcessed: results.length,
              currentStage: 'Complete',
              startedAt: now,
              finishedAt: now,
            })
            .where(eq(jobRuns.id, jobId));

          if (userId) {
            await db.insert(notifications).values({
              id: crypto.randomUUID(),
              userId,
              jobRunId: jobId,
              title: 'Discovery Completed',
              message: `Found ${results.length} leads for ${niche} in ${location}.`,
              status: 'SUCCESS',
              link: scopeId ? `/scopes/${scopeId}` : `/scopes`,
              isRead: false,
              createdAt: now,
            });
          }
        },
      );

      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error during discovery search';
        log.error('DiscoverySearchWorkflow failed', error, { jobId });

        const isCancellation = errMsg === 'Cancelled by user';
        try {
          await db.update(jobRuns)
            .set({
              status: isCancellation ? 'CANCELLED' : 'FAILED',
              errorSummary: errMsg,
              finishedAt: new Date(),
            })
            .where(eq(jobRuns.id, jobId));

        const { userId, scopeId } = event.payload;
        if (userId) {
          await db.insert(notifications).values({
            id: crypto.randomUUID(),
            userId,
            jobRunId: jobId,
            title: isCancellation ? 'Discovery Cancelled' : 'Discovery Failed',
            message: isCancellation ? `Discovery search was cancelled.` : `Discovery search failed: ${errMsg}`,
            status: isCancellation ? 'WARNING' : 'ERROR',
            link: scopeId ? `/scopes/${scopeId}` : `/scopes`,
            isRead: false,
            createdAt: new Date(),
          });
        }
      } catch (dbErr) {
        log.error('Failed to write job failure status to DB', dbErr);
      }

      throw error;
    }
  }
}
