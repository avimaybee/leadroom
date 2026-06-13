export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { triggerAuditWorkflow, CloudflareWorkflow } from '@/lib/workflow-client';

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
  const jobId = crypto.randomUUID();
  const now = new Date();

  try {
    // Create job in QUEUED status
    await db.insert(jobRuns).values({
      id: jobId,
      jobType: 'AUDIT_GENERATION',
      status: 'QUEUED',
      targetLeadId: leadId,
      triggeredByUserId: userId,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
    });

    const env = (process.env as unknown as Record<string, unknown>);
    const workflowBinding = env?.AUDIT_SNAPSHOT_WORKFLOW as CloudflareWorkflow | undefined;
    
    await triggerAuditWorkflow(db, workflowBinding, leadId, jobId, userId);

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Failed to trigger audit:', error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
