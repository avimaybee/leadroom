import { type Db } from '../db';
import { eq, desc, and, or, isNull, isNotNull, count, gt, gte, lte, like, sql, inArray } from 'drizzle-orm';
import { prospects as leads, activities, activityMetadata, tasks, notes, leadStageHistory, pipelineConfig, notifications, nbaActionLogs } from '../db/schema/core';
import { researchSnapshots } from '../db/schema/research';
import { audits } from '../db/schema/audits';
import { outreachDrafts } from '../db/schema/outreach';
import { createNotification } from '@/lib/notifications';
import { candidateLeads, discoveryScopes } from '../db/schema/discovery';
import { CreateLeadInput } from '../db/models/lead';
import { LoggingService } from './logging';
import { ScoringService } from './scoring';
import { CalendarService } from './calendar';
import { getLogger } from '../lib/logger';

const log = getLogger('LeadService');
const _calendarSyncInFlight = new Set<string>();

let _cfEnvResolved = false;
let _cfEnv: any = null;

function getCloudflareEnvOnce(): any {
  if (!_cfEnvResolved) {
    _cfEnvResolved = true;
    try {
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      _cfEnv = getCloudflareContext().env;
    } catch (e) {
      _cfEnv = null;
    }
  }
  return _cfEnv;
}

export const PIPELINE_STAGES = [
  'New',
  'In Research',
  'Researched',
  'Auditing',
  'Audited',
  'Drafting',
  'Outreach Drafted',
  'Awaiting Approval',
  'Ready to Send',
  'Outreach Sent',
  'Contacted',
  'Meeting Booked',
  'Meeting',
  'Won',
  'Lost',
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];

export const CANONICAL_STAGE_MAP: Record<string, PipelineStage> = {
  'Researching': 'In Research',
  'Qualified': 'Audited',
  'Outreach in Progress': 'Outreach Sent',
  'Meeting / Call': 'Meeting',
};

export function getCanonicalStage(stage: string | null | undefined): PipelineStage {
  if (!stage) return 'New';
  const mapped = CANONICAL_STAGE_MAP[stage];
  if (mapped) return mapped;
  if (PIPELINE_STAGES.includes(stage as PipelineStage)) return stage as PipelineStage;
  return 'New';
}

// ── Hardcoded stage defaults (industry-standard, AI-era velocity) ──

const STAGE_THRESHOLDS_DAYS: Record<string, number> = {
  'New': 0,
  'In Research': 2,
  'Researched': 0,
  'Auditing': 2,
  'Audited': 2,
  'Drafting': 2,
  'Outreach Drafted': 1,
  'Awaiting Approval': 1,
  'Ready to Send': 0,
  'Outreach Sent': 3,
  'Contacted': 3,
  'Meeting Booked': 1,
  'Meeting': 1,
  'Negotiation': 2,
  'Won': 0,
  'Lost': 0,
};

const STAGE_AUTO_TASKS: Record<string, { title: string; daysOffset: number; priority: string; category: string }[]> = {
  'In Research': [
    { title: 'Review prospect research', daysOffset: 0, priority: 'Medium', category: 'Review' },
  ],
  'Researched': [
    { title: 'Review research findings', daysOffset: 0, priority: 'Medium', category: 'Review' },
  ],
  'Outreach Drafted': [
    { title: 'Review draft before approval', daysOffset: 0, priority: 'High', category: 'Review' },
  ],
  'Awaiting Approval': [
    { title: 'Approve or reject outreach draft', daysOffset: 1, priority: 'High', category: 'Approval' },
  ],
  'Outreach Sent': [
    { title: 'Check for reply', daysOffset: 3, priority: 'High', category: 'Follow-up' },
    { title: 'Follow up if no reply', daysOffset: 5, priority: 'Medium', category: 'Follow-up' },
  ],
  'Contacted': [
    { title: 'Check for reply', daysOffset: 3, priority: 'High', category: 'Follow-up' },
    { title: 'Follow up if no reply', daysOffset: 5, priority: 'Medium', category: 'Follow-up' },
  ],
  'Meeting Booked': [
    { title: 'Prepare meeting materials', daysOffset: 0, priority: 'High', category: 'Preparation' },
    { title: 'Log meeting outcome', daysOffset: 1, priority: 'High', category: 'Follow-up' },
  ],
  'Meeting': [
    { title: 'Log meeting outcome', daysOffset: 1, priority: 'High', category: 'Follow-up' },
  ],
  'Negotiation': [
    { title: 'Review deal terms', daysOffset: 2, priority: 'Medium', category: 'Review' },
  ],
};

function getStageDays(stage: string): number {
  return STAGE_THRESHOLDS_DAYS[stage] ?? 5;
}

function getStageTasks(stage: string): { title: string; daysOffset: number; priority: string; category: string }[] {
  return STAGE_AUTO_TASKS[stage] ?? [];
}

export class LeadService {
  constructor(private db: Db) {}

  private async triggerWorkflowIfOutreachSent(leadId: string, newStage: string, oldStage: string, stageUpdatedAt?: Date | null) {
    if (newStage === 'Outreach Sent' && oldStage !== 'Outreach Sent') {
      try {
        const { triggerMonitorStalledLeadWorkflow } = await import('../lib/workflow-client');
        let workflowBinding: any = undefined;
        const cfEnv = getCloudflareEnvOnce();
        if (cfEnv) {
          workflowBinding = cfEnv.MONITOR_STALLED_LEAD_WORKFLOW;
        }
        if (!workflowBinding) {
          workflowBinding = process.env.MONITOR_STALLED_LEAD_WORKFLOW;
        }
        await triggerMonitorStalledLeadWorkflow(this.db, workflowBinding, leadId, stageUpdatedAt ? stageUpdatedAt.getTime() : Date.now());
      } catch (e) {
        log.error('Failed to trigger stalled lead monitor workflow', e);
      }
    }
  }

