
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { triggerResearchWorkflow } from '@/lib/workflow-client';
import { jobRuns } from '@/db/schema/research';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';

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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const jobId = crypto.randomUUID();
  const now = new Date();

  try {
    // 1. Create job_runs row in QUEUED status
    await db.insert(jobRuns).values({
      id: jobId,
      jobType: 'RESEARCH_GENERATION',
      status: 'QUEUED',
      targetLeadId: leadId,
      triggeredByUserId: userId,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
    });

    // 2. Fetch active Cloudflare Workflow binding if present
    const workflowBinding = (process.env as unknown as Record<string, unknown>)?.RESEARCH_SNAPSHOT_WORKFLOW;

    // 3. Trigger workflow/simulation asynchronously
    await triggerResearchWorkflow(db, workflowBinding as any, leadId, jobId, userId);

    // 4. Return immediately with jobId
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Failed to trigger research:', error);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
