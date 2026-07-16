import { getLogger } from '../logger';
import { isPrivateHost } from '../network';

const log = getLogger('Apify');

export interface DiscoveryLead {
  name: string;
  website: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  sourceUrl: string | null;
  industry: string | null;
}

export interface ApifyRunRef {
  runId: string;
  datasetId: string;
}

let _apifyToken: string | undefined;

/**
 * Resolves the Apify API token from Cloudflare context (production) or process.env (local dev).
 */
function getApifyToken(env?: any): string {
  if (_apifyToken) return _apifyToken;
  let token: string | undefined;
  // 1. Use injected env if provided (production path)
  if (env?.APIFY_API_TOKEN) {
    token = env.APIFY_API_TOKEN;
  }
  // 2. Try Cloudflare context (legacy fallback)
  if (!token) {
    try {
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      const cf = getCloudflareContext();
      token = (cf?.env as any)?.APIFY_API_TOKEN;
    } catch (e) { log.warn('Failed to get Cloudflare context', { error: String(e) }); }
  }
  // 3. Fall back to process.env (local dev / tests)
  if (!token) {
    token = (process as any).env?.APIFY_API_TOKEN;
  }
  if (!token) {
    throw new Error('APIFY_API_TOKEN is not configured in environment variables');
  }
  _apifyToken = token;
  return token;
}

/**
 * Starts an Apify Google Maps actor run and returns immediately with the
 * runId and datasetId so the caller can poll status in subsequent requests.
 * This avoids holding a long-running Cloudflare Worker connection.
 */
export async function startGoogleMapsSearch(
  niche: string,
  location: string,
  limit: number = 30,
): Promise<ApifyRunRef> {
  const token = getApifyToken();

  const input = {
    searchStringsArray: [niche],
    locationQuery: location,
    maxCrawledPlacesPerSearch: limit,
    language: 'en',
    searchMatching: 'all',
    website: 'allPlaces',
    skipClosedPlaces: true,
    scrapePlaceDetailPage: false,
    scrapeTableReservationProvider: false,
    scrapeOrderOnline: false,
    includeWebResults: false,
    scrapeDirectories: false,
    maxQuestions: 0,
    scrapeContacts: false,
    scrapeSocialMediaProfiles: {
      facebooks: false,
      instagrams: false,
      youtubes: false,
      tiktoks: false,
      twitters: false,
    },
    maximumLeadsEnrichmentRecords: 0,
    verifyLeadsEnrichmentEmails: false,
    maxReviews: 0,
    maxImages: 0,
    scrapeImageAuthors: false,
  };

  log.info('Starting actor', { niche, location, limit });

  const actorUrl = 'https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/runs';
  if (isPrivateHost(actorUrl)) throw new Error('Blocked request to private IP');
  const runRes = await fetch(actorUrl,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify(input),
    },
  );

  if (!runRes.ok) {
    throw new Error(`Apify actor start failed (HTTP ${runRes.status})`);
  }

  const runData = (await runRes.json()) as {
    data?: { id: string; defaultDatasetId: string; status: string };
  };

  if (!runData.data) {
    throw new Error('Apify API returned an invalid run response');
  }

  return {
    runId: runData.data.id,
    datasetId: runData.data.defaultDatasetId,
  };
}

export type ApifyRunStatus = 'RUNNING' | 'READY' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT';

/**
 * Checks the current status of an Apify run without blocking.
 */
export async function checkApifyRunStatus(runId: string): Promise<ApifyRunStatus> {
  const token = getApifyToken();

  const statusUrl = `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/runs/${runId}`;
  if (isPrivateHost(statusUrl)) throw new Error('Blocked request to private IP');
  const res = await fetch(statusUrl,
    {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) {
    throw new Error(`Apify status check failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { data?: { status: string } };
  return (data.data?.status || 'FAILED') as ApifyRunStatus;
}

/**
 * Fetches completed dataset items from Apify and maps them to DiscoveryLead records.
 */
export async function fetchApifyResults(
  datasetId: string,
  niche: string,
  location: string,
): Promise<DiscoveryLead[]> {
  const token = getApifyToken();

  log.info('Fetching dataset items', { datasetId });
  const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items`;

  const BATCH_SIZE = 100;
  const allItems: ApifyItem[] = [];
  let offset = 0;

  interface ApifyItem {
    title?: string;
    name?: string;
    website?: string;
    phone?: string;
    phoneUnformatted?: string;
    city?: string;
    state?: string;
    url?: string;
    categoryName?: string;
  }

  while (true) {
    const paginatedUrl = `${datasetUrl}?offset=${offset}&limit=${BATCH_SIZE}`;
    if (isPrivateHost(paginatedUrl)) throw new Error('Blocked request to private IP');
    const itemsRes = await fetch(paginatedUrl,
      {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!itemsRes.ok) {
      throw new Error(`Apify dataset fetch failed (HTTP ${itemsRes.status})`);
    }

    const batch = (await itemsRes.json()) as ApifyItem[];
    if (!Array.isArray(batch) || batch.length === 0) break;

    allItems.push(...batch);
    offset += batch.length;

    if (batch.length < BATCH_SIZE) break;
  }

  if (allItems.length > 100) {
    log.warn('Large dataset fetched from Apify', { datasetId, count: allItems.length });
  }

  return allItems.map((item: ApifyItem) => ({
    name: item.title || item.name || 'Unknown Business',
    website: item.website || null,
    phone: item.phone || item.phoneUnformatted || null,
    city: item.city || location.split(',')[0].trim() || null,
    region: item.state || null,
    sourceUrl: item.url || null,
    industry: item.categoryName || niche,
  }));
}

/**
 * @deprecated Use startGoogleMapsSearch + checkApifyRunStatus + fetchApifyResults
 * for production. This blocking version is only safe for local Node.js dev/tests.
 */
export async function searchGoogleMaps(
  niche: string,
  location: string,
  limit: number = 30,
): Promise<DiscoveryLead[]> {
  const { runId, datasetId } = await startGoogleMapsSearch(niche, location, limit);

  const startTime = Date.now();
  const timeoutMs = 240_000;

  // NOTE: Free-tier Apify accounts may hit rate limits or timeouts during long polls.
  // The 240s timeout is generous; consider reducing for faster user feedback.
  let status = await checkApifyRunStatus(runId);
  while (status === 'RUNNING' || status === 'READY') {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Apify actor run timed out');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    status = await checkApifyRunStatus(runId);
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify actor run failed with status: ${status}`);
  }

  return fetchApifyResults(datasetId, niche, location);
}
