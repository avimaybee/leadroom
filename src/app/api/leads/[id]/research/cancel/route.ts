export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { LoggingService } from '@/services/logging';
import { cookies } from 'next/headers';
import { decrypt, getUserId } from '@/lib/auth';
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
    const [activeJob] = await db
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

    if (!activeJob) {
      return NextResponse.json({ success: true, reason: 'nothing_to_cancel' });
    }

    await db.update(jobRuns)
      .set({
        status: 'CANCELLED',
        errorSummary: 'Cancelled by user',
        finishedAt: new Date(),
      })
      .where(eq(jobRuns.id, activeJob.id));

    await new LoggingService(db).log({
      leadId,
      type: 'Research cancelled',
      summary: 'Research workflow cancelled by operator',
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Research cancel error:', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
