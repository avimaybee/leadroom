'use server';

import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { OutreachService } from '@/services/outreach';
import { LeadService } from '@/services/lead';
import { ResearchService } from '@/services/research';
import { AuditService } from '@/services/audits';
import { generateOutreachDraft, getModelInfo } from '@/lib/ai';
import { triggerDelayedMonitorWorkflow } from '@/lib/workflow-client';

async function getUserId() {
  if (process.env.NODE_ENV === 'test' && (globalThis as any).mockUserId) {
    return (globalThis as any).mockUserId;
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
      attachments
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
      });
      newDrafts.push(newDraft);
    }

    // Advance pipeline
    await leadService.advanceStageIfEarlier(leadId, 'Drafting');

    try {
      revalidatePath(`/leads/${lead.id}`);
    } catch (e) {}

    return { success: true, drafts: newDrafts };
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
    await outreachService.updateDraftContent(draftId, subject, body);

    const draft = await outreachService.getDraftById(draftId);
    try {
      if (draft) revalidatePath(`/leads/${draft.leadId}`);
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

    await outreachService.recordApproval(draftId, userId, decision, feedback);

    if (decision === 'APPROVED') {
      const leadService = new LeadService(db);
      await leadService.advanceStageIfEarlier(draft.leadId, 'Ready to Send');
    }

    try {
      revalidatePath(`/leads/${draft.leadId}`);
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
    const deleted = await outreachService.deleteDraft(draftId);

    if (!deleted) {
      return { error: 'Draft not found' };
    }

    try {
      revalidatePath('/leads');
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

      if (newStage === 'Outreach Sent') {
        let workflowBinding: any = undefined;
        try {
          const { getCloudflareContext } = require('@opennextjs/cloudflare');
          workflowBinding = getCloudflareContext().env?.DELAYED_WORKFLOW_MONITOR;
        } catch (e) {}
        if (!workflowBinding) {
          workflowBinding = (process.env as any)?.DELAYED_WORKFLOW_MONITOR;
        }
        await triggerDelayedMonitorWorkflow(db, workflowBinding, lead.id);
      }
    }

    try {
      revalidatePath(`/leads/${draft.leadId}`);
    } catch (e) {}
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to mark as sent';
    return { error: msg };
  }
}
