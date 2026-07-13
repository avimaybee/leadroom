'use server';

import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { decrypt, getUserId, verifyProspectAccess } from '@/lib/auth';
import { OutreachService } from '@/services/outreach';
import { LeadService } from '@/services/lead';
import { ResearchService } from '@/services/research';
import { AuditService } from '@/services/audits';
import { generateOutreachDraft, getModelInfo, type FailoverEvent } from '@/lib/ai';
import { prospects } from '@/db/schema/core';
import { markets } from '@/db/schema/strategy';
import { outreachDrafts } from '@/db/schema/outreach';
import { eq, sql, and } from 'drizzle-orm';
import { withLogging } from '@/lib/actions/with-logging';

// Module-level cache for model info (5-min TTL)
let cachedModelInfo: { provider: string; modelName: string; hasVision: boolean } | null = null;
let cachedModelInfoTime = 0;
const MODEL_INFO_CACHE_TTL = 5 * 60 * 1000;

export async function getModelInfoAction() {
  const now = Date.now();
  if (cachedModelInfo && (now - cachedModelInfoTime) < MODEL_INFO_CACHE_TTL) {
    return { success: true, info: cachedModelInfo };
  }

  const db = getDb();
  try {
    const info = await getModelInfo(db);
    cachedModelInfo = info;
    cachedModelInfoTime = now;
    return { success: true, info };
  } catch (e: any) {
    return { error: e.message || 'Failed to fetch model info' };
  }
}

async function generateOutreachDraftActionImpl(
  leadId: string,
  channel: 'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING',
  customPrompt?: string,
  attachments?: Array<{ name: string; type: string; base64: string }>
) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  if (!(await verifyProspectAccess(db, leadId, userId))) {
    return { error: 'Forbidden: you do not own this prospect' };
  }

  try {
    const leadService = new LeadService(db);
    const researchService = new ResearchService(db);
    const auditService = new AuditService(db);
    const outreachService = new OutreachService(db);

    const [lead, contactsList, researchSnapshot, auditSnapshot] = await Promise.all([
      leadService.getLead(leadId),
      researchService.getContacts(leadId),
      researchService.getLatestResearch(leadId),
      auditService.getLatestAudit(leadId),
    ]);

    if (!lead) {
      return { error: 'Lead not found' };
    }

    const failoverHistory: FailoverEvent[] = [];
    const draftContent = await generateOutreachDraft(
      db,
      lead.name,
      lead.company || null,
      lead.website || null,
      lead.industry || null,
      lead.city || null,
      lead.region || null,
      channel,
      contactsList,
      researchSnapshot,
      auditSnapshot,
      customPrompt,
      attachments,
      (event) => failoverHistory.push(event)
    );

    const newDrafts = [];
    for (const draft of draftContent.drafts) {
      const bodyWithTone = draft.variationTone ? `[Tone: ${draft.variationTone}]\n\n${draft.body}` : draft.body;
      const newDraft = await outreachService.createDraft({
        leadId: lead.id,
        channel,
        subject: draft.subject || null,
        body: bodyWithTone,
        createdByUserId: userId,
        attachments: attachments && attachments.length > 0 ? JSON.stringify(attachments) : null,
        origin: 'AI_GENERATED',
        citedEvidence: draft.citedEvidence ? JSON.stringify(draft.citedEvidence) : null,
        riskFlags: draft.riskFlags ? JSON.stringify(draft.riskFlags) : null,
      });
      newDrafts.push(newDraft);
    }

    // Advance pipeline
    await leadService.advanceStageIfEarlier(leadId, 'Outreach Drafted');

    try {
      revalidatePath(`/leads/${lead.id}`);
      revalidatePath('/');
    } catch (e) {}

    const result: any = { success: true, drafts: newDrafts };
    if (failoverHistory.length > 0) {
      result.failoverWarning = `Model "${failoverHistory[0].provider}" failed. Automatically switched to next configured model. Error: ${failoverHistory[0].error}`;
    }
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to generate outreach draft';
    return { error: msg };
  }
}

export const generateOutreachDraftAction = withLogging('generateOutreachDraftAction', generateOutreachDraftActionImpl);

