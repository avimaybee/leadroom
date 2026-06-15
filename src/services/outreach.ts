import { Db } from '../db';
import { eq, desc, lt, and, isNotNull } from 'drizzle-orm';
import { outreachDrafts, approvals, activities } from '../db/schema';

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
      const oldDrafts = await this.db
        .select({ id: outreachDrafts.id, attachments: outreachDrafts.attachments })
        .from(outreachDrafts)
        .where(
          and(
            lt(outreachDrafts.createdAt, fifteenMinutesAgo),
            isNotNull(outreachDrafts.attachments)
          )
        );

      for (const draft of oldDrafts) {
        if (!draft.attachments) continue;
        try {
          const parsed = JSON.parse(draft.attachments) as Array<{ name: string; type: string; base64?: string }>;
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
            await this.db
              .update(outreachDrafts)
              .set({ attachments: JSON.stringify(updated) })
              .where(eq(outreachDrafts.id, draft.id));
          }
        } catch (e) {
          console.error(`Error cleaning attachments for draft ${draft.id}:`, e);
        }
      }
    } catch (e) {
      console.error('Error running cleanOldAttachments:', e);
    }
  }

  /**
   * Retrieves all outreach drafts for a given lead, sorted by creation date descending.
   */
  async getDraftsForLead(leadId: string) {
    // Run cleanup in background dynamically
    this.cleanOldAttachments().catch(e => console.error('Background cleanup failed', e));

    return this.db
      .select()
      .from(outreachDrafts)
      .where(eq(outreachDrafts.leadId, leadId))
      .orderBy(desc(outreachDrafts.createdAt));
  }

  /**
   * Retrieves a specific draft by its ID.
   */
  async getDraftById(id: string) {
    const [draft] = await this.db
      .select()
      .from(outreachDrafts)
      .where(eq(outreachDrafts.id, id))
      .limit(1);
    return draft || null;
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
    };

    await this.db.insert(outreachDrafts).values(newDraft);

    // Log Activity
    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId: input.leadId,
      type: 'Outreach draft created',
      summary: `Created outreach draft for ${input.channel}`,
      timestamp: now,
    });

    // Run cleanup in background
    this.cleanOldAttachments().catch(e => console.error('Background cleanup failed', e));

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
    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId: draft.leadId,
      type: 'Outreach draft edited',
      summary: `Edited outreach draft for ${draft.channel}`,
      timestamp: now,
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
    await this.db
      .update(outreachDrafts)
      .set({
        status,
        updatedAt: now,
      })
      .where(eq(outreachDrafts.id, draftId));

    // Log activity if transitioning to SENT
    if (status === 'SENT') {
      await this.db.insert(activities).values({
        id: crypto.randomUUID(),
        leadId: draft.leadId,
        type: 'Outreach sent',
        summary: `Sent outreach draft via ${draft.channel}`,
        timestamp: now,
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
    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId: draft.leadId,
      type: 'Outreach draft deleted',
      summary: `Deleted outreach draft for ${draft.channel}`,
      timestamp: new Date(),
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
    await this.db
      .update(outreachDrafts)
      .set({
        status: decision,
        updatedAt: now,
      })
      .where(eq(outreachDrafts.id, draftId));

    // Log Activity
    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId: draft.leadId,
      type: decision === 'APPROVED' ? 'Outreach approved' : 'Outreach rejected',
      summary: `${decision === 'APPROVED' ? 'Approved' : 'Rejected'} outreach draft for ${draft.channel}`,
      timestamp: now,
    });

    return newApproval;
  }
}
