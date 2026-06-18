import { Db } from '../db';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';
import { leads, activities, activityMetadata, tasks, notes, leadStageHistory, users } from '../db/schema/core';
import { candidateLeads, discoveryScopes } from '../db/schema/discovery';
import { CreateLeadInput } from '../db/models/lead';
import { LoggingService } from './logging';
import { ScoringService } from './scoring';

export const PIPELINE_STAGES = [
  'New',
  'In Research',
  'Auditing',
  'Audited',
  'Drafting',
  'Ready to Send',
  'Outreach Sent',
  'Meeting',
  'Won',
  'Lost',
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];

export class LeadService {
  constructor(private db: Db) {}

  private async triggerWorkflowIfOutreachSent(leadId: string, newStage: string, oldStage: string, stageUpdatedAt?: Date | null) {
    if (newStage === 'Outreach Sent' && oldStage !== 'Outreach Sent') {
      try {
        const { triggerMonitorStalledLeadWorkflow } = await import('../lib/workflow-client');
        let workflowBinding: any = undefined;
        try {
          const { getCloudflareContext } = await import('@opennextjs/cloudflare');
          workflowBinding = getCloudflareContext().env?.MONITOR_STALLED_LEAD_WORKFLOW;
        } catch (e) {}
        if (!workflowBinding) {
          workflowBinding = (process.env as any)?.MONITOR_STALLED_LEAD_WORKFLOW;
        }
        await triggerMonitorStalledLeadWorkflow(this.db, workflowBinding, leadId, stageUpdatedAt ? stageUpdatedAt.getTime() : Date.now());
      } catch (e) {
        console.error('Failed to trigger stalled lead monitor workflow:', e);
      }
    }
  }

  /**
   * Advance the lead to the given stage only if it's further along than the current stage.
   * No-op if already at or past the target stage.
   */
  async advanceStageIfEarlier(leadId: string, targetStage: PipelineStage, actorId?: string) {
    const lead = await this.getLead(leadId);
    if (!lead) return;
    const currentIdx = PIPELINE_STAGES.indexOf(lead.stage as PipelineStage);
    const targetIdx = PIPELINE_STAGES.indexOf(targetStage);
    if (targetIdx < 0) return;
    if (currentIdx >= targetIdx) return; // already at or past target
    await this.updateStage(leadId, targetStage, actorId);
  }

  private async runTx(cb: (tx: any) => Promise<void>) {
    const isMock = (this.db as any).$client?.name === 'better-sqlite3' || (this.db as any).$client?.constructor?.name === 'Database';
    if (isMock) {
      await cb(this.db);
    } else {
      await this.db.transaction(async (tx: any) => {
        await cb(tx);
      });
    }
  }

