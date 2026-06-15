export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { startGoogleMapsSearch } from '@/lib/discovery/apify';
import { getDb } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { getUserId } from '@/lib/auth';
import { triggerDiscoverySearchWorkflow } from '@/lib/workflow-client';
import { discoverySearchLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!discoverySearchLimiter.check(userId)) {
    return NextResponse.json({ error: 'Too many requests. Please wait before starting another search.' }, { status: 429 });
  }

  try {
    const { niche, location, limit, scopeId } = (await request.json()) as {
      niche?: string;
      location?: string;
      limit?: number;
      scopeId?: string;
    };

    if (!niche || !location) {
      return NextResponse.json({ error: 'Niche and location are required' }, { status: 400 });
    }
    if (typeof niche !== 'string' || niche.length > 500) {
      return NextResponse.json({ error: 'Niche must be at most 500 characters' }, { status: 400 });
    }
    if (typeof location !== 'string' || location.length > 500) {
      return NextResponse.json({ error: 'Location must be at most 500 characters' }, { status: 400 });
    }
    const leadLimit = Math.min(Math.max(limit || 20, 1), 200);

    // Start the Apify actor run — returns immediately without blocking
    const { runId, datasetId } = await startGoogleMapsSearch(niche, location, leadLimit);

    // Save a job_run record so the frontend can poll for progress
    const db = getDb();
    const jobId = crypto.randomUUID();
    const now = new Date();

    await db.insert(jobRuns).values({
      id: jobId,
      jobType: 'DISCOVERY_SEARCH',
      status: 'QUEUED',
      triggeredByUserId: userId,
      externalRunId: runId,
      jobMeta: JSON.stringify({ datasetId, niche, location, scopeId: scopeId || null }),
      startedAt: now,
      createdAt: now,
    });

    let workflowBinding: any = undefined;
    try {
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      workflowBinding = getCloudflareContext().env?.DISCOVERY_SEARCH_WORKFLOW;
    } catch (e) {}
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
      scopeId || null,
      userId
    );

    return NextResponse.json({ jobId, runId }, { status: 202 });
  } catch (error: unknown) {
    console.error('[Discovery Search API] Error:', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