  /**
   * Advance the lead to the given stage only if it's further along than the current stage.
   * No-op if already at or past the target stage.
   */
  async advanceStageIfEarlier(leadId: string, targetStage: PipelineStage) {
    const lead = await this.getLead(leadId);
    if (!lead) return;
    const currentCanonical = getCanonicalStage(lead.stage);
    const currentIdx = PIPELINE_STAGES.indexOf(currentCanonical);
    if (currentIdx === -1) return;
    const targetIdx = PIPELINE_STAGES.indexOf(targetStage);
    if (targetIdx < 0) return;
    if (currentIdx >= targetIdx) return; // already at or past target
    await this.updateStage(leadId, targetStage);
  }

  async getStageThresholds(): Promise<{ stage: string; days: number }[]> {
    return PIPELINE_STAGES.filter(s => STAGE_THRESHOLDS_DAYS[s] > 0).map(stage => ({
      stage,
      days: STAGE_THRESHOLDS_DAYS[stage],
    }));
  }

  async checkDuplicates(input: { website?: string | null; email?: string | null; company?: string | null }, userId?: string): Promise<Array<{ id: string; name: string; website: string | null; email: string | null; company: string | null }>> {
    const orConditions: any[] = [];
    if (input.website) {
      orConditions.push(eq(leads.website, input.website));
    }
    if (input.email) {
      orConditions.push(eq(leads.email, input.email));
    }
    if (input.company) {
      orConditions.push(eq(leads.company, input.company));
    }
    if (orConditions.length === 0) return [];

    const conditions: any[] = [eq(leads.status, 'Active'), or(...orConditions)];
    if (userId) conditions.push(eq(leads.ownerId, userId));

    return this.db
      .select({ id: leads.id, name: leads.name, website: leads.website, email: leads.email, company: leads.company })
      .from(leads)
      .where(and(...conditions))
      .limit(10);
  }

  async createLead(input: CreateLeadInput) {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const { sourceName, ...leadData } = input;
    if (!leadData.ownerId) {
      log.warn('createLead called without ownerId — prospect will have no owner. All production callers should supply ownerId.');
    }
    
    let finalSourceName = sourceName?.trim() || 'Manual Entry';
    
    // Find or create Discovery Scope
    const ownerId = leadData.ownerId || 'system';
    let [scope] = await this.db.select().from(discoveryScopes).where(and(eq(discoveryScopes.name, finalSourceName), eq(discoveryScopes.createdByUserId, ownerId))).limit(1);
    
    let scopeId: string;
    if (!scope) {
      scopeId = crypto.randomUUID();
      await this.db.insert(discoveryScopes).values({
        id: scopeId,
        name: finalSourceName,
        description: `Automatically created for source: ${finalSourceName}`,
        createdByUserId: leadData.ownerId || 'system',
        createdAt: now,
        updatedAt: now,
      });
      [scope] = await this.db.select().from(discoveryScopes).where(eq(discoveryScopes.id, scopeId)).limit(1);
    } else {
      scopeId = scope.id;
    }

    await this.db.batch([
      this.db.insert(leads).values({
        ...leadData,
        id,
        stage: leadData.stage || 'New',
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      }),
      this.db.insert(leadStageHistory).values({
        id: crypto.randomUUID(),
        leadId: id,
        stage: leadData.stage || 'New',
        enteredAt: now,
      }),
      this.db.insert(candidateLeads).values({
        id: crypto.randomUUID(),
        discoveryScopeId: scopeId,
        rawName: leadData.name,
        rawWebsiteUrl: leadData.website || null,
        rawContactInfo: leadData.email || leadData.phone || null,
        rawLocation: [leadData.city, leadData.region].filter(Boolean).join(', ') || null,
        status: 'PROMOTED',
        promotedLeadId: id,
        createdAt: now,
        updatedAt: now,
      }),
    ]);

    await new LoggingService(this.db).log({
      leadId: id,
      type: 'Lead created',
      summary: `Lead was created from source: ${finalSourceName}`,
      metadata: {
        to_stage: leadData.stage || 'New',
        source: finalSourceName
      },
    });

    // Recalculate baseline score immediately
    const scoringService = new ScoringService(this.db);
    await scoringService.recalculateScore(id);

    const [lead] = await this.db.select().from(leads).where(eq(leads.id, id)).limit(1);
    
    if (input.stage === 'Outreach Sent') {
      await this.triggerWorkflowIfOutreachSent(id, 'Outreach Sent', 'New', lead?.stageUpdatedAt);
    }
      await this.generateStageTasks(id, leadData.stage || 'New', '');

    return lead;
  }

