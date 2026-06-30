import { Db } from '../db';
import { eq, desc, and, or, isNull, isNotNull, count, gt, gte, lte, like, sql, inArray } from 'drizzle-orm';
import { prospects as leads, activities, activityMetadata, tasks, notes, leadStageHistory, pipelineConfig, stageThresholds, notifications, nbaActionLogs, playbooks, playbookTasks } from '../db/schema/core';
import { researchSnapshots } from '../db/schema/research';
import { audits } from '../db/schema/audits';
import { outreachDrafts } from '../db/schema/outreach';
import { createNotification } from '@/lib/notifications';
import { candidateLeads, discoveryScopes } from '../db/schema/discovery';
import { CreateLeadInput } from '../db/models/lead';
import { LoggingService } from './logging';
import { ScoringService } from './scoring';
import { CalendarService } from './calendar';

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
  async advanceStageIfEarlier(leadId: string, targetStage: PipelineStage) {
    const lead = await this.getLead(leadId);
    if (!lead) return;
    const currentIdx = PIPELINE_STAGES.indexOf(lead.stage as PipelineStage);
    if (currentIdx === -1) return;
    const targetIdx = PIPELINE_STAGES.indexOf(targetStage);
    if (targetIdx < 0) return;
    if (currentIdx >= targetIdx) return; // already at or past target
    await this.updateStage(leadId, targetStage);
  }

  async getStageThresholds(): Promise<{ stage: string; days: number; updatedAt: Date | null }[]> {
    return this.db.select({ stage: stageThresholds.stage, days: stageThresholds.days, updatedAt: stageThresholds.updatedAt }).from(stageThresholds);
  }

  async checkDuplicates(input: { website?: string | null; email?: string | null; company?: string | null }): Promise<Array<{ id: string; name: string; website: string | null; email: string | null; company: string | null }>> {
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

    return this.db
      .select({ id: leads.id, name: leads.name, website: leads.website, email: leads.email, company: leads.company })
      .from(leads)
      .where(and(eq(leads.status, 'Active'), or(...orConditions)))
      .limit(10);
  }

  async createLead(input: CreateLeadInput) {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const { sourceName, ...leadData } = input;
    
    await this.db.insert(leads).values({
      ...leadData,
      id,
      stage: leadData.stage || 'New',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
    });

    await this.db.insert(leadStageHistory).values({
      id: crypto.randomUUID(),
      leadId: id,
      stage: leadData.stage || 'New',
      enteredAt: now,
    });

    let finalSourceName = sourceName?.trim() || 'Manual Entry';
    
    // Find or create Discovery Scope
    let [scope] = await this.db.select().from(discoveryScopes).where(eq(discoveryScopes.name, finalSourceName)).limit(1);
    
    if (!scope) {
      const scopeId = crypto.randomUUID();
      await this.db.insert(discoveryScopes).values({
        id: scopeId,
        name: finalSourceName,
        description: `Automatically created for source: ${finalSourceName}`,
        createdByUserId: leadData.ownerId || 'system',
        createdAt: now,
        updatedAt: now,
      });
      [scope] = await this.db.select().from(discoveryScopes).where(eq(discoveryScopes.id, scopeId)).limit(1);
    }
    
    // Create candidate lead linking to the scope
    await this.db.insert(candidateLeads).values({
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
    await this.triggerStagePlaybook(id, leadData.stage || 'New', '');

    return lead;
  }

  async listLeads() {
  return this.db.select().from(leads).where(eq(leads.status, 'Active')).orderBy(desc(leads.updatedAt));
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
      await this.triggerStagePlaybook(id, input.stage, oldLead.stage);
    }

    return this.getLead(id);
  }

  async updateStage(id: string, newStage: string) {
    const now = new Date();
    const oldLead = await this.getLead(id);
    
    if (!oldLead) throw new Error('Lead not found');
    const oldStage = oldLead.stage;

    if (oldStage === newStage) return oldLead;

    const oldIdx = PIPELINE_STAGES.indexOf(oldStage as PipelineStage);
    if (oldIdx === -1) return;
    const newIdx = PIPELINE_STAGES.indexOf(newStage as PipelineStage);

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

    await this.db.update(leadStageHistory)
      .set({ exitedAt: now })
      .where(and(eq(leadStageHistory.leadId, id), isNull(leadStageHistory.exitedAt)));
      
    await this.db.insert(leadStageHistory).values({
      id: crypto.randomUUID(),
      leadId: id,
      stage: newStage,
      enteredAt: now,
    });

    const updates: any = {
      stage: newStage,
      updatedAt: now,
      stageUpdatedAt: now,
    };
    if (newStage !== 'New') updates.isRead = true;

    await this.db.update(leads).set(updates).where(eq(leads.id, id));

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
    await this.triggerStagePlaybook(id, newStage, oldStage);

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

    // Auto-sync to Google Calendar if assignee has calendar connected
    if (assigneeId) {
      const calendarService = new CalendarService(this.db);
      calendarService.syncTasksToCalendar(assigneeId).catch(() => {});
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
        playbookName: playbooks.name,
      })
      .from(tasks)
      .leftJoin(playbooks, eq(tasks.playbookId, playbooks.id))
      .where(eq(tasks.leadId, leadId))
      .orderBy(desc(tasks.createdAt));
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

    // Auto-sync to Google Calendar if assignee has calendar connected
    if (oldTask.assigneeId) {
      const calendarService = new CalendarService(this.db);
      calendarService.syncTasksToCalendar(oldTask.assigneeId).catch(() => {});
    }

    // If task was completed, check if all playbook tasks for this lead's stage are done
    if (newStatus === 'Completed' && oldTask.leadId) {
      const [lead] = await this.db.select({ stage: leads.stage }).from(leads).where(eq(leads.id, oldTask.leadId)).limit(1);
      if (lead) {
        const [playbook] = await this.db
          .select({ id: playbooks.id })
          .from(playbooks)
          .where(and(eq(playbooks.stage, lead.stage), eq(playbooks.isActive, true)))
          .limit(1);
        if (playbook) {
          const [openPlaybookTasks] = await this.db
            .select({ count: count() })
            .from(tasks)
            .where(and(eq(tasks.leadId, oldTask.leadId), eq(tasks.playbookId, playbook.id), eq(tasks.status, 'Open')))
            .limit(1);
          if (openPlaybookTasks?.count === 0) {
            if (oldTask.assigneeId) {
              await createNotification(
              this.db,
              oldTask.assigneeId,
              null,
              'All playbook tasks complete',
              `All playbook tasks for "${lead.stage}" are done — advance "${oldTask.leadId?.slice(0, 8)}" to the next stage?`,
              'INFO',
              `/leads/${oldTask.leadId}`,
            );
          }
        }
      }
    }
    }

    const [task] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    return task;
  }

  private async triggerStagePlaybook(leadId: string, newStage: string, oldStage: string) {
    if (newStage === oldStage) return;

    const [playbook] = await this.db
      .select()
      .from(playbooks)
      .where(and(eq(playbooks.stage, newStage), eq(playbooks.isActive, true)))
      .limit(1);

    if (!playbook) return;

    const tasksToCreate = await this.db
      .select()
      .from(playbookTasks)
      .where(eq(playbookTasks.playbookId, playbook.id));

    const [lead] = await this.db.select({ ownerId: leads.ownerId }).from(leads).where(eq(leads.id, leadId)).limit(1);

    for (const template of tasksToCreate) {
      if (template.actionType === 'JOB') {
        const { jobRuns } = await import('../db/schema/research');
        const [existingJob] = await this.db
          .select({ id: jobRuns.id })
          .from(jobRuns)
          .where(and(eq(jobRuns.targetLeadId, leadId), eq(jobRuns.jobType, template.jobType || 'RESEARCH_GENERATION'), inArray(jobRuns.status, ['QUEUED', 'RUNNING'])))
          .limit(1);
        if (existingJob) continue;

        const jobId = crypto.randomUUID();
        await this.db.insert(jobRuns).values({
          id: jobId,
          jobType: template.jobType || 'RESEARCH_GENERATION',
          status: 'QUEUED',
          targetLeadId: leadId,
          triggeredByUserId: lead?.ownerId,
          externalRunId: 'PLAYBOOK',
          startedAt: null,
          finishedAt: null,
          createdAt: new Date(),
        });

        if (template.jobType === 'RESEARCH_GENERATION' || !template.jobType) {
          const { triggerResearchWorkflow } = await import('../lib/workflow-client');
          const env = (process.env as unknown as Record<string, unknown>);
          const workflowBinding = env?.RESEARCH_SNAPSHOT_WORKFLOW as any;
          await triggerResearchWorkflow(this.db, workflowBinding, leadId, jobId, lead?.ownerId);
        }
        continue;
      }

      const [existing] = await this.db
        .select({ count: count() })
        .from(tasks)
        .where(and(eq(tasks.leadId, leadId), eq(tasks.title, template.title), eq(tasks.status, 'Open')))
        .limit(1);
      if (existing?.count > 0) continue;

      let dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + template.daysOffset);
      // Bump weekend due dates to Monday
      if (dueDate.getDay() === 0) dueDate.setDate(dueDate.getDate() + 1);
      else if (dueDate.getDay() === 6) dueDate.setDate(dueDate.getDate() + 2);

      await this.addTask(leadId, template.title, template.description || null, dueDate, template.priority, lead?.ownerId || null, template.category, 'playbook', playbook.id);
    }
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
      .orderBy(tasks.dueDate);
  }

  // ── Pipeline Funnel Analytics ──

  async getStageFunnel(): Promise<{
    stage: string;
    entered: number;
    exited: number;
    conversionRate: number | null;
    avgDaysInStage: number | null;
    droppedCount: number;
    droppedPercent: number | null;
  }[]> {
    const enteredRows = await this.db
      .select({ stage: leadStageHistory.stage, count: count() })
      .from(leadStageHistory)
      .groupBy(leadStageHistory.stage);
    const enteredMap = new Map(enteredRows.map((r) => [r.stage, r.count]));

    const exitedRows = await this.db
      .select({ stage: leadStageHistory.stage, count: count() })
      .from(leadStageHistory)
      .where(isNotNull(leadStageHistory.exitedAt))
      .groupBy(leadStageHistory.stage);
    const exitedMap = new Map(exitedRows.map((r) => [r.stage, r.count]));

    const avgDaysMap = await this.getAvgDaysInAllStages();

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

  private async getAvgDaysInAllStages(): Promise<Map<string, number | null>> {
    const rows = await this.db
      .select({
        stage: leadStageHistory.stage,
        avgMs: sql<number>`AVG(${leadStageHistory.exitedAt} - ${leadStageHistory.enteredAt})`,
      })
      .from(leadStageHistory)
      .where(and(isNotNull(leadStageHistory.exitedAt), isNotNull(leadStageHistory.enteredAt)))
      .groupBy(leadStageHistory.stage);
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

  async checkAndAlertStaleLeads(): Promise<number> {
    const activeLeads = await this.db
      .select()
      .from(leads)
      .where(eq(leads.status, 'Active'));
    const thresholds = await this.db.select().from(stageThresholds);
    const [firstUser] = await this.db.select({ id: leads.ownerId }).from(leads).where(isNotNull(leads.ownerId)).limit(1);
    const fallbackUserId = firstUser?.id || null;
    let alertCount = 0;

    for (const lead of activeLeads) {
      if (lead.stage === 'Won' || lead.stage === 'Lost') continue;
      const ageDays = this.getDaysSinceStageChange(lead.stageUpdatedAt);
      if (ageDays === null) continue;
      const thresholdDays = thresholds.find((t) => t.stage === lead.stage)?.days ?? 5;

      if (ageDays >= thresholdDays * 0.8 && ageDays < thresholdDays) {
        const alreadyWarned = await this.hasRecentStaleNotification(lead.name, 48, 'Lead aging:');
        if (alreadyWarned) continue;
        const recipientId = lead.ownerId || fallbackUserId;
        if (recipientId) {
          await createNotification(
            this.db,
            recipientId,
            null,
            `Lead aging: ${lead.name}`,
            `${lead.name} has been in "${lead.stage}" for ${Math.round(ageDays)} days (${Math.round((ageDays / thresholdDays) * 100)}% of threshold).`,
            'INFO',
            `/leads/${lead.id}`,
          );
        }
      }

      if (ageDays >= thresholdDays) {
        const alreadyAlerted = await this.hasRecentStaleNotification(lead.name, 24, 'Lead stale:');
        if (alreadyAlerted) continue;
        const recipientId = lead.ownerId || fallbackUserId;
        if (recipientId) {
          await createNotification(
            this.db,
            recipientId,
            null,
            `Lead stale: ${lead.name}`,
            `${lead.name} has been idle in "${lead.stage}" for ${Math.round(ageDays)} days (threshold: ${thresholdDays}).`,
            'ERROR',
            `/leads/${lead.id}`,
          );
          alertCount++;
        }

        // Auto-queue outreach draft for stale leads in Outreach Sent or Follow-up
        if ((lead.stage === 'Outreach Sent' || lead.stage === 'Follow-up') && lead.ownerId) {
          const { jobRuns } = await import('../db/schema/research');
          const [existingJob] = await this.db
            .select({ id: jobRuns.id })
            .from(jobRuns)
            .where(and(eq(jobRuns.targetLeadId, lead.id), eq(jobRuns.jobType, 'OUTREACH_DRAFT'), inArray(jobRuns.status, ['QUEUED', 'RUNNING'])))
            .limit(1);
          if (!existingJob) {
            const jobId = crypto.randomUUID();
            await this.db.insert(jobRuns).values({
              id: jobId,
              jobType: 'OUTREACH_DRAFT',
              status: 'QUEUED',
              targetLeadId: lead.id,
              triggeredByUserId: lead.ownerId,
              externalRunId: 'STALE_AUTO',
              startedAt: null,
              finishedAt: null,
              createdAt: new Date(),
            });

            await this.addTask(
              lead.id,
              'Review auto-generated follow-up draft',
              `A follow-up draft was auto-queued because ${lead.name} has been idle in "${lead.stage}" for ${Math.round(ageDays)} days. Review and send.`,
              new Date(Date.now() + 24 * 60 * 60 * 1000),
              'High',
              lead.ownerId,
              'Follow-up',
              'playbook',
            );
          }
        }
      }
    }
    return alertCount;
  }

  private async hasRecentStaleNotification(leadName: string, withinHours: number, titlePrefix: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    const [row] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(and(isNull(notifications.jobRunId), like(notifications.title, `${titlePrefix} ${leadName}%`), gte(notifications.createdAt, cutoff)))
      .limit(1);
    return (row?.count ?? 0) > 0;
  }

  private getDaysSinceStageChange(stageUpdatedAt: Date | string | number | null | undefined): number | null {
    if (!stageUpdatedAt) return null;
    const ageMs = Date.now() - new Date(stageUpdatedAt).getTime();
    return ageMs / (24 * 60 * 60 * 1000);
  }

  // ── Next-Best-Action Engine ──

  async getNextBestActions(leadId: string, rules?: NBARule[]): Promise<NBAResult[]> {
    const lead = await this.getLead(leadId);
    if (!lead) return [];
    if (lead.status !== 'Active') return [];
    if (lead.stage === 'Won' || lead.stage === 'Lost') return [];

    const activeRules = rules || DEFAULT_NBA_RULES;
    const results: Array<NBAResult & { score: number }> = [];

    for (const rule of activeRules) {
      if (rule.weight <= 0) continue;
      const signalStrength = await this.evaluateSignal(lead, rule.signal);
      if (signalStrength <= 0) continue;
      const weighted = Math.round(signalStrength * rule.weight);
      results.push({ ...this.signalToAction(rule.signal, lead, signalStrength), score: weighted });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async isSignalDismissed(leadId: string, signal: NBASignal): Promise<boolean> {
    const [log] = await this.db
      .select({ id: nbaActionLogs.id })
      .from(nbaActionLogs)
      .where(and(
        eq(nbaActionLogs.leadId, leadId),
        eq(nbaActionLogs.signal, signal),
        eq(nbaActionLogs.resultStageTarget, 'DISMISSED')
      ))
      .limit(1);
    return !!log;
  }

  private async evaluateSignal(lead: any, signal: NBASignal): Promise<number> {
    if (await this.isSignalDismissed(lead.id, signal)) return 0;

    switch (signal) {
      case 'overdue_task': {
        const [row] = await this.db
          .select({ c: count() })
          .from(tasks)
          .where(and(eq(tasks.leadId, lead.id), eq(tasks.status, 'Open'), isNotNull(tasks.dueDate), lte(tasks.dueDate!, new Date())));
        const overdueCount = Math.min(row?.c ?? 0, 3);
        return overdueCount / 3;
      }
      case 'future_task': {
        const [row] = await this.db
          .select({ c: count() })
          .from(tasks)
          .where(and(eq(tasks.leadId, lead.id), eq(tasks.status, 'Open'), isNotNull(tasks.dueDate), gt(tasks.dueDate!, new Date())));
        return row?.c && row.c > 0 ? 0.5 : 0;
      }
      case 'stale': {
        const ageDays = this.getDaysSinceStageChange(lead.stageUpdatedAt);
        if (ageDays === null) return 0;
        const [tr] = await this.db.select({ days: stageThresholds.days }).from(stageThresholds).where(eq(stageThresholds.stage, lead.stage)).limit(1);
        const thresholdDays = tr?.days ?? 5;
        if (ageDays <= thresholdDays) return 0;
        const overBy = ageDays / thresholdDays;
        return Math.min(0.5 + (overBy - 1) * 0.25, 1.0);
      }
      case 'unsent_draft': {
        const [row] = await this.db
          .select({ c: count() })
          .from(outreachDrafts)
          .where(and(eq(outreachDrafts.leadId, lead.id), eq(outreachDrafts.status, 'DRAFT')));
        return row?.c && row.c > 0 ? 0.6 : 0;
      }
      case 'no_research': {
        const [row] = await this.db
          .select({ c: count() })
          .from(researchSnapshots)
          .where(eq(researchSnapshots.leadId, lead.id));
        return row?.c && row.c > 0 ? 0 : 1.0;
      }
      case 'no_audit': {
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
        return { action: 'Review and send outreach draft', type: 'outreach', priority: 'High', rationale: `${lead.name} has an unsent draft.`, link: `/leads/${lead.id}?tab=outreach` };
      case 'no_research':
        return { action: 'Start lead research', type: 'research', priority: 'High', rationale: `${lead.name} has no research snapshot.`, link: `/leads/${lead.id}?tab=research` };
      case 'no_audit':
        return { action: 'Run digital presence audit', type: 'audit', priority: 'Medium', rationale: `${lead.name} has not been audited.`, link: `/leads/${lead.id}?tab=audit` };
      case 'unread':
        return { action: 'Review new lead', type: 'review', priority: 'High', rationale: `${lead.name} is unread.`, link: `/leads/${lead.id}` };
      default:
        return { action: 'Review lead', type: 'review', priority: 'Low', rationale: `Review ${lead.name} for next steps.`, link: `/leads/${lead.id}` };
    }
  }

  async verifyStageRequirements(leadId: string, targetStage: string): Promise<string | null> {
    const [pc] = await this.db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1);
    const requirements = pc?.stageRequirements?.[targetStage];
    if (!requirements || requirements.length === 0) return null;

    for (const req of requirements) {
      if (req === 'require_research') {
        const [r] = await this.db.select({ count: count() }).from(researchSnapshots).where(eq(researchSnapshots.leadId, leadId));
        if (r.count === 0) return 'A Research Snapshot is required to enter this stage.';
      }
      if (req === 'require_audit') {
        const [r] = await this.db.select({ count: count() }).from(audits).where(eq(audits.leadId, leadId));
        if (r.count === 0) return 'A Digital Presence Audit is required to enter this stage.';
      }
      if (req === 'require_draft') {
        const [r] = await this.db.select({ count: count() }).from(outreachDrafts).where(eq(outreachDrafts.leadId, leadId));
        if (r.count === 0) return 'An Outreach Draft is required to enter this stage.';
      }
      if (req === 'require_contact_email') {
        const lead = await this.getLead(leadId);
        if (!lead?.email) return 'A contact email address is required to enter this stage.';
      }
    }
    return null;
  }

  async getUnmetStageRequirements(leadId: string, email: string | null): Promise<Record<string, string>> {
    const [pc] = await this.db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1);
    if (!pc || !pc.stageRequirements) return {};

    const [hasResearch] = await this.db.select({ count: count() }).from(researchSnapshots).where(eq(researchSnapshots.leadId, leadId));
    const [hasAudit] = await this.db.select({ count: count() }).from(audits).where(eq(audits.leadId, leadId));
    const [hasDraft] = await this.db.select({ count: count() }).from(outreachDrafts).where(eq(outreachDrafts.leadId, leadId));

    const blocked: Record<string, string> = {};

    for (const [stage, requirements] of Object.entries(pc.stageRequirements || {})) {
      if (!requirements || requirements.length === 0) continue;
      
      for (const req of requirements) {
        if (req === 'require_research' && hasResearch.count === 0) {
          blocked[stage] = 'A Research Snapshot is required to enter this stage.';
          break;
        }
        if (req === 'require_audit' && hasAudit.count === 0) {
          blocked[stage] = 'A Digital Presence Audit is required to enter this stage.';
          break;
        }
        if (req === 'require_draft' && hasDraft.count === 0) {
          blocked[stage] = 'An Outreach Draft is required to enter this stage.';
          break;
        }
        if (req === 'require_contact_email' && !email) {
          blocked[stage] = 'A contact email address is required to enter this stage.';
          break;
        }
      }
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

  async simulateNBARules(draftRules: NBARule[], limit = 5): Promise<(NBAResult & { leadName: string })[]> {
    const activeLeads = await this.db
      .select({ id: leads.id, name: leads.name })
      .from(leads)
      .where(eq(leads.status, 'Active'))
      .limit(50);

    const allResults: (NBAResult & { leadName: string })[] = [];

    for (const lead of activeLeads) {
      const actions = await this.getNextBestActions(lead.id, draftRules);
      if (actions.length > 0) {
        allResults.push({ ...actions[0], leadName: lead.name });
      }
    }

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