async function duplicateDraftActionImpl(draftId: string) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  try {
    const outreachService = new OutreachService(db);
    const oldDraft = await outreachService.getDraftById(draftId);
    if (!oldDraft) {
      return { error: 'Draft not found' };
    }

    if (!(await verifyProspectAccess(db, oldDraft.leadId, userId))) {
      return { error: 'Forbidden: you do not own this prospect' };
    }

    const duplicatedDraft = await outreachService.createDraft({
      leadId: oldDraft.leadId,
      channel: oldDraft.channel,
      subject: oldDraft.subject,
      body: oldDraft.body,
      createdByUserId: userId,
      attachments: oldDraft.attachments,
      origin: 'MANUAL',
    });

    try {
      revalidatePath(`/leads/${oldDraft.leadId}`);
      revalidatePath('/');
    } catch (e) {}

    return { success: true, draft: duplicatedDraft };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to duplicate draft';
    return { error: msg };
  }
}

export const duplicateDraftAction = withLogging('duplicateDraftAction', duplicateDraftActionImpl);

async function updateDraftActionImpl(draftId: string, subject: string | null, body: string) {
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

    await outreachService.updateDraftContent(draftId, subject, body);

    try {
      revalidatePath(`/leads/${draft.leadId}`);
      revalidatePath('/');
      revalidatePath('/');
    } catch (e) {}
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update draft';
    return { error: msg };
  }
}

export const updateDraftAction = withLogging('updateDraftAction', updateDraftActionImpl);

async function recordApprovalActionImpl(draftId: string, decision: 'APPROVED' | 'REJECTED', feedback?: string) {
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

    await outreachService.recordApproval(draftId, userId, decision, feedback);

    if (decision === 'APPROVED') {
      const leadService = new LeadService(db);
      await leadService.advanceStageIfEarlier(draft.leadId, 'Awaiting Approval');
    }

    try {
      revalidatePath(`/leads/${draft.leadId}`);
      revalidatePath('/');
    } catch (e) {}
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to record approval';
    return { error: msg };
  }
}

export const recordApprovalAction = withLogging('recordApprovalAction', recordApprovalActionImpl);

async function deleteDraftActionImpl(draftId: string) {
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

    const deleted = await outreachService.deleteDraft(draftId);

    if (!deleted) {
      return { error: 'Draft not found' };
    }

    try {
      revalidatePath('/leads');
      revalidatePath('/');
    } catch (e) {}

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete draft';
    return { error: msg };
  }
}

export const deleteDraftAction = withLogging('deleteDraftAction', deleteDraftActionImpl);

export async function getPendingApprovalsAction() {
  const db = getDb();
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  try {
    const rows = await db
      .select({
        draft: outreachDrafts,
        prospectName: prospects.name,
        prospectCompany: prospects.company,
        fitScore: prospects.fitScore,
        priorityTier: prospects.priorityTier,
        marketName: markets.name,
      })
      .from(outreachDrafts)
      .innerJoin(prospects, eq(outreachDrafts.leadId, prospects.id))
      .leftJoin(markets, eq(prospects.marketId, markets.id))
      .where(and(eq(outreachDrafts.status, 'DRAFT'), eq(prospects.ownerId, userId)))
      .orderBy(sql`COALESCE(${prospects.fitScore}, 0) DESC`, outreachDrafts.createdAt)
      .limit(50);

    return {
      success: true,
      drafts: rows.map(r => ({
        id: r.draft.id,
        leadId: r.draft.leadId,
        channel: r.draft.channel,
        subject: r.draft.subject,
        body: r.draft.body,
        status: r.draft.status,
        citedEvidence: r.draft.citedEvidence,
        riskFlags: r.draft.riskFlags,
        prospectName: r.prospectName,
        prospectCompany: r.prospectCompany,
        fitScore: r.fitScore,
        priorityTier: r.priorityTier,
        marketName: r.marketName,
        createdAt: r.draft.createdAt,
      })),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch approvals';
    return { error: msg };
  }
}

async function markAsSentActionImpl(draftId: string) {
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

    if (draft.status !== 'APPROVED') {
      return { error: 'Only APPROVED drafts can be marked as sent.' };
    }

    await outreachService.updateDraftStatus(draftId, 'SENT');

    const leadService = new LeadService(db);
    const lead = await leadService.getLead(draft.leadId);
    if (lead) {
      const newStage = (draft.channel === 'EMAIL' || draft.channel === 'LINKEDIN')
        ? 'Contacted'
        : 'Meeting Booked';
      await leadService.advanceStageIfEarlier(lead.id, newStage);
    }

    try {
      revalidatePath(`/leads/${draft.leadId}`);
      revalidatePath('/');
      revalidatePath('/approvals');
      revalidatePath(`/prospects/${draft.leadId}`);
    } catch (e) {}
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to mark as sent';
    return { error: msg };
  }
}

export const markAsSentAction = withLogging('markAsSentAction', markAsSentActionImpl);
