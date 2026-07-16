import { LoggingService } from './logging';
import { type Db } from '../db';
import { eq, desc, lt, and, isNotNull } from 'drizzle-orm';
import { outreachDrafts, approvals, activities } from '../db/schema';
import { getLogger } from '../lib/logger';

const log = getLogger('OutreachService');

/** Module-level timestamp for throttling attachment cleanup. */
let _lastCleanupTimestamp = 0;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export interface CreateDraftInput {
  leadId: string;
  channel: string; // 'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING'
  subject?: string | null;
  body: string;
  createdByUserId?: string | null;
  attachments?: string | null;
  origin?: 'AI_GENERATED' | 'MANUAL';
  citedEvidence?: string | null;
  riskFlags?: string | null;
}

export class OutreachService {
  constructor(private db: Db) {}

  /**
   * Cleans up base64 attachment data from drafts older than 15 minutes to keep DB light.
   */
  async cleanOldAttachments() {
    const now = Date.now();
    if (now - _lastCleanupTimestamp < CLEANUP_INTERVAL_MS) {
      return; // Already ran recently, skip
    }
    _lastCleanupTimestamp = now;

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    try {
      const candidateDrafts = await this.db
        .select({ id: outreachDrafts.id, attachments: outreachDrafts.attachments })
        .from(outreachDrafts)
        .where(
          and(
            lt(outreachDrafts.createdAt, fifteenMinutesAgo),
            isNotNull(outreachDrafts.attachments),
          )
        )
        .limit(20);

      const oldDrafts = candidateDrafts.filter(d => Array.isArray(d.attachments) && d.attachments.some(a => (a as any).base64));

      if (oldDrafts.length >= 20) {
        log.warn('More than 20 drafts with base64 attachments pending cleanup', { count: oldDrafts.length });
      }

      const batchUpdates: Promise<any>[] = [];
      for (const draft of oldDrafts) {
        if (!draft.attachments) continue;
        const parsed = Array.isArray(draft.attachments)
          ? (draft.attachments as Array<{ name: string; type: string; base64?: string }>)
          : [];
        let modified = false;
        const updated = parsed.map(att => {
          if (att.base64) {
            modified = true;
            const { base64, ...rest } = att;
            return rest;
          }
          return att;
        });
        if (modified) {
          batchUpdates.push(
            this.db.update(outreachDrafts).set({ attachments: JSON.stringify(updated) }).where(eq(outreachDrafts.id, draft.id))
          );
        }
      }
      if (batchUpdates.length > 0) {
        await this.db.batch(batchUpdates as any);
      }
    } catch (e) {
      log.error('Error running cleanOldAttachments', e);
    }
  }

  /**
   * Retrieves all outreach drafts for a given lead, sorted by creation date descending.
   */
  async getDraftsForLead(leadId: string) {
    // Run cleanup in background dynamically
    this.cleanOldAttachments().catch(e => log.error('Background cleanup failed', e));

    return this.db
      .select({
        id: outreachDrafts.id,
        leadId: outreachDrafts.leadId,
        channel: outreachDrafts.channel,
        subject: outreachDrafts.subject,
        body: outreachDrafts.body,
        status: outreachDrafts.status,
        isRead: outreachDrafts.isRead,
        origin: outreachDrafts.origin,
        createdByUserId: outreachDrafts.createdByUserId,
        createdAt: outreachDrafts.createdAt,
        updatedAt: outreachDrafts.updatedAt,
        attachments: outreachDrafts.attachments,
        feedback: approvals.feedback,
      })
      .from(outreachDrafts)
      .leftJoin(approvals, eq(outreachDrafts.id, approvals.draftId))
      .where(eq(outreachDrafts.leadId, leadId))
      .orderBy(desc(outreachDrafts.createdAt))
      .limit(50);
  }

  /**
   * Retrieves a specific draft by its ID.
   */
  async getDraftById(id: string) {
    const results = await this.db
      .select({
        id: outreachDrafts.id,
        leadId: outreachDrafts.leadId,
        channel: outreachDrafts.channel,
        subject: outreachDrafts.subject,
        body: outreachDrafts.body,
        status: outreachDrafts.status,
        isRead: outreachDrafts.isRead,
        origin: outreachDrafts.origin,
        createdByUserId: outreachDrafts.createdByUserId,
        createdAt: outreachDrafts.createdAt,
        updatedAt: outreachDrafts.updatedAt,
        attachments: outreachDrafts.attachments,
        feedback: approvals.feedback,
      })
      .from(outreachDrafts)
      .leftJoin(approvals, eq(outreachDrafts.id, approvals.draftId))
      .where(eq(outreachDrafts.id, id))
      .limit(1);
    return results[0] || null;
  }

  /**
   * Creates a new outreach draft in the 'DRAFT' status.
   */
  async createDraft(input: CreateDraftInput) {
    const id = crypto.randomUUID();
    const now = new Date();

    const newDraft = {
      id,
      leadId: input.leadId,
      channel: input.channel,
      subject: input.subject || null,
      body: input.body,
      status: 'DRAFT' as const,
      origin: input.origin || 'AI_GENERATED',
      createdByUserId: input.createdByUserId || null,
      createdAt: now,
      updatedAt: now,
      attachments: input.attachments || null,
      citedEvidence: input.citedEvidence ?? null,
      riskFlags: input.riskFlags ?? null,
    };

    await this.db.insert(outreachDrafts).values(newDraft);

    // Log Activity
    await new LoggingService(this.db).log({
leadId: input.leadId,
      type: 'Outreach draft created',
      summary: `Created outreach draft for ${input.channel}`,
      
});

    // Run cleanup in background
    this.cleanOldAttachments().catch(e => log.error('Background cleanup failed', e));

    return newDraft;
  }