  async listLeads(userId?: string) {
    const conditions = [eq(leads.status, 'Active')];
    if (userId) conditions.push(eq(leads.ownerId, userId));
    return this.db.select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      email: leads.email,
      phone: leads.phone,
      website: leads.website,
      city: leads.city,
      region: leads.region,
      industry: leads.industry,
      stage: leads.stage,
      isRead: leads.isRead,
      status: leads.status,
      workspaceId: leads.workspaceId,
      marketId: leads.marketId,
      fitScore: leads.fitScore,
      confidenceScore: leads.confidenceScore,
      priorityTier: leads.priorityTier,
      ownerId: leads.ownerId,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      stageUpdatedAt: leads.stageUpdatedAt,
      lastActivityAt: leads.lastActivityAt,
    }).from(leads).where(and(...conditions)).orderBy(desc(leads.updatedAt)).limit(200);
  }

  async getDashboardProspects(userId: string) {
    return this.db
      .select({
        id: leads.id,
        name: leads.name,
        company: leads.company,
        fitScore: leads.fitScore,
        confidenceScore: leads.confidenceScore,
        priorityTier: leads.priorityTier,
        updatedAt: leads.updatedAt,
        disqualifiedReason: leads.disqualifiedReason,
        fitReasoning: leads.fitReasoning,
      })
      .from(leads)
      .where(sql`${leads.fitScore} IS NOT NULL AND ${leads.ownerId} = ${userId}`)
      .orderBy(desc(leads.fitScore))
      .limit(100);
  }

  async getProspectDetail(id: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.ownerId, userId)))
      .limit(1);
    return row || null;
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
    const oldLead = await this.getLead(id);
    
    if (!oldLead) throw new Error('Lead not found');

    if (input.stage && input.stage !== oldLead.stage) {
      await this.db.update(leadStageHistory)
        .set({ exitedAt: now })
        .where(and(eq(leadStageHistory.leadId, id), isNull(leadStageHistory.exitedAt)));
        
      await this.db.insert(leadStageHistory).values({
        id: crypto.randomUUID(),
        leadId: id,
        stage: input.stage,
        enteredAt: now,
      });

      await new LoggingService(this.db).log({
        leadId: id,
        type: 'Stage changed',
        summary: `Stage changed from ${oldLead.stage} to ${input.stage}`,
        metadata: {
          from_stage: oldLead.stage,
          to_stage: input.stage,
        },
      });
    }

    const updates: any = {
      ...input,
      updatedAt: now,
    };
    if (input.stage && input.stage !== 'New') updates.isRead = true;
    if (input.stage && input.stage !== oldLead.stage) updates.stageUpdatedAt = now;

    await this.db.update(leads).set(updates).where(eq(leads.id, id));

    // Only recalculate score if score-affecting fields changed
    const SCORE_AFFECTING_FIELDS = ['website', 'email', 'phone', 'city', 'region', 'industry'] as const;
    const scoreAffected = SCORE_AFFECTING_FIELDS.some((f) => (input as any)[f] !== undefined && (input as any)[f] !== (oldLead as any)[f]);
    if (scoreAffected) {
      const scoringService = new ScoringService(this.db);
      await scoringService.recalculateScore(id);
    }

    if (input.stage) {
      const updatedLead = await this.getLead(id);
      await this.triggerWorkflowIfOutreachSent(id, input.stage, oldLead.stage, updatedLead?.stageUpdatedAt);
      await this.generateStageTasks(id, input.stage, oldLead.stage);
    }

    return this.getLead(id);
  }

  async updateStage(id: string, newStage: string) {
    const now = new Date();
    const oldLead = await this.getLead(id);
    
    if (!oldLead) throw new Error('Lead not found');
    const oldStage = oldLead.stage;
    const canonicalOld = getCanonicalStage(oldStage);
    const canonicalNew = getCanonicalStage(newStage);

    if (canonicalOld === canonicalNew) return oldLead;

    const oldIdx = PIPELINE_STAGES.indexOf(canonicalOld);
    if (oldIdx === -1) return;
    const newIdx = PIPELINE_STAGES.indexOf(canonicalNew);

    // Check enforce-stage-order if enabled
    const [pc] = await this.db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1);
    if (pc?.enforceStageOrder && newIdx > oldIdx + 1) {
      const intermediate = PIPELINE_STAGES.slice(oldIdx + 1, newIdx);
      const missing: string[] = [];
      for (const stage of intermediate) {
        const [entry] = await this.db
          .select({ count: count() })
          .from(leadStageHistory)
          .where(and(eq(leadStageHistory.leadId, id), eq(leadStageHistory.stage, stage)))
          .limit(1);
        if (!entry?.count) missing.push(stage);
      }
      if (missing.length > 0) {
        throw new Error(`Cannot skip from ${oldStage} to ${newStage}. Lead must pass through: ${missing.join(', ')}.`);
      }
    }

    // Check stage requirements if moving forward
    if (newIdx > oldIdx) {
      const reqError = await this.verifyStageRequirements(id, newStage);
      if (reqError) {
        throw new Error(`Stage Transition Blocked: ${reqError}`);
      }
    }

    const stageUpdates: any = {
      stage: newStage,
      updatedAt: now,
      stageUpdatedAt: now,
    };
    if (newStage !== 'New') stageUpdates.isRead = true;

    await this.db.transaction(async (tx) => {
      await tx.update(leadStageHistory)
        .set({ exitedAt: now })
        .where(and(eq(leadStageHistory.leadId, id), isNull(leadStageHistory.exitedAt)));
      await tx.insert(leadStageHistory).values({
        id: crypto.randomUUID(),
        leadId: id,
        stage: newStage,
        enteredAt: now,
      });
      await tx.update(leads).set(stageUpdates).where(eq(leads.id, id));
    });

    await new LoggingService(this.db).log({
      leadId: id,
      type: 'Stage changed',
      summary: `Stage changed from ${oldStage} to ${newStage}`,
      metadata: {
        from_stage: oldStage,
        to_stage: newStage,
      },
    });

    // Correlate NBA action log if lead advanced forward
    if (newIdx > oldIdx) {
      await this.correlateNBAAction(id, newStage);
    }

    const updatedLead = await this.getLead(id);
      await this.triggerWorkflowIfOutreachSent(id, newStage, oldStage, updatedLead?.stageUpdatedAt);
      await this.generateStageTasks(id, newStage, oldStage);

    // Recalculate baseline score on stage change
    const scoringService = new ScoringService(this.db);
    await scoringService.recalculateScore(id);

    return updatedLead;
  }

  async archiveLead(id: string) {
    const now = new Date();
    
    await this.db.update(leadStageHistory)
      .set({ exitedAt: now })
      .where(and(eq(leadStageHistory.leadId, id), isNull(leadStageHistory.exitedAt)));

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
      .orderBy(desc(activities.timestamp))
      .limit(200);

    return results.map(row => ({
      ...row,
      metadata: row.metadata ?? null,
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
    return this.db.select().from(notes).where(eq(notes.leadId, leadId)).orderBy(desc(notes.createdAt)).limit(200);
  }

  async addTask(leadId: string, title: string, description: string | null, dueDate: Date | null, priority: string, assigneeId?: string | null, category?: string | null, source?: string | null, playbookId?: string | null) {
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
      assigneeId: assigneeId || null,
      category: category || null,
      source: source || null,
      playbookId: playbookId || null,
      createdAt: now,
      updatedAt: now,
    });

    await this.db.update(leads).set({ lastActivityAt: now, updatedAt: now }).where(eq(leads.id, leadId));

    await new LoggingService(this.db).log({
      leadId,
      type: 'Task created',
      summary: `Created task: "${title}"`,
    });

    // Auto-sync to Google Calendar if assignee has calendar connected (gated)
    if (assigneeId && !_calendarSyncInFlight.has(assigneeId)) {
      _calendarSyncInFlight.add(assigneeId);
      const calendarService = new CalendarService(this.db);
      calendarService.syncTasksToCalendar(assigneeId).finally(() => {
        _calendarSyncInFlight.delete(assigneeId);
      }).catch((err) => {
        log.error('Calendar sync failed for assignee', err, { assigneeId });
      });
    }

    const [task] = await this.db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return task;
  }

  async getTasks(leadId: string) {
    return this.db
      .select({
        id: tasks.id,
        leadId: tasks.leadId,
        title: tasks.title,
        description: tasks.description,
        dueDate: tasks.dueDate,
        status: tasks.status,
        priority: tasks.priority,
        assigneeId: tasks.assigneeId,
        category: tasks.category,
        source: tasks.source,
        playbookId: tasks.playbookId,
        googleCalendarEventId: tasks.googleCalendarEventId,
        googleCalendarSyncStatus: tasks.googleCalendarSyncStatus,
        googleCalendarSyncError: tasks.googleCalendarSyncError,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .where(eq(tasks.leadId, leadId))
      .orderBy(desc(tasks.createdAt))
      .limit(200);
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

    // Auto-sync to Google Calendar if assignee has calendar connected (gated)
    if (oldTask.assigneeId && !_calendarSyncInFlight.has(oldTask.assigneeId)) {
      _calendarSyncInFlight.add(oldTask.assigneeId);
      const calendarService = new CalendarService(this.db);
      calendarService.syncTasksToCalendar(oldTask.assigneeId).finally(() => {
        _calendarSyncInFlight.delete(oldTask.assigneeId!);
      }).catch((err) => {
        log.error('Calendar sync failed for assignee', err, { assigneeId: oldTask.assigneeId });
      });
    }

    // Check if all stage-auto tasks for this lead are complete
    if (newStatus === 'Completed' && oldTask.leadId) {
      const [lead] = await this.db.select({ stage: leads.stage, name: leads.name }).from(leads).where(eq(leads.id, oldTask.leadId)).limit(1);
      if (lead) {
        const expectedTitles = getStageTasks(lead.stage).map((t) => t.title);
        if (expectedTitles.length > 0) {
          const [openCount] = await this.db
            .select({ count: count() })
            .from(tasks)
            .where(and(eq(tasks.leadId, oldTask.leadId), inArray(tasks.title, expectedTitles), eq(tasks.status, 'Open')))
            .limit(1);
          if ((openCount?.count ?? 0) === 0 && oldTask.assigneeId) {
            await createNotification(
              this.db, oldTask.assigneeId, null,
              'All stage tasks complete',
              `All tasks for "${lead.stage}" are done — advance "${lead.name}" to the next stage?`,
              'INFO', `/leads/${oldTask.leadId}`,
            );
          }
        }
      }
    }

    const [task] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    return task;
  }

  private async generateStageTasks(leadId: string, newStage: string, oldStage: string) {
    if (newStage === oldStage) return;
    const tasksToCreate = getStageTasks(newStage);
    if (tasksToCreate.length === 0) return;

    const [lead] = await this.db.select({ ownerId: leads.ownerId }).from(leads).where(eq(leads.id, leadId)).limit(1);

    const existingTitles = new Set<string>();
    const existing = await this.db
      .select({ title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.leadId, leadId), eq(tasks.status, 'Open'), inArray(tasks.title, tasksToCreate.map(t => t.title))))
      .limit(200);
    for (const t of existing) existingTitles.add(t.title);

    const now = new Date();
    const assigneeId = lead?.ownerId || null;
    for (const template of tasksToCreate) {
      if (existingTitles.has(template.title)) continue;

      let dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + template.daysOffset);
      if (dueDate.getDay() === 0) dueDate.setDate(dueDate.getDate() + 1);
      else if (dueDate.getDay() === 6) dueDate.setDate(dueDate.getDate() + 2);

      await this.addTask(leadId, template.title, null, dueDate, template.priority, assigneeId, template.category, 'auto');
    }
  }

  async getDashboardTasks(userId?: string) {
    const conditions = [eq(tasks.status, 'Open')];
    if (userId) conditions.push(eq(tasks.assigneeId, userId));
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
    .where(and(...conditions))
    .orderBy(desc(tasks.dueDate))
    .limit(200);
  }

  async getMyTasks(userId: string) {
    return this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        status: tasks.status,
        priority: tasks.priority,
        category: tasks.category,
        leadId: tasks.leadId,
        leadName: leads.name,
      })
      .from(tasks)
      .leftJoin(leads, eq(tasks.leadId, leads.id))
      .where(and(eq(tasks.assigneeId, userId), eq(tasks.status, 'Open')))
      .orderBy(tasks.dueDate)
      .limit(200);
  }

  // ── Pipeline Funnel Analytics ──

  async getStageFunnel(userId?: string): Promise<{
    stage: string;
    entered: number;
    exited: number;
    conversionRate: number | null;
    avgDaysInStage: number | null;
    droppedCount: number;
    droppedPercent: number | null;
  }[]> {
    const leadFilter = userId ? eq(leads.ownerId, userId) : undefined;

    const enteredRows = await this.db
      .select({ stage: leadStageHistory.stage, count: count() })
      .from(leadStageHistory)
      .innerJoin(leads, eq(leadStageHistory.leadId, leads.id))
      .where(leadFilter || sql`1=1`)
      .groupBy(leadStageHistory.stage);
    const enteredMap = new Map(enteredRows.map((r) => [r.stage, r.count]));

    const exitedRows = await this.db
      .select({ stage: leadStageHistory.stage, count: count() })
      .from(leadStageHistory)
      .innerJoin(leads, eq(leadStageHistory.leadId, leads.id))
      .where(leadFilter ? and(isNotNull(leadStageHistory.exitedAt), leadFilter) : isNotNull(leadStageHistory.exitedAt))
      .groupBy(leadStageHistory.stage);
    const exitedMap = new Map(exitedRows.map((r) => [r.stage, r.count]));

    const avgDaysMap = await this.getAvgDaysInAllStages(userId);

    const rows: any[] = [];
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i];
      const entered = enteredMap.get(stage) ?? 0;
      const exited = exitedMap.get(stage) ?? 0;
      const avgDaysInStage = avgDaysMap.get(stage) ?? null;
      const nextStage = PIPELINE_STAGES[i + 1];
      let conversionRate: number | null = null;
      if (nextStage && exited > 0) {
        const nextEntered = enteredMap.get(nextStage) ?? 0;
        conversionRate = Math.round((nextEntered / exited) * 100);
      }
      const droppedCount = entered - exited;
      const droppedPercent = entered > 0 ? Math.round((droppedCount / entered) * 100) : null;
      rows.push({ stage, entered, exited, conversionRate, avgDaysInStage, droppedCount, droppedPercent });
    }
    return rows;
  }

  private async getAvgDaysInAllStages(userId?: string): Promise<Map<string, number | null>> {
    const conditions: any[] = [isNotNull(leadStageHistory.exitedAt), isNotNull(leadStageHistory.enteredAt)];
    if (userId) conditions.push(eq(leads.ownerId, userId));
    const rows = await this.db
      .select({
        stage: leadStageHistory.stage,
        avgMs: sql<number>`AVG(${leadStageHistory.exitedAt} - ${leadStageHistory.enteredAt})`,
      })
      .from(leadStageHistory)
      .innerJoin(leads, eq(leadStageHistory.leadId, leads.id))
      .where(and(...conditions)).limit(1000);
    const map = new Map<string, number | null>();
    for (const row of rows) {
      if (row.avgMs === null) {
        map.set(row.stage, null);
      } else {
        map.set(row.stage, Math.round(row.avgMs / (24 * 60 * 60) * 10) / 10);
      }
    }
    return map;
  }

  // ── Stale Alert Methods ──

  async checkAndAlertStaleLeads(sensitivity: 'relaxed' | 'normal' | 'strict' = 'normal', userId?: string): Promise<number> {
    const multiplier = sensitivity === 'relaxed' ? 1.5 : sensitivity === 'strict' ? 0.7 : 1.0;
    const conditions: any[] = [eq(leads.status, 'Active')];
    if (userId) conditions.push(eq(leads.ownerId, userId));
    const activeLeads = await this.db
      .select({ id: leads.id, name: leads.name, stage: leads.stage, stageUpdatedAt: leads.stageUpdatedAt, ownerId: leads.ownerId })
      .from(leads)
      .where(and(...conditions))
      .limit(500);
    const [firstUser] = await this.db.select({ id: leads.ownerId }).from(leads).where(isNotNull(leads.ownerId)).limit(1);
    const fallbackUserId = firstUser?.id || null;
    let alertCount = 0;

    // Batch-fetch existing notifications to avoid per-lead queries
    const cutoff48 = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const cutoff24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const allNotifications = await this.db
      .select({ title: notifications.title })
      .from(notifications)
      .where(and(
        isNull(notifications.jobRunId),
        gte(notifications.createdAt, cutoff24),
        // Match both "Lead aging:" and "Lead stale:" prefixes
      ))
      .limit(2000);
    const agingNotified = new Set<string>();
    const staleNotified = new Set<string>();
    for (const n of allNotifications) {
      if (n.title.startsWith('Lead aging: ')) agingNotified.add(n.title.slice('Lead aging: '.length));
      else if (n.title.startsWith('Lead stale: ')) staleNotified.add(n.title.slice('Lead stale: '.length));
    }

    // Batch-fetch existing outreach jobs for stale leads in Outreach Sent
    const staleOutreachLeads = activeLeads.filter(l => l.stage === 'Outreach Sent' && l.ownerId);
    const existingJobsMap = new Map<string, boolean>();
    if (staleOutreachLeads.length > 0) {
      let jobRuns: any;
      try {
        ({ jobRuns } = await import('../db/schema/research'));
      } catch (e) {
        log.error('Failed to import research schema', e);
        return 0;
      }
      const existingJobs = await this.db
        .select({ targetLeadId: jobRuns.targetLeadId })
        .from(jobRuns)
        .where(and(
          inArray(jobRuns.targetLeadId, staleOutreachLeads.map(l => l.id)),
          eq(jobRuns.jobType, 'OUTREACH_DRAFT'),
          inArray(jobRuns.status, ['QUEUED', 'RUNNING']),
        ))
        .limit(500);
      for (const j of existingJobs) if (j.targetLeadId) existingJobsMap.set(j.targetLeadId, true);
    }

    const notificationRows: Array<typeof notifications.$inferInsert> = [];
    const batchActions: Promise<any>[] = [];
    const now = new Date();
    let jobRuns: any;
      try {
        ({ jobRuns } = await import('../db/schema/research'));
      } catch (e) {
        log.error('Failed to import research schema', e);
        return 0;
      }

    for (const lead of activeLeads) {
      if (lead.stage === 'Won' || lead.stage === 'Lost') continue;
      const thresholdDays = getStageDays(lead.stage) * multiplier;
      if (thresholdDays === 0) continue;
      const ageDays = this.getDaysSinceStageChange(lead.stageUpdatedAt);
      if (ageDays === null || ageDays < thresholdDays * 0.8) continue;

      if (ageDays < thresholdDays) {
        if (agingNotified.has(lead.name)) continue;
        const recipientId = lead.ownerId || fallbackUserId;
        if (recipientId) {
          notificationRows.push({
            id: crypto.randomUUID(),
            userId: recipientId,
            jobRunId: null,
            title: `Lead aging: ${lead.name}`,
            message: `${lead.name} has been in "${lead.stage}" for ${Math.round(ageDays)} days (${Math.round((ageDays / thresholdDays) * 100)}% of threshold).`,
            status: 'INFO',
            link: `/leads/${lead.id}`,
            isRead: false,
            createdAt: now,
          });
          agingNotified.add(lead.name);
        }
        continue;
      }

      if (staleNotified.has(lead.name)) continue;
      const recipientId = lead.ownerId || fallbackUserId;
      if (recipientId) {
        notificationRows.push({
          id: crypto.randomUUID(),
          userId: recipientId,
          jobRunId: null,
          title: `Lead stale: ${lead.name}`,
          message: `${lead.name} has been idle in "${lead.stage}" for ${Math.round(ageDays)} days (threshold: ${thresholdDays}).`,
          status: 'ERROR',
          link: `/leads/${lead.id}`,
          isRead: false,
          createdAt: now,
        });
        staleNotified.add(lead.name);
        alertCount++;
      }

      // Auto-queue outreach draft for stale leads in Outreach Sent
      if (lead.stage === 'Outreach Sent' && lead.ownerId && !existingJobsMap.has(lead.id)) {
        const jobId = crypto.randomUUID();
        batchActions.push(
          this.db.insert(jobRuns).values({
            id: jobId, jobType: 'OUTREACH_DRAFT', status: 'QUEUED',
            targetLeadId: lead.id, triggeredByUserId: lead.ownerId,
            externalRunId: 'STALE_AUTO', startedAt: null, finishedAt: null, createdAt: new Date(),
          })
        );
        await this.addTask(
          lead.id, 'Review auto-generated follow-up draft',
          `Auto-queued follow-up draft because ${lead.name} is idle in "${lead.stage}" ${Math.round(ageDays)} days.`,
          new Date(Date.now() + 24 * 60 * 60 * 1000), 'High', lead.ownerId, 'Follow-up', 'auto',
        );
      }
    }

    if (notificationRows.length > 0) {
      await this.db.insert(notifications).values(notificationRows);
    }
    if (batchActions.length > 0) {
      await this.db.batch(batchActions as any);
    }
    return alertCount;
  }

  private getDaysSinceStageChange(stageUpdatedAt: Date | string | number | null | undefined): number | null {
    if (!stageUpdatedAt) return null;
    const ageMs = Date.now() - new Date(stageUpdatedAt).getTime();
    return ageMs / (24 * 60 * 60 * 1000);
  }

  // ── Next-Best-Action Engine ──

  async getNextBestActions(
    leadId: string,
    rules?: NBARule[],
    prefetched?: {
      tasks?: any[];
      hasResearch?: boolean;
      hasAudit?: boolean;
      hasDraft?: boolean;
    }
  ): Promise<NBAResult[]> {
    const lead = await this.getLead(leadId);
    if (!lead) return [];
    if (lead.status !== 'Active') return [];
    if (lead.stage === 'Won' || lead.stage === 'Lost') return [];

    const activeRules = rules || DEFAULT_NBA_RULES;
    const results: Array<NBAResult & { score: number }> = [];

    // Query all dismissed signals for the lead at once
    const dismissedLogs = await this.db
      .select({ signal: nbaActionLogs.signal })
      .from(nbaActionLogs)
      .where(and(
        eq(nbaActionLogs.leadId, leadId),
        eq(nbaActionLogs.resultStageTarget, 'DISMISSED')
      ));
    const dismissedSignals = new Set(dismissedLogs.map(l => l.signal));

    for (const rule of activeRules) {
      if (rule.weight <= 0) continue;
      if (dismissedSignals.has(rule.signal)) continue;

      const signalStrength = await this.evaluateSignal(lead, rule.signal, prefetched);
      if (signalStrength <= 0) continue;
      const weighted = Math.round(signalStrength * rule.weight);
      results.push({ ...this.signalToAction(rule.signal, lead, signalStrength), score: weighted });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async evaluateSignal(
    lead: any,
    signal: NBASignal,
    prefetched?: {
      tasks?: any[];
      hasResearch?: boolean;
      hasAudit?: boolean;
      hasDraft?: boolean;
    }
  ): Promise<number> {
    const now = new Date();

    switch (signal) {
      case 'overdue_task': {
        if (prefetched?.tasks) {
          const overdueCount = prefetched.tasks.filter(t => 
            t.status === 'Open' && t.dueDate && new Date(t.dueDate) <= now
          ).length;
          return Math.min(overdueCount, 3) / 3;
        }
        const [row] = await this.db
          .select({ c: count() })
          .from(tasks)
          .where(and(eq(tasks.leadId, lead.id), eq(tasks.status, 'Open'), isNotNull(tasks.dueDate), lte(tasks.dueDate!, new Date())));
        const overdueCount = Math.min(row?.c ?? 0, 3);
        return overdueCount / 3;
      }
      case 'future_task': {
        if (prefetched?.tasks) {
          const hasFuture = prefetched.tasks.some(t => 
            t.status === 'Open' && t.dueDate && new Date(t.dueDate) > now
          );
          return hasFuture ? 0.5 : 0;
        }
        const [row] = await this.db
          .select({ c: count() })
          .from(tasks)
          .where(and(eq(tasks.leadId, lead.id), eq(tasks.status, 'Open'), isNotNull(tasks.dueDate), gt(tasks.dueDate!, new Date())));
        return row?.c && row.c > 0 ? 0.5 : 0;
      }
      case 'stale': {
        const ageDays = this.getDaysSinceStageChange(lead.stageUpdatedAt);
        if (ageDays === null) return 0;
        const thresholdDays = getStageDays(lead.stage);
        if (thresholdDays === 0 || ageDays <= thresholdDays) return 0;
        const overBy = ageDays / thresholdDays;
        return Math.min(0.5 + (overBy - 1) * 0.25, 1.0);
      }
      case 'unsent_draft': {
        if (prefetched?.hasDraft !== undefined) {
          return prefetched.hasDraft ? 0.6 : 0;
        }
        const [row] = await this.db
          .select({ c: count() })
          .from(outreachDrafts)
          .where(and(eq(outreachDrafts.leadId, lead.id), eq(outreachDrafts.status, 'DRAFT')));
        return row?.c && row.c > 0 ? 0.6 : 0;
      }
      case 'no_research': {
        if (prefetched?.hasResearch !== undefined) {
          return prefetched.hasResearch ? 0 : 1.0;
        }
        const [row] = await this.db
          .select({ c: count() })
          .from(researchSnapshots)
          .where(eq(researchSnapshots.leadId, lead.id));
        return row?.c && row.c > 0 ? 0 : 1.0;
      }
      case 'no_audit': {
        if (prefetched?.hasAudit !== undefined) {
          return prefetched.hasAudit ? 0 : 1.0;
        }
        const [row] = await this.db
          .select({ c: count() })
          .from(audits)
          .where(eq(audits.leadId, lead.id));
        return row?.c && row.c > 0 ? 0 : 1.0;
      }
      case 'unread': {
        return lead.isRead ? 0 : 1.0;
      }
      default:
        return 0;
    }
  }

  private signalToAction(signal: NBASignal, lead: any, strength: number): Omit<NBAResult, 'score'> {
    switch (signal) {
      case 'overdue_task':
        return { action: 'Complete overdue tasks', type: 'task', priority: strength >= 0.67 ? 'High' : 'Medium', rationale: `${lead.name} has overdue tasks.`, link: `/leads/${lead.id}` };
      case 'future_task':
        return { action: 'Review upcoming tasks', type: 'task', priority: 'Medium', rationale: `${lead.name} has scheduled tasks.`, link: `/leads/${lead.id}` };
      case 'stale':
        return { action: 'Re-engage stalled lead', type: 'review', priority: strength >= 0.75 ? 'High' : 'Medium', rationale: `${lead.name} has been idle in "${lead.stage}" past threshold.`, link: `/leads/${lead.id}` };
      case 'unsent_draft':
        return { action: 'Review and send outreach draft', type: 'outreach', priority: 'High', rationale: `${lead.name} has an unsent draft.`, link: `/leads/${lead.id}?view=outreach` };
      case 'no_research':
        return { action: 'Start lead research', type: 'research', priority: 'High', rationale: `${lead.name} has no research snapshot.`, link: `/leads/${lead.id}?view=research` };
      case 'no_audit':
        return { action: 'Run digital presence audit', type: 'audit', priority: 'Medium', rationale: `${lead.name} has not been audited.`, link: `/leads/${lead.id}?view=audit` };
      case 'unread':
        return { action: 'Review new lead', type: 'review', priority: 'High', rationale: `${lead.name} is unread.`, link: `/leads/${lead.id}` };
      default:
        return { action: 'Review lead', type: 'review', priority: 'Low', rationale: `Review ${lead.name} for next steps.`, link: `/leads/${lead.id}` };
    }
  }

  async verifyStageRequirements(leadId: string, targetStage: string): Promise<string | null> {
    // Enforce by default. Can be disabled by setting enforceStageOrder = false in pipelineConfig.
    const [pc] = await this.db.select({ enforceStageOrder: pipelineConfig.enforceStageOrder }).from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1);
    if (pc?.enforceStageOrder === false) return null;

    // Hardcoded stage requirements
    if (targetStage === 'In Research' || targetStage === 'Auditing' || targetStage === 'Drafting' || targetStage === 'Outreach Drafted') {
      const [r] = await this.db.select({ count: count() }).from(researchSnapshots).where(eq(researchSnapshots.leadId, leadId));
      if (r.count === 0) return 'A Research Snapshot is required to enter this stage.';
    }
    if (targetStage === 'Outreach Sent' || targetStage === 'Ready to Send' || targetStage === 'Contacted' || targetStage === 'Meeting Booked') {
      const [r] = await this.db.select({ count: count() }).from(outreachDrafts).where(eq(outreachDrafts.leadId, leadId));
      if (r.count === 0) return 'An Outreach Draft is required to enter this stage.';
    }
    return null;
  }

  async getUnmetStageRequirements(leadId: string, email: string | null): Promise<Record<string, string>> {
    const blocked: Record<string, string> = {};

    const [hasResearch] = await this.db.select({ count: count() }).from(researchSnapshots).where(eq(researchSnapshots.leadId, leadId));
    const [hasDraft] = await this.db.select({ count: count() }).from(outreachDrafts).where(eq(outreachDrafts.leadId, leadId));

    if (!hasResearch.count) {
      blocked['In Research'] = 'A Research Snapshot is required.';
      blocked['Auditing'] = 'A Research Snapshot is required.';
      blocked['Drafting'] = 'A Research Snapshot is required.';
      blocked['Outreach Drafted'] = 'A Research Snapshot is required.';
    }
    if (!hasDraft.count) {
      blocked['Ready to Send'] = 'An Outreach Draft is required.';
      blocked['Outreach Sent'] = 'An Outreach Draft is required.';
      blocked['Contacted'] = 'An Outreach Draft is required.';
      blocked['Meeting Booked'] = 'An Outreach Draft is required.';
    }
    return blocked;
  }

  async logNBAAction(leadId: string, signal: string, userId: string) {
    await this.db.insert(nbaActionLogs).values({
      id: crypto.randomUUID(),
      leadId,
      userId,
      signal,
    });
  }

  async simulateNBARules(draftRules: NBARule[], limit = 5, userId?: string): Promise<(NBAResult & { leadName: string })[]> {
    const conditions: any[] = [eq(leads.status, 'Active')];
    if (userId) conditions.push(eq(leads.ownerId, userId));
    const activeLeads = await this.db
      .select({ id: leads.id, name: leads.name, stage: leads.stage, stageUpdatedAt: leads.stageUpdatedAt, status: leads.status, isRead: leads.isRead })
      .from(leads)
      .where(and(...conditions))
      .limit(200);

    const leadIds = activeLeads.map(l => l.id);

    // Batch-fetch all NBA data upfront
    const [allTasks, allResearch, allAudits, allDrafts] = await Promise.all([
      this.db.select({ id: tasks.id, leadId: tasks.leadId, status: tasks.status, dueDate: tasks.dueDate }).from(tasks).where(inArray(tasks.leadId, leadIds)).limit(2000),
      this.db.select({ leadId: researchSnapshots.leadId }).from(researchSnapshots).where(inArray(researchSnapshots.leadId, leadIds)).limit(2000),
      this.db.select({ leadId: audits.leadId }).from(audits).where(inArray(audits.leadId, leadIds)).limit(2000),
      this.db.select({ leadId: outreachDrafts.leadId }).from(outreachDrafts).where(and(inArray(outreachDrafts.leadId, leadIds), eq(outreachDrafts.status, 'DRAFT'))).limit(2000),
    ]);

    // Build per-lead prefetch maps
    const tasksByLead = new Map<string, any[]>();
    for (const t of allTasks) {
      if (!t.leadId) continue;
      if (!tasksByLead.has(t.leadId)) tasksByLead.set(t.leadId, []);
      tasksByLead.get(t.leadId)!.push(t);
    }
    const hasResearch = new Set(allResearch.map(r => r.leadId).filter(Boolean));
    const hasAudit = new Set(allAudits.map(a => a.leadId).filter(Boolean));
    const hasDraft = new Set(allDrafts.map(d => d.leadId).filter(Boolean));

    const allResults: (NBAResult & { leadName: string })[] = [];
    const executing = new Set<Promise<void>>();
    const CONCURRENCY = 5;

    for (const lead of activeLeads) {
      const p = (async () => {
        const actions = await this.getNextBestActions(lead.id, draftRules, {
          tasks: tasksByLead.get(lead.id),
          hasResearch: hasResearch.has(lead.id),
          hasAudit: hasAudit.has(lead.id),
          hasDraft: hasDraft.has(lead.id),
        });
        if (actions.length > 0) {
          allResults.push({ ...actions[0], leadName: lead.name });
        }
      })().finally(() => executing.delete(p));
      executing.add(p);
      if (executing.size >= CONCURRENCY) {
        await Promise.race(executing);
      }
    }
    await Promise.allSettled(executing);

    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, limit);
  }

  private async correlateNBAAction(leadId: string, targetStage: string) {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14-day attribution window
    const [log] = await this.db
      .select()
      .from(nbaActionLogs)
      .where(and(eq(nbaActionLogs.leadId, leadId), gte(nbaActionLogs.actionTakenAt!, cutoff), isNull(nbaActionLogs.resultStageTarget)))
      .orderBy(desc(nbaActionLogs.actionTakenAt))
      .limit(1);
    if (log) {
      await this.db
        .update(nbaActionLogs)
        .set({ resultStageTarget: targetStage, resultStageReachedAt: new Date() })
        .where(eq(nbaActionLogs.id, log.id));
    }
  }
}

// ── NBA Types ──

export type NBASignal = 'overdue_task' | 'future_task' | 'stale' | 'unsent_draft' | 'no_research' | 'no_audit' | 'unread';

export interface NBARule {
  signal: NBASignal;
  weight: number;
}

export interface NBAResult {
  action: string;
  type: 'task' | 'research' | 'audit' | 'outreach' | 'review';
  priority: 'High' | 'Medium' | 'Low';
  rationale: string;
  link?: string;
  score: number;
}

export const DEFAULT_NBA_RULES: NBARule[] = [
  { signal: 'overdue_task', weight: 100 },
  { signal: 'future_task', weight: 80 },
  { signal: 'stale', weight: 60 },
  { signal: 'unsent_draft', weight: 70 },
  { signal: 'no_research', weight: 50 },
  { signal: 'no_audit', weight: 40 },
  { signal: 'unread', weight: 30 },
];
