export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { decrypt, getUserId } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  try {
    const [job] = await db.select().from(jobRuns).where(eq(jobRuns.id, jobId)).limit(1);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.triggeredByUserId && job.triggeredByUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      targetLeadId: job.targetLeadId,
      errorSummary: job.errorSummary,
      totalItems: job.totalItems,
      itemsProcessed: job.itemsProcessed,
      currentStage: job.currentStage,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
    });
  } catch (error: unknown) {
    console.error('Failed to fetch job status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