  /**
   * Updates the subject and body of a draft. DRAFT and APPROVED drafts can be edited.
   * REJECTED and SENT drafts are locked.
   */
  async updateDraftContent(draftId: string, subject: string | null, body: string) {
    const draft = await this.getDraftById(draftId);
    if (!draft) {
      throw new Error(`Outreach draft with ID ${draftId} not found`);
    }

    if (draft.status !== 'DRAFT' && draft.status !== 'APPROVED') {
      throw new Error(`Only DRAFT or APPROVED drafts can be edited. Current status: ${draft.status}`);
    }

    const now = new Date();
    await this.db
      .update(outreachDrafts)
      .set({
        subject,
        body,
        updatedAt: now,
      })
      .where(eq(outreachDrafts.id, draftId));

    // Log activity for the edit
    await new LoggingService(this.db).log({
leadId: draft.leadId,
      type: 'Outreach draft edited',
      summary: `Edited outreach draft for ${draft.channel}`,
      
});

    return { ...draft, subject, body, updatedAt: now };
  }

  /**
   * Direct updates of draft status (e.g. marking as SENT).
   */
  async updateDraftStatus(draftId: string, status: 'DRAFT' | 'APPROVED' | 'REJECTED' | 'SENT') {
    const draft = await this.getDraftById(draftId);
    if (!draft) {
      throw new Error(`Outreach draft with ID ${draftId} not found`);
    }

    // Enforce valid status transitions
    const validTransitions: Record<string, string[]> = {
      'DRAFT': ['APPROVED', 'REJECTED'],
      'APPROVED': ['SENT'],
      'REJECTED': [],
      'SENT': [],
    };

    const allowed = validTransitions[draft.status] || [];
    if (!allowed.includes(status)) {
      throw new Error(
        `Invalid status transition: cannot move from ${draft.status} to ${status}`
      );
    }

    const now = new Date();
    const updates: any = {
      status,
      updatedAt: now,
    };
    if (status !== 'DRAFT') updates.isRead = true;

    await this.db
      .update(outreachDrafts)
      .set(updates)
      .where(eq(outreachDrafts.id, draftId));

    // Log activity if transitioning to SENT
    if (status === 'SENT') {
      let leads: any;
      try {
        ({ prospects: leads } = await import('../db/schema/core'));
      } catch (e) {
        log.error('Failed to import core schema', e);
        return;
      }
      await this.db.update(leads).set({ lastActivityAt: now, updatedAt: now }).where(eq(leads.id, draft.leadId));

      await new LoggingService(this.db).log({
        leadId: draft.leadId,
        type: 'Outreach sent',
        summary: `Sent outreach draft via ${draft.channel}`,
        
      });
    }

    return { ...draft, status, updatedAt: now };
  }

  /**
   * Deletes a draft by its ID. Only DRAFT-status drafts can be deleted.
   * Returns true if deleted, false if not found.
   */
  async deleteDraft(draftId: string): Promise<boolean> {
    const draft = await this.getDraftById(draftId);
    if (!draft) return false;

    if (draft.status !== 'DRAFT') {
      throw new Error(`Only DRAFT status drafts can be deleted. Current status: ${draft.status}`);
    }

    await this.db.delete(outreachDrafts).where(eq(outreachDrafts.id, draftId));

    // Log activity
    await new LoggingService(this.db).log({
leadId: draft.leadId,
      type: 'Outreach draft deleted',
      summary: `Deleted outreach draft for ${draft.channel}`,
      
});

    return true;
  }

  /**
   * Records an explicit human approval or rejection of a draft, and updates its status.
   */
  async recordApproval(
    draftId: string,
    userId: string,
    decision: 'APPROVED' | 'REJECTED',
    feedback?: string | null
  ) {
    const draft = await this.getDraftById(draftId);
    if (!draft) {
      throw new Error(`Outreach draft with ID ${draftId} not found`);
    }

    if (draft.status !== 'DRAFT') {
      throw new Error(
        `Cannot record approval: draft is in ${draft.status} status, expected DRAFT`
      );
    }

    const approvalId = crypto.randomUUID();
    const now = new Date();

    // Insert the approval record
    const newApproval = {
      id: approvalId,
      draftId,
      userId,
      decision,
      feedback: feedback || null,
      createdAt: now,
    };

    // Insert the approval record
    await this.db.insert(approvals).values(newApproval);

    // Update the draft status to match the decision
    const updates: Record<string, unknown> = {
      status: decision,
      updatedAt: now,
      isRead: true,
    };

    if (decision === 'REJECTED' && feedback) {
      updates.rejectionReason = feedback;
    }

    await this.db
      .update(outreachDrafts)
      .set(updates)
      .where(eq(outreachDrafts.id, draftId));

    // Log Activity
    await new LoggingService(this.db).log({
leadId: draft.leadId,
      type: decision === 'APPROVED' ? 'Outreach approved' : 'Outreach rejected',
      summary: `${decision === 'APPROVED' ? 'Approved' : 'Rejected'} outreach draft for ${draft.channel}`,
      
});

    return newApproval;
  }
}