  async createLead(input: CreateLeadInput) {
    const id = crypto.randomUUID();
    const now = new Date();
    const actorId = input.ownerId;
    const { sourceName, ...leadData } = input;
    
    await this.runTx(async (tx) => {
      await tx.insert(leads).values({
        ...leadData,
        id,
        stage: leadData.stage || 'New',
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(leadStageHistory).values({
        id: crypto.randomUUID(),
        leadId: id,
        previousStage: null,
        stage: leadData.stage || 'New',
        enteredAt: now,
        changedBy: actorId || null,
      });

      let finalSourceName = sourceName?.trim() || 'Manual Entry';
      
      // Find or create Discovery Scope
      let [scope] = await tx.select().from(discoveryScopes).where(eq(discoveryScopes.name, finalSourceName)).limit(1);
      
      if (!scope) {
        const scopeId = crypto.randomUUID();
        await tx.insert(discoveryScopes).values({
          id: scopeId,
          name: finalSourceName,
          description: `Automatically created for source: ${finalSourceName}`,
          createdByUserId: leadData.ownerId || 'system',
          createdAt: now,
          updatedAt: now,
        });
        [scope] = await tx.select().from(discoveryScopes).where(eq(discoveryScopes.id, scopeId)).limit(1);
      }
      
      // Create candidate lead linking to the scope
      await tx.insert(candidateLeads).values({
        id: crypto.randomUUID(),
        discoveryScopeId: scope.id,
        rawName: leadData.name,
        rawWebsiteUrl: leadData.website || null,
        rawContactInfo: leadData.email || leadData.phone || null,
        rawLocation: [leadData.city, leadData.region].filter(Boolean).join(', ') || null,
        status: 'PROMOTED',
        promotedLeadId: id,
        createdAt: now,
        updatedAt: now,
      });

      await new LoggingService(tx as any).log({
        leadId: id,
        type: 'Lead created',
        summary: `Lead was created from source: ${finalSourceName}`,
        metadata: {
          to_stage: leadData.stage || 'New',
          source: finalSourceName
        },
      });
    });

    // Recalculate baseline score immediately
    const scoringService = new ScoringService(this.db);
    await scoringService.recalculateScore(id);

    const [lead] = await this.db.select().from(leads).where(eq(leads.id, id)).limit(1);
    
    if (input.stage === 'Outreach Sent') {
      await this.triggerWorkflowIfOutreachSent(id, 'Outreach Sent', 'New', lead?.stageUpdatedAt);
    }

    return lead;
  }

async listLeads() {
  return this.db.select().from(leads).where(eq(leads.status, 'Active')).orderBy(desc(leads.updatedAt));
}

  async getLead(id: string) {
    const [row] = await this.db
      .select({
        lead: leads,
        campaignId: discoveryScopes.id,
        campaignName: discoveryScopes.name,
      })
      .from(leads)
      .leftJoin(candidateLeads, eq(leads.id, candidateLeads.promotedLeadId))
      .leftJoin(discoveryScopes, eq(candidateLeads.discoveryScopeId, discoveryScopes.id))
      .where(eq(leads.id, id))
      .limit(1);

    if (!row) return null;
    return {
      ...row.lead,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
    };
  }

  async updateLead(id: string, input: Partial<CreateLeadInput>, actorId?: string) {
    const now = new Date();
    const oldLead = await this.getLead(id);
    
    if (!oldLead) throw new Error('Lead not found');

    const updates: any = {
      ...input,
      updatedAt: now,
    };
    if (input.stage && input.stage !== 'New') updates.isRead = true;
    if (input.stage && input.stage !== oldLead.stage) updates.stageUpdatedAt = now;

    if (input.stage && input.stage !== oldLead.stage) {
      await this.runTx(async (tx) => {
        await tx.insert(leadStageHistory).values({
          id: crypto.randomUUID(),
          leadId: id,
          previousStage: oldLead.stage,
          stage: input.stage as string,
          enteredAt: now,
          changedBy: actorId || null,
        });

        await tx.update(leads).set(updates).where(eq(leads.id, id));

        await new LoggingService(tx as any).log({
          leadId: id,
          type: 'Stage changed',
          summary: `Stage changed from ${oldLead.stage} to ${input.stage}`,
          metadata: {
            from_stage: oldLead.stage,
            to_stage: input.stage,
          },
        });
      });
    } else {
      await this.db.update(leads).set(updates).where(eq(leads.id, id));
    }

    // Recalculate baseline score immediately
    const scoringService = new ScoringService(this.db);
    await scoringService.recalculateScore(id);

    if (input.stage) {
      const updatedLead = await this.getLead(id);
      await this.triggerWorkflowIfOutreachSent(id, input.stage, oldLead.stage, updatedLead?.stageUpdatedAt);
    }

    return this.getLead(id);
  }

  async updateStage(id: string, newStage: string, actorId?: string) {
    const now = new Date();
    const oldLead = await this.getLead(id);
    
    if (!oldLead) throw new Error('Lead not found');
    const oldStage = oldLead.stage;

    if (oldStage === newStage) return oldLead;

    const updates: any = {
      stage: newStage,
      updatedAt: now,
      stageUpdatedAt: now,
    };
    if (newStage !== 'New') updates.isRead = true;

    await this.runTx(async (tx) => {
      await tx.insert(leadStageHistory).values({
        id: crypto.randomUUID(),
        leadId: id,
        previousStage: oldStage,
        stage: newStage,
        enteredAt: now,
        changedBy: actorId || null,
      });

      await tx.update(leads).set(updates).where(eq(leads.id, id));

      await new LoggingService(tx as any).log({
        leadId: id,
        type: 'Stage changed',
        summary: `Stage changed from ${oldStage} to ${newStage}`,
        metadata: {
          from_stage: oldStage,
          to_stage: newStage,
        },
      });
    });

    const updatedLead = await this.getLead(id);
    await this.triggerWorkflowIfOutreachSent(id, newStage, oldStage, updatedLead?.stageUpdatedAt);

    return this.getLead(id);
  }

  async archiveLead(id: string) {
    const now = new Date();

    await this.db.update(leads).set({
      status: 'Archived',
      isRead: true,
      updatedAt: now,
    }).where(eq(leads.id, id));

    return this.getLead(id);
  }

  async getActivities(leadId: string) {
    const results = await this.db
      .select({
        id: activities.id,
        leadId: activities.leadId,
        type: activities.type,
        summary: activities.summary,
        timestamp: activities.timestamp,
        metadata: activityMetadata.metadata,
      })
      .from(activities)
      .leftJoin(activityMetadata, eq(activities.id, activityMetadata.activityId))
      .where(eq(activities.leadId, leadId))
      .orderBy(desc(activities.timestamp));

    return results.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
  }

  async addNote(leadId: string, authorId: string | null, body: string) {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.db.insert(notes).values({
      id,
      leadId,
      authorId,
      body,
      createdAt: now,
    });

    await this.db.update(leads).set({ lastActivityAt: now, updatedAt: now }).where(eq(leads.id, leadId));

    const excerpt = body.length > 60 ? body.substring(0, 60) + '...' : body;

    await new LoggingService(this.db).log({
      leadId,
      type: 'Note added',
      summary: `Added note: "${excerpt}"`,
    });

    const [note] = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);
    return note;
  }

  async getNotes(leadId: string) {
    return this.db.select().from(notes).where(eq(notes.leadId, leadId)).orderBy(desc(notes.createdAt));
  }

  async addTask(leadId: string, title: string, description: string | null, dueDate: Date | null, priority: string) {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.db.insert(tasks).values({
      id,
      title,
      description,
      leadId,
      dueDate,
      priority,
      status: 'Open',
      createdAt: now,
      updatedAt: now,
    });

    await this.db.update(leads).set({ lastActivityAt: now, updatedAt: now }).where(eq(leads.id, leadId));

    await new LoggingService(this.db).log({
      leadId,
      type: 'Task created',
      summary: `Created task: "${title}"`,
    });

    const [task] = await this.db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return task;
  }

  async getTasks(leadId: string) {
    return this.db.select().from(tasks).where(eq(tasks.leadId, leadId)).orderBy(desc(tasks.createdAt));
  }

  async toggleTaskStatus(taskId: string, currentStatus: string) {
    const now = new Date();
    const newStatus = currentStatus === 'Open' ? 'Completed' : 'Open';
    const completedAt = newStatus === 'Completed' ? now : null;

    const [oldTask] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!oldTask) throw new Error('Task not found');

    const updates: any = {
      status: newStatus,
      completedAt,
      updatedAt: now,
    };
    if (newStatus !== 'Open') updates.isRead = true;

    await this.db.update(tasks).set(updates).where(eq(tasks.id, taskId));

    if (oldTask.leadId) {
      await new LoggingService(this.db).log({
        leadId: oldTask.leadId,
        type: 'Task updated',
        summary: `Task "${oldTask.title}" marked as ${newStatus}`,
      });
    }

    const [task] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    return task;
  }

