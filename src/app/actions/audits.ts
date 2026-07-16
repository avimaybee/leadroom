'use server';

import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { decrypt, getUserId, verifyProspectAccess } from '@/lib/auth';
import { jobRuns } from '@/db/schema/research';
import { triggerResearchWorkflow, CloudflareWorkflow } from '@/lib/workflow-client';
import { getLogger } from '@/lib/logger';
import { ScoringService } from '@/services/scoring';
import { LeadService } from '@/services/lead';
import { AuditService } from '@/services/audits';
import { and, eq, or } from 'drizzle-orm';

const log = getLogger('AuditActions');

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

  if (!(await verifyProspectAccess(db, leadId, userId))) {
    return { error: 'Forbidden: you do not own this prospect' };
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
      log.info('Job already active for lead', { leadId, existingJobId: existingJob.id });
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

    await triggerResearchWorkflow(db, workflowBinding, leadId, jobId, userId);

    const leadService = new LeadService(db);
    await leadService.advanceStageIfEarlier(leadId, 'In Research');

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

  const leadId = String(formData.get('leadId') ?? '');
  const scoreValueStr = String(formData.get('scoreValue') ?? '');
  const rationale = String(formData.get('rationale') ?? '');

  if (!leadId) {
    return { error: 'Lead ID is required' };
  }

  if (!(await verifyProspectAccess(db, leadId, userId))) {
    return { error: 'Forbidden: you do not own this prospect' };
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
  const userId = await getUserId();
  if (!userId || !(await verifyProspectAccess(db, leadId, userId))) {
    return { audit: null, score: null, error: 'Forbidden' };
  }

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


