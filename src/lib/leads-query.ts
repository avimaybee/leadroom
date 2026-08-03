import { type Db } from '@/db';
import { leads, leadScores, candidateLeads, discoveryScopes, tasks, stageThresholds, jobRuns } from '@/db/schema';
import { eq, desc, inArray, and, count } from 'drizzle-orm';

export interface EnrichedLead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  industry: string | null;
  stage: string;
  isRead: boolean;
  status: string;
  workspaceId: string | null;
  marketId: string | null;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  disqualifiedReason: string | null;
  ownerId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  stageUpdatedAt: Date | null;
  lastActivityAt: Date | null;
  isFollowUpDue: boolean;
  overdueTasks: any[];
  openTasks: any[];
  isStale: boolean;
  stageAgeDays: number;
  activeJob: { status: string; jobType: string } | null;
  scoreValue: number | null;
  scoreLabel: string | null;
  rationaleSummary: string | null;
  campaignId: string | null;
  campaignName: string | null;
}

/**
 * Fetch a page of active leads for a user with the full enrichment set
 * (scores, campaigns, tasks, stale flags, active jobs).
 * Shared between the server-rendered leads page and the "load more" action
 * so pagination stays consistent.
 */
export async function fetchEnrichedLeadsPage(
  db: Db,
  userId: string,
  options: { offset?: number; limit?: number } = {}
) {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 200;

  const [activeLeadsData, totalRow, scores, campaigns, allTasks, thresholds, activeJobs] = await Promise.all([
    db.select({
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
      disqualifiedReason: leads.disqualifiedReason,
      ownerId: leads.ownerId,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      stageUpdatedAt: leads.stageUpdatedAt,
      lastActivityAt: leads.lastActivityAt,
    }).from(leads).where(and(eq(leads.status, 'Active'), eq(leads.ownerId, userId))).orderBy(desc(leads.updatedAt)).limit(limit).offset(offset),
    db.select({ count: count() }).from(leads).where(and(eq(leads.status, 'Active'), eq(leads.ownerId, userId))),
    db.select({
      leadId: leadScores.leadId,
      scoreValue: leadScores.scoreValue,
      scoreLabel: leadScores.scoreLabel,
      rationaleSummary: leadScores.rationaleSummary,
    }).from(leadScores).where(eq(leadScores.isCurrent, 1)),
    db.select({
      campaignId: discoveryScopes.id,
      campaignName: discoveryScopes.name,
      leadId: candidateLeads.promotedLeadId,
    }).from(discoveryScopes)
      .leftJoin(candidateLeads, eq(discoveryScopes.id, candidateLeads.discoveryScopeId))
      .where(eq(discoveryScopes.createdByUserId, userId)),
    db.select({
      id: tasks.id,
      title: tasks.title,
      leadId: tasks.leadId,
      dueDate: tasks.dueDate,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      category: tasks.category,
    }).from(tasks).where(and(eq(tasks.status, 'Open'), eq(tasks.assigneeId, userId))),
    db.select().from(stageThresholds),
    db.select({
      id: jobRuns.id,
      targetLeadId: jobRuns.targetLeadId,
      status: jobRuns.status,
      jobType: jobRuns.jobType,
    }).from(jobRuns).where(inArray(jobRuns.status, ['QUEUED', 'RUNNING'])),
  ]);

  const scoreMap = new Map(scores.map(s => [s.leadId, { scoreValue: s.scoreValue, scoreLabel: s.scoreLabel, rationaleSummary: s.rationaleSummary }]));
  const campaignMap = new Map(campaigns.filter(c => c.leadId).map(c => [c.leadId!, { campaignId: c.campaignId, campaignName: c.campaignName }]));
  const activeJobsMap = new Map();
  activeJobs.forEach(job => {
    if (job.targetLeadId) {
      activeJobsMap.set(job.targetLeadId, { status: job.status, jobType: job.jobType });
    }
  });

  const tasksByLeadId = new Map<string, typeof allTasks>();
  for (const task of allTasks) {
    if (!task.leadId) continue;
    let arr = tasksByLeadId.get(task.leadId);
    if (!arr) { arr = []; tasksByLeadId.set(task.leadId, arr); }
    arr.push(task);
  }

  const now = Date.now();
  const enrichedLeads: EnrichedLead[] = activeLeadsData.map(lead => {
    const leadTasks = tasksByLeadId.get(lead.id) || [];
    let isFollowUpDue = false;
    let overdueTasks: typeof leadTasks = [];
    let openTasks: typeof leadTasks = [];
    for (const t of leadTasks) {
      const taskDue = t.dueDate ? new Date(t.dueDate).getTime() : NaN;
      if (!isNaN(taskDue) && taskDue < now) {
        isFollowUpDue = true;
        overdueTasks.push(t);
      }
      if ((t as any).status === 'Open') openTasks.push(t);
    }
    const stageThreshold = thresholds.find(t => t.stage === lead.stage)?.days ?? 5;
    const stageAgeDays = lead.stageUpdatedAt
      ? (now - new Date(lead.stageUpdatedAt).getTime()) / (1000 * 60 * 60 * 24) : 0;
    const isStale = stageAgeDays > stageThreshold;
    const activeJob = activeJobsMap.get(lead.id);
    return {
      ...lead,
      isFollowUpDue,
      overdueTasks,
      openTasks,
      isStale,
      stageAgeDays,
      activeJob: activeJob || null,
      ...(scoreMap.get(lead.id) || { scoreValue: null, scoreLabel: null, rationaleSummary: null }),
      ...(campaignMap.get(lead.id) || { campaignId: null, campaignName: null }),
    };
  });

  return { leads: enrichedLeads, total: Number(totalRow[0]?.count ?? 0) };
}

export interface LeadFilterParams {
  campaignIdFilter?: string;
  activeFilter?: string;
  stageFilter?: string;
}

export function applyLeadFilters<T>(leads: T[], filters: LeadFilterParams): T[] {
  const { campaignIdFilter, activeFilter, stageFilter } = filters;

  let filtered = campaignIdFilter
    ? leads.filter(l => (l as any).campaignId === campaignIdFilter)
    : leads;

  if (stageFilter) {
    filtered = filtered.filter(l => (l as any).stage === stageFilter);
  } else if (activeFilter === 'needs_research') {
    filtered = filtered.filter(l => (l as any).stage === 'New' || (l as any).stage === 'In Research');
  } else if (activeFilter === 'needs_audit') {
    filtered = filtered.filter(l => (l as any).stage === 'Auditing' || (l as any).stage === 'Audited');
  } else if (activeFilter === 'drafting') {
    filtered = filtered.filter(l => (l as any).stage === 'Drafting' || (l as any).stage === 'Ready to Send');
  } else if (activeFilter === 'follow_up_due') {
    filtered = filtered.filter(l => (l as any).isFollowUpDue);
  } else if (activeFilter === 'stale') {
    filtered = filtered.filter(l => (l as any).isStale);
  }

  return filtered;
}
