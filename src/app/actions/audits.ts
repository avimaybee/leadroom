'use server';

import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { jobRuns } from '@/db/schema/research';
import { triggerResearchWorkflow, CloudflareWorkflow } from '@/lib/workflow-client';
import { ScoringService } from '@/services/scoring';
import { LeadService } from '@/services/lead';
import { AuditService } from '@/services/audits';
import { and, eq, or } from 'drizzle-orm';

async function getUserId() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    const payload = await decrypt(sessionToken);
    return payload?.userId || null;
  } catch (e) {
    return null;
  }
}

export type ActionState = { error?: string | null, success?: boolean, jobId?: string | null } | null | undefined;

/**
 * Next.js Server Action to trigger a background website/brand audit.
 * IDEMPOTENCY GUARD: If a QUEUED or RUNNING audit job already exists for this lead,
 * returns the existing jobId without spawning a duplicate.
 */
export async function triggerAuditAction(leadId: string) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  try {
    // IDEMPOTENCY GUARD: Check for an already-active research job for this lead
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
      console.log(`[Audit Action] Job already active for lead ${leadId}: ${existingJob.id}. Returning existing jobId.`);
      return { error: null, success: true, jobId: existingJob.id };
    }

    const jobId = crypto.randomUUID();
    const now = new Date();

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

    const env = (process.env as unknown as Record<string, unknown>);
    const workflowBinding = env?.RESEARCH_SNAPSHOT_WORKFLOW as CloudflareWorkflow | undefined;

    await triggerResearchWorkflow(db, workflowBinding, leadId, jobId, userId);

    const leadService = new LeadService(db);
    await leadService.advanceStageIfEarlier(leadId, 'Auditing');

    revalidatePath(`/leads/${leadId}`);
    return { error: null, success: true, jobId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to trigger audit';
    return { error: msg, success: false, jobId: null };
  }
}

/**
 * Next.js Server Action to apply a manual override on the priority score of a lead.
 */
export async function manualOverrideScoreAction(prevState: ActionState, formData: FormData) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  const leadId = formData.get('leadId') as string;
  const scoreValueStr = formData.get('scoreValue') as string;
  const rationale = formData.get('rationale') as string;

  if (!leadId) {
    return { error: 'Lead ID is required' };
  }

  const scoreValue = parseInt(scoreValueStr, 10);
  if (isNaN(scoreValue) || scoreValue < 0 || scoreValue > 100) {
    return { error: 'Priority score must be a valid integer between 0 and 100' };
  }

  if (!rationale || rationale.trim().length === 0) {
    return { error: 'A justification is required to override the score' };
  }

  try {
    const scoringService = new ScoringService(db);
    await scoringService.manualOverride(leadId, scoreValue, rationale, userId);

    revalidatePath('/');
    revalidatePath(`/leads/${leadId}`);
    return { error: null, success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Override failed';
    return { error: msg, success: false };
  }
}

/**
 * Next.js Server Action to fetch the current active audit and score.
 */
export async function getAuditAndScoreDetails(leadId: string) {
  const db = getDb();
  const auditService = new AuditService(db);
  const scoringService = new ScoringService(db);

  try {
    const audit = await auditService.getLatestAudit(leadId);
    const score = await scoringService.getCurrentScore(leadId);
    return { audit, score, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch details';
    return { audit: null, score: null, error: msg };
  }
}


