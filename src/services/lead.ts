import { Db } from '../db';
import { eq, desc, and, isNull, isNotNull, count, gt, gte, lte, like, sql } from 'drizzle-orm';
import { leads, activities, activityMetadata, tasks, notes, leadStageHistory, pipelineConfig, stageThresholds, notifications } from '../db/schema/core';
import { researchSnapshots } from '../db/schema/research';
import { audits } from '../db/schema/audits';
import { outreachDrafts } from '../db/schema/outreach';
import { createNotification } from '@/lib/notifications';
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

  /**
   * Advance the lead to the given stage only if it's further along than the current stage.
   * No-op if already at or past the target stage.
   */


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

  async advanceStageIfEarlier(leadId: string, targetStage: PipelineStage) {
    const lead = await this.getLead(leadId);
    if (!lead) return;
    const currentIdx = PIPELINE_STAGES.indexOf(lead.stage as PipelineStage);
    const targetIdx = PIPELINE_STAGES.indexOf(targetStage);
    if (targetIdx < 0) return;
    if (currentIdx >= targetIdx) return; // already at or past target
    await this.updateStage(leadId, targetStage);
  }

  async getStageThresholds(): Promise<{ stage: string; days: number; updatedAt: Date | null }[]> {
    return this.db.select({ stage: stageThresholds.stage, days: stageThresholds.days, updatedAt: stageThresholds.updatedAt }).from(stageThresholds);
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
    await this.autoScheduleFollowUp(id, leadData.stage || 'New', '');

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

    // Recalculate baseline score immediately
    const scoringService = new ScoringService(this.db);
    await scoringService.recalculateScore(id);

    if (input.stage) {
      const updatedLead = await this.getLead(id);
      await this.triggerWorkflowIfOutreachSent(id, input.stage, oldLead.stage, updatedLead?.stageUpdatedAt);
      await this.autoScheduleFollowUp(id, input.stage, oldLead.stage);
    }

    return this.getLead(id);
  }

  async updateStage(id: string, newStage: string) {
    const now = new Date();
    const oldLead = await this.getLead(id);
    
    if (!oldLead) throw new Error('Lead not found');
    const oldStage = oldLead.stage;

    if (oldStage === newStage) return oldLead;

    // Check enforce-stage-order if enabled
    const [pc] = await this.db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1);
    if (pc?.enforceStageOrder) {
      const oldIdx = PIPELINE_STAGES.indexOf(oldStage as PipelineStage);
      const newIdx = PIPELINE_STAGES.indexOf(newStage as PipelineStage);
      if (newIdx > oldIdx + 1) {
        // Check intermediate stages
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

    const updatedLead = await this.getLead(id);
    await this.triggerWorkflowIfOutreachSent(id, newStage, oldStage, updatedLead?.stageUpdatedAt);
    await this.autoScheduleFollowUp(id, newStage, oldStage);

    return this.getLead(id);
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

  async addTask(leadId: string, title: string, description: string | null, dueDate: Date | null, priority: string, assigneeId?: string | null, category?: string | null) {
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

  private async autoScheduleFollowUp(leadId: string, newStage: string, oldStage: string) {
    const FOLLOWUP_CONFIG: Record<string, { title: string; description: string; days: number } | null> = {
      'Outreach Sent': {
        title: 'Follow up on outreach',
        description: `This lead was marked as Outreach Sent on ${new Date().toLocaleDateString()}. Schedule a follow-up touchpoint.`,
        days: 7,
      },
      Meeting: {
        title: 'Follow up on meeting',
        description: `This lead was marked as Meeting on ${new Date().toLocaleDateString()}. Send a recap and next steps.`,
        days: 3,
      },
    };

    const config = FOLLOWUP_CONFIG[newStage];
    if (!config || oldStage === newStage) return;

    const [existing] = await this.db
      .select({ count: count() })
      .from(tasks)
      .where(and(eq(tasks.leadId, leadId), eq(tasks.title, config.title), eq(tasks.status, 'Open')))
      .limit(1);

    if (existing?.count > 0) return;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + config.days);

    const [lead] = await this.db.select({ ownerId: leads.ownerId }).from(leads).where(eq(leads.id, leadId)).limit(1);
    await this.addTask(leadId, config.title, config.description, dueDate, 'High', lead?.ownerId || null);
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
        const alreadyWarned = await this.hasRecentStaleNotification(lead.id, 48, 'Lead aging:');
        if (alreadyWarned) continue;
        if (fallbackUserId) {
          await createNotification(
            this.db,
            fallbackUserId,
            null,
            `Lead aging: ${lead.name}`,
            `${lead.name} has been in "${lead.stage}" for ${Math.round(ageDays)} days (${Math.round((ageDays / thresholdDays) * 100)}% of threshold).`,
            'INFO',
            `/leads/${lead.id}`,
          );
        }
      }

      if (ageDays >= thresholdDays) {
        const alreadyAlerted = await this.hasRecentStaleNotification(lead.id, 24, 'Lead stale:');
        if (alreadyAlerted) continue;
        if (fallbackUserId) {
          await createNotification(
            this.db,
            fallbackUserId,
            null,
            `Lead stale: ${lead.name}`,
            `${lead.name} has been idle in "${lead.stage}" for ${Math.round(ageDays)} days (threshold: ${thresholdDays}).`,
            'ERROR',
            `/leads/${lead.id}`,
          );
          alertCount++;
        }
      }
    }
    return alertCount;
  }

  private async hasRecentStaleNotification(leadId: string, withinHours: number, titlePrefix: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    const [row] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(and(isNull(notifications.jobRunId), like(notifications.title, `${titlePrefix}%`), gte(notifications.createdAt!, cutoff)))
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

  private async evaluateSignal(lead: any, signal: NBASignal): Promise<number> {
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
