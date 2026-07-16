/**
 * POST /api/leads/[id]/research
 *
 * Starts an AI research job for a lead. Returns immediately with a jobId.
 * The frontend polls GET /api/jobs/[jobId] until status
 * becomes COMPLETED or FAILED.
 *
 * IDEMPOTENCY GUARD: If a QUEUED or RUNNING job already exists for this lead,
 * returns the existing jobId instead of spawning a duplicate simulation.
 */

import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { getUserId } from '@/lib/auth';
import { triggerResearchWorkflow } from '@/lib/workflow-client';
import { checkRateLimit } from '@/lib/rate-limit';
import { and, eq, or } from 'drizzle-orm';

const log = getLogger('ResearchStartAPI');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: leadId } = await params;
  const userId = await getUserId();

  if (userId) {
    const rateCheck = await checkRateLimit(`research:${userId}`, 5, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many research requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.reset - Date.now()) / 1000)) } },
      );
    }
  }

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
      log.info('Job already active for lead', { leadId, existingJobId: existingJob.id, status: existingJob.status });
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
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      workflowBinding = getCloudflareContext().env?.RESEARCH_SNAPSHOT_WORKFLOW;
    } catch (e) {
      log.info('getCloudflareContext unavailable — falling back to process.env for workflow binding');
    }
    if (!workflowBinding) {
      workflowBinding = process.env.RESEARCH_SNAPSHOT_WORKFLOW;
    }
    try {
      await Promise.race([
        triggerResearchWorkflow(db, workflowBinding, leadId, jobId, userId),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Workflow timed out after 10m')), 600_000)),
      ]);
    } catch (wfErr) {
      log.warn('Workflow trigger did not complete in time, returning 202 anyway', { leadId, jobId, error: String(wfErr) });
    }

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error: unknown) {
    log.error('Research start error', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

