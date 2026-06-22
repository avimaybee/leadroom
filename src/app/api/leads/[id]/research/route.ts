export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/[id]/research
 *
 * Starts an AI research job for a lead. Returns immediately with a jobId.
 * The frontend polls GET /api/jobs/[jobId] every ~5 seconds until status
 * becomes COMPLETED or FAILED.
 *
 * IDEMPOTENCY GUARD: If a QUEUED or RUNNING job already exists for this lead,
 * returns the existing jobId instead of spawning a duplicate simulation.
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { cookies } from 'next/headers';
import { decrypt, getUserId } from '@/lib/auth';
import { triggerResearchWorkflow } from '@/lib/workflow-client';
import { and, eq, or } from 'drizzle-orm';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: leadId } = await params;
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  try {
    // IDEMPOTENCY GUARD: Check for an already-active research job for this lead.
    // If one is QUEUED or RUNNING, return the existing jobId — do NOT spawn a duplicate.
    const [existingJob] = await db
      .select({ id: jobRuns.id, status: jobRuns.status })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.targetLeadId, leadId),
          eq(jobRuns.jobType, 'RESEARCH_GENERATION'),
          or(
            eq(jobRuns.status, 'QUEUED'),
            eq(jobRuns.status, 'RUNNING')
          )
        )
      )
      .limit(1);

    if (existingJob) {
      console.log(`[Research API] Job already active for lead ${leadId}: ${existingJob.id} (${existingJob.status}). Returning existing jobId.`);
      return NextResponse.json({ jobId: existingJob.id }, { status: 202 });
    }

    const jobId = crypto.randomUUID();
    const now = new Date();

    // Create job in QUEUED status
    await db.insert(jobRuns).values({
      id: jobId,
      jobType: 'RESEARCH_GENERATION',
      status: 'QUEUED',
      targetLeadId: leadId,
      triggeredByUserId: userId,
      externalRunId: 'DIRECT',
      startedAt: null,
      finishedAt: null,
      createdAt: now,
    });

    let workflowBinding: any = undefined;
    try {
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      workflowBinding = getCloudflareContext().env?.RESEARCH_SNAPSHOT_WORKFLOW;
    } catch (e) {}
    if (!workflowBinding) {
      workflowBinding = (process.env as any)?.RESEARCH_SNAPSHOT_WORKFLOW;
    }
    await triggerResearchWorkflow(db, workflowBinding, leadId, jobId, userId);

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error: unknown) {
    console.error('Research start error:', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

