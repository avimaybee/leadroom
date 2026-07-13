'use server';

import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { getUserId, verifyProspectAccess } from '@/lib/auth';
import { OutreachService } from '@/services/outreach';
import { LearningService } from '@/services/learning';
import { getLogger } from '@/lib/logger';
import { outcomes } from '@/db/schema/outreach';
import { prospects } from '@/db/schema/core';
import { eq } from 'drizzle-orm';
import { withLogging } from '@/lib/actions/with-logging';

const log = getLogger('OutcomesActions');

async function approveDraftActionImpl(draftId: string) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  try {
    const outreachService = new OutreachService(db);
    const draft = await outreachService.getDraftById(draftId);
    if (!draft) {
      return { error: 'Draft not found' };
    }

    if (!(await verifyProspectAccess(db, draft.leadId, userId))) {
      return { error: 'Forbidden: you do not own this prospect' };
    }

    await outreachService.recordApproval(draftId, userId, 'APPROVED');

    // Trigger learning loop
    const [prospect] = await db
      .select({ workspaceId: prospects.workspaceId })
      .from(prospects)
      .where(eq(prospects.id, draft.leadId))
      .limit(1);

    if (prospect?.workspaceId) {
      const learningService = new LearningService(db);
      learningService.triggerLearningLoop(prospect.workspaceId).catch((err) => {
        log.error('Learning loop failed', err);
      });
    }

    try {
      revalidatePath(`/leads/${draft.leadId}`);
      revalidatePath('/');
      revalidatePath('/approvals');
      revalidatePath(`/prospects/${draft.leadId}`);
    } catch (e: any) {
      log.error('revalidatePath failed', e?.message || e);
    }

    const refreshedDrafts = await outreachService.getDraftsForLead(draft.leadId);
    const mapped = refreshedDrafts.map((d) => ({
      id: d.id,
      subject: d.subject ?? null,
      body: d.body,
      status: d.status,
      citedEvidence: (d as any).citedEvidence ?? null,
      riskFlags: (d as any).riskFlags ?? null,
      rejectionReason: (d as any).rejectionReason ?? null,
    }));

    return { success: true, drafts: mapped };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to approve draft';
    return { error: msg };
  }
}

export const approveDraftAction = withLogging('approveDraftAction', approveDraftActionImpl);

async function rejectDraftActionImpl(draftId: string, reason: string) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  try {
    const outreachService = new OutreachService(db);
    const draft = await outreachService.getDraftById(draftId);
    if (!draft) {
      return { error: 'Draft not found' };
    }

    if (!(await verifyProspectAccess(db, draft.leadId, userId))) {
      return { error: 'Forbidden: you do not own this prospect' };
    }

    await outreachService.recordApproval(draftId, userId, 'REJECTED', reason);

    // Trigger learning loop
    const [prospect] = await db
      .select({ workspaceId: prospects.workspaceId })
      .from(prospects)
      .where(eq(prospects.id, draft.leadId))
      .limit(1);

    if (prospect?.workspaceId) {
      const learningService = new LearningService(db);
      learningService.triggerLearningLoop(prospect.workspaceId).catch((err) => {
        log.error('Learning loop failed', err);
      });
    }

    try {
      revalidatePath(`/leads/${draft.leadId}`);
      revalidatePath('/');
      revalidatePath('/approvals');
      revalidatePath(`/prospects/${draft.leadId}`);
    } catch (e: any) {
      log.error('revalidatePath failed', e?.message || e);
    }

    const refreshedDrafts = await outreachService.getDraftsForLead(draft.leadId);
    const mapped = refreshedDrafts.map((d) => ({
      id: d.id,
      subject: d.subject ?? null,
      body: d.body,
      status: d.status,
      citedEvidence: (d as any).citedEvidence ?? null,
      riskFlags: (d as any).riskFlags ?? null,
      rejectionReason: (d as any).rejectionReason ?? null,
    }));

    return { success: true, drafts: mapped };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to reject draft';
    return { error: msg };
  }
}

export const rejectDraftAction = withLogging('rejectDraftAction', rejectDraftActionImpl);

async function logOutcomeActionImpl(data: {
  prospectId: string;
  draftId: string | null;
  outcomeType: string;
  notes: string;
}) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  if (!(await verifyProspectAccess(db, data.prospectId, userId))) {
    return { error: 'Forbidden: you do not own this prospect' };
  }

  try {
    const id = crypto.randomUUID();
    await db.insert(outcomes).values({
      id,
      prospectId: data.prospectId,
      outreachDraftId: data.draftId ?? null,
      outcomeType: data.outcomeType as any,
      notes: data.notes || null,
      loggedByUserId: userId,
      createdAt: new Date(),
    });

    const [prospect] = await db
      .select({ workspaceId: prospects.workspaceId })
      .from(prospects)
      .where(eq(prospects.id, data.prospectId))
      .limit(1);

    if (prospect?.workspaceId) {
      const learningService = new LearningService(db);
      learningService.triggerLearningLoop(prospect.workspaceId).catch((err) => {
        log.error('Learning loop failed', err);
      });
    }

    try {
      revalidatePath(`/leads/${data.prospectId}`);
      revalidatePath('/');
    } catch (e: any) {
      log.error('revalidatePath failed', e?.message || e);
    }

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to log outcome';
    return { error: msg };
  }
}

export const logOutcomeAction = withLogging('logOutcomeAction', logOutcomeActionImpl);
