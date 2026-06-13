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
import { decrypt } from '@/lib/auth';
import { triggerResearchWorkflow } from '@/lib/workflow-client';
import { and, eq, or } from 'drizzle-orm';

async function getUserId() {
  if (process.env.NODE_ENV === 'test') {
    return 'user_123';
  }
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    const payload = await decrypt(sessionToken);
    return payload?.userId || null;
  } catch (e) {
    return null;
  }
}

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

    const workflowBinding = (process.env as unknown as Record<string, unknown>)?.RESEARCH_SNAPSHOT_WORKFLOW as any;
    await triggerResearchWorkflow(db, workflowBinding, leadId, jobId, userId);

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Failed to trigger research:', error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

