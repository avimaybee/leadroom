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

export async function generateOutreachDraftAction(
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
    await leadService.advanceStageIfEarlier(leadId, 'Drafting');

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

export async function duplicateDraftAction(draftId: string) {
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

export async function updateDraftAction(draftId: string, subject: string | null, body: string) {
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

export async function recordApprovalAction(draftId: string, decision: 'APPROVED' | 'REJECTED', feedback?: string) {
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
      await leadService.advanceStageIfEarlier(draft.leadId, 'Ready to Send');
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

export async function deleteDraftAction(draftId: string) {
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

export async function markAsSentAction(draftId: string) {
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
        ? 'Outreach Sent' 
        : 'Meeting';
      await leadService.advanceStageIfEarlier(lead.id, newStage);
    }

    try {
      revalidatePath(`/leads/${draft.leadId}`);
      revalidatePath('/');
    } catch (e) {}
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to mark as sent';
    return { error: msg };
  }
}
