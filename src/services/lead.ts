import { Db } from '../db';
import { eq, desc } from 'drizzle-orm';
import { leads, activities, tasks, notes } from '../db/schema/core';
import { candidateLeads, discoveryScopes } from '../db/schema/discovery';
import { CreateLeadInput } from '../db/models/lead';
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

  /**
   * Advance the lead to the given stage only if it's further along than the current stage.
   * No-op if already at or past the target stage.
   */
  async advanceStageIfEarlier(leadId: string, targetStage: PipelineStage) {
    const lead = await this.getLead(leadId);
    if (!lead) return;
    const currentIdx = PIPELINE_STAGES.indexOf(lead.stage as PipelineStage);
    const targetIdx = PIPELINE_STAGES.indexOf(targetStage);
    if (targetIdx < 0) return;
    if (currentIdx >= targetIdx) return; // already at or past target
    await this.updateStage(leadId, targetStage);
  }

  async createLead(input: CreateLeadInput) {
    const id = crypto.randomUUID();
    const now = new Date();
    
    await this.db.insert(leads).values({
      ...input,
      id,
      stage: input.stage || 'New',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
    });

    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId: id,
      type: 'Lead created',
      summary: 'Lead was created',
      metadata: {
        to_stage: input.stage || 'New',
      },
      timestamp: now,
    });

    // Recalculate baseline score immediately
    const scoringService = new ScoringService(this.db);
    await scoringService.recalculateScore(id);

    const [lead] = await this.db.select().from(leads).where(eq(leads.id, id)).limit(1);
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

  async updateLead(id: string, input: Partial<CreateLeadInput>) {
    const now = new Date();
    await this.db.update(leads).set({
      ...input,
      updatedAt: now,
    }).where(eq(leads.id, id));

    // Recalculate baseline score immediately
    const scoringService = new ScoringService(this.db);
    await scoringService.recalculateScore(id);

    return this.getLead(id);
  }

  async updateStage(id: string, newStage: string) {
    const now = new Date();
    const oldLead = await this.getLead(id);
    
    if (!oldLead) throw new Error('Lead not found');
    const oldStage = oldLead.stage;

    if (oldStage === newStage) return oldLead;

    await this.db.update(leads).set({
      stage: newStage,
      updatedAt: now,
    }).where(eq(leads.id, id));

    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId: id,
      type: 'Stage changed',
      summary: `Stage changed from ${oldStage} to ${newStage}`,
      metadata: {
        from_stage: oldStage,
        to_stage: newStage,
      },
      timestamp: now,
    });

    return this.getLead(id);
  }

  async archiveLead(id: string) {
    const now = new Date();
    await this.db.update(leads).set({
      status: 'Archived',
      updatedAt: now,
    }).where(eq(leads.id, id));

    return this.getLead(id);
  }

  async getActivities(leadId: string) {
    return this.db.select().from(activities).where(eq(activities.leadId, leadId)).orderBy(desc(activities.timestamp));
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

    const excerpt = body.length > 60 ? body.substring(0, 60) + '...' : body;

    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId,
      type: 'Note added',
      summary: `Added note: "${excerpt}"`,
      timestamp: now,
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

    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId,
      type: 'Task created',
      summary: `Created task: "${title}"`,
      timestamp: now,
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

    await this.db.update(tasks).set({
      status: newStatus,
      completedAt,
      updatedAt: now,
    }).where(eq(tasks.id, taskId));

    if (oldTask.leadId) {
      await this.db.insert(activities).values({
        id: crypto.randomUUID(),
        leadId: oldTask.leadId,
        type: 'Task updated',
        summary: `Task "${oldTask.title}" marked as ${newStatus}`,
        timestamp: now,
      });
    }

    const [task] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    return task;
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
