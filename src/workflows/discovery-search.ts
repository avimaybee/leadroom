import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { getDb } from '../db';
import { checkApifyRunStatus, fetchApifyResults } from '../lib/discovery/apify';
import { candidateLeads } from '../db/schema/discovery';
import { jobRuns } from '../db/schema/research';
import { eq } from 'drizzle-orm';
import { heuristicTriage } from '../lib/triage/heuristics';
import { enrichCandidate } from '../lib/triage/enricher';

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
    const { jobId, runId, datasetId, niche, location, scopeId } = event.payload;

    (process as any).env = {
      ...(process as any).env,
      ...this.env,
    };

    const db = getDb();
    const browserBinding = this.env.BROWSER;

    try {
      // Mark RUNNING immediately so the UI shows progress
      await step.do('set-job-running', { timeout: '10 seconds', retries: { limit: 2, delay: 500 } }, async () => {
        await db.update(jobRuns)
          .set({ status: 'RUNNING', currentStage: 'Starting Apify crawler...' })
          .where(eq(jobRuns.id, jobId));
      });

      // Step 1: Wait for Apify Google Maps run to succeed
      let status = await step.do(
        'check-apify-status',
        {
          retries: { limit: 3, delay: 2000, backoff: 'exponential' },
          timeout: '1 minute',
        },
        async () => await checkApifyRunStatus(runId),
      );

      let retries = 0;
      const maxRetries = 200; // 200 * 15s = 50 min max
      while (status === 'RUNNING' || status === 'READY') {
        if (retries >= maxRetries) {
          throw new Error('Apify actor run timed out after 50 minutes of polling');
        }
        await step.sleep(`wait-for-apify-retry-${retries}`, '15 seconds');

        const isCancelled = await step.do(
          `check-job-cancelled-${retries}`,
          { timeout: '10 seconds' },
          async () => {
            const [j] = await db.select().from(jobRuns).where(eq(jobRuns.id, jobId)).limit(1);
            return !!(j && (j.status === 'FAILED' || j.errorSummary === 'Cancelled by user'));
          }
        );
        if (isCancelled) {
          throw new Error('Cancelled by user');
        }

        status = await step.do(
          `check-apify-status-retry-${retries}`,
          {
            retries: { limit: 3, delay: 2000, backoff: 'exponential' },
            timeout: '1 minute',
          },
          async () => await checkApifyRunStatus(runId),
        );
        retries++;
      }

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
        async () => await fetchApifyResults(datasetId, niche, location),
      );

      // Step 3: Save all candidates immediately with heuristic triage (zero cost)
      await step.do(
        'save-candidates-raw',
        {
          retries: { limit: 3, delay: 1000, backoff: 'linear' },
          timeout: '1 minute',
        },
        async () => {
          const now = new Date();
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
              startedAt: now,
            })
            .where(eq(jobRuns.id, jobId));
        },
      );

      // Step 4: Enrich candidates (three-level, only for UNASSESSED)
      if (results.length > 0) {
        await step.do(
          'enrich-candidates',
          {
            retries: { limit: 3, delay: 2000, backoff: 'exponential' },
            timeout: '15 minutes',
          },
          async () => {
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
                    return await enrichCandidate(r.website, db, browserBinding);
                  } catch {
                    return null;
                  }
                }),
              );

              for (let j = 0; j < batch.length; j++) {
                const r = batch[j];
                const batchResult = batchResults[j];
                if (batchResult.status !== 'fulfilled' || !batchResult.value) continue;

                const { triagePriority, triageReason } = batchResult.value;
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

            await db.update(jobRuns)
              .set({
                status: 'COMPLETED',
                itemsProcessed: results.length,
                currentStage: 'Complete',
                finishedAt: new Date(),
              })
              .where(eq(jobRuns.id, jobId));
          },
        );
      } else {
        await step.do(
          'mark-complete',
          { retries: { limit: 2, delay: 500 }, timeout: '30 seconds' },
          async () => {
            await db.update(jobRuns)
              .set({
                status: 'COMPLETED',
                itemsProcessed: 0,
                currentStage: 'Complete — no candidates found',
                finishedAt: new Date(),
              })
              .where(eq(jobRuns.id, jobId));
          },
        );
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error during discovery search';
      console.error(`DiscoverySearchWorkflow failed for job ${jobId}:`, error);

      try {
        await db.update(jobRuns)
          .set({
            status: 'FAILED',
            errorSummary: errMsg,
            finishedAt: new Date(),
          })
          .where(eq(jobRuns.id, jobId));
      } catch (dbErr) {
        console.error('Failed to write job failure status to DB:', dbErr);
      }

      throw error;
    }
  }
}
