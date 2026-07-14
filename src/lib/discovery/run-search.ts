import { getLogger } from '../logger';
import { startGoogleMapsSearch } from './apify';
import { Db } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { triggerDiscoverySearchWorkflow } from '@/lib/workflow-client';

const log = getLogger('RunDiscoverySearch');

export interface RunSearchResult {
  jobId: string;
  runId: string;
}

/**
 * Start a Google Maps discovery search and create a jobRuns record.
 * Shared between the API route and server actions.
 */
export async function runSearchForScope(
  db: Db,
  params: {
    niche: string;
    location: string;
    limit: number;
    scopeId: string;
    userId: string;
  }
): Promise<RunSearchResult> {
  const { niche, location, limit, scopeId, userId } = params;

  const { runId, datasetId } = await startGoogleMapsSearch(niche, location, limit);

  const jobId = crypto.randomUUID();
  const now = new Date();

  await db.insert(jobRuns).values({
    id: jobId,
    jobType: 'DISCOVERY_SEARCH',
    status: 'QUEUED',
    triggeredByUserId: userId,
    externalRunId: runId,
    jobMeta: JSON.stringify({ datasetId, niche, location, scopeId }),
    startedAt: now,
    createdAt: now,
  });

  let workflowBinding: any = undefined;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    workflowBinding = getCloudflareContext().env?.DISCOVERY_SEARCH_WORKFLOW;
  } catch (e) {
    log.info('getCloudflareContext unavailable — falling back to process.env for workflow binding');
  }
  if (!workflowBinding) {
    workflowBinding = (process.env as any)?.DISCOVERY_SEARCH_WORKFLOW;
  }

  await triggerDiscoverySearchWorkflow(
    db,
    workflowBinding,
    jobId,
    runId,
    datasetId,
    niche,
    location,
    scopeId,
    userId
  );

  return { jobId, runId };
}