  async getPipelineDistribution(timestamp?: Date) {
    const ts = timestamp ? Math.floor(timestamp.getTime() / 1000) : Math.floor(Date.now() / 1000);
    
    const query = sql`
      SELECT stage, COUNT(lead_id) as count
      FROM (
        SELECT lead_id, stage,
               ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY entered_at DESC) as rn
        FROM lead_stage_history
        WHERE entered_at <= ${ts}
      )
      WHERE rn = 1
      GROUP BY stage
    `;

    const results = await this.db.all(query) as { stage: string; count: number }[];
    
    return results.reduce((acc: Record<string, number>, row) => {
      acc[row.stage] = row.count;
      return acc;
    }, {});
  }
  async getStageHistory(leadId: string) {
    return this.db.select({
      id: leadStageHistory.id,
      previousStage: leadStageHistory.previousStage,
      stage: leadStageHistory.stage,
      enteredAt: leadStageHistory.enteredAt,
      changedBy: users.name,
    })
    .from(leadStageHistory)
    .leftJoin(users, eq(leadStageHistory.changedBy, users.id))
    .where(eq(leadStageHistory.leadId, leadId))
    .orderBy(desc(leadStageHistory.enteredAt));
  }
  async getDashboardTasks() {
    return this.db.select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      status: tasks.status,
      priority: tasks.priority,
      leadId: tasks.leadId,
      leadName: leads.name,
    })
    .from(tasks)
    .leftJoin(leads, eq(tasks.leadId, leads.id))
    .where(eq(tasks.status, 'Open'))
    .orderBy(desc(tasks.dueDate));
  }
}
