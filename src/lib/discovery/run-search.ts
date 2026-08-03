import { getLogger } from '../logger';
import { startGoogleMapsSearch } from './apify';
import { type Db } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { triggerDiscoverySearchWorkflow } from '@/lib/workflow-client';
import { DiscoveryService } from '@/services/discovery';

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
    scopeId: string | null;
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
  } catch {
    log.info('getCloudflareContext unavailable — falling back to process.env for workflow binding');
  }
  if (!workflowBinding) {
    workflowBinding = process.env.DISCOVERY_SEARCH_WORKFLOW;
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

/**
 * Creates a discovery scope linked to a market and immediately starts a
 * Google Maps search for it. Used by the market wizard (automatic lead
 * generation) and the market "Discover Leads" modal.
 */
export async function runMarketDiscoverySearch(
  db: Db,
  params: {
    marketId: string;
    marketName: string;
    workspaceId: string;
    userId: string;
    niche: string;
    location: string;
    limit: number;
  }
): Promise<{ jobId: string; scopeId: string }> {
  const { marketId, marketName, workspaceId, userId, niche, location, limit } = params;

  const scopeId = crypto.randomUUID();
  const discoveryService = new DiscoveryService(db);
  await discoveryService.createScope(scopeId, {
    name: `${marketName} Discovery`,
    description: `Auto-discovery for market "${marketName}" searching "${niche}" in "${location}"`,
    industryFilter: niche,
    geographyFilter: location,
    autoResearchPromotedLeads: true,
    createdByUserId: userId,
    workspaceId,
    marketId,
  });

  const result = await runSearchForScope(db, {
    niche,
    location,
    limit,
    scopeId,
    userId,
  });

  log.info('Market discovery search started', { marketId, scopeId, jobId: result.jobId });
  return { jobId: result.jobId, scopeId };
}
