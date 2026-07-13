export const dynamic = 'force-dynamic';

import { getLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { eq } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

const log = getLogger('JobCancelAPI');

export async function POST(
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
    const [job] = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.id, jobId))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'QUEUED' && job.status !== 'RUNNING') {
      return NextResponse.json(
        { error: 'Only queued or running jobs can be cancelled' },
        { status: 400 }
      );
    }

    await db
      .update(jobRuns)
      .set({
        status: 'FAILED',
        errorSummary: 'Cancelled by user',
        finishedAt: new Date(),
      })
      .where(eq(jobRuns.id, jobId));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    log.error('Failed to cancel job', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
