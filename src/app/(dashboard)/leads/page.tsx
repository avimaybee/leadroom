export const dynamic = 'force-dynamic';
import { getDb } from '@/db';
import { leads, leadScores, candidateLeads, discoveryScopes, tasks, stageThresholds, jobRuns } from '@/db/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';
import LeadsTableClient from '@/components/LeadsTableClient';
import { getUserId } from '@/lib/auth';

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ campaignId?: string; filter?: string; stage?: string }> }) {
  const db = getDb();
  const userId = await getUserId();
  if (!userId) {
    return <div className="p-8 text-center text-muted-foreground">Unauthorized. Please log in.</div>;
  }
  const resolvedParams = await searchParams;
  const campaignIdFilter = resolvedParams.campaignId;
  const activeFilter = resolvedParams.filter || 'all';
  const stageFilter = resolvedParams.stage;

  const [activeLeadsData, scores, campaigns, allTasks, thresholds, activeJobs, allScopes] = await Promise.all([
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
    }).from(leads).where(and(eq(leads.status, 'Active'), eq(leads.ownerId, userId))).orderBy(desc(leads.updatedAt)).limit(200),
    db.select({
      leadId: leadScores.leadId,
      scoreValue: leadScores.scoreValue,
      scoreLabel: leadScores.scoreLabel,
      rationaleSummary: leadScores.rationaleSummary,
    }).from(leadScores).where(eq(leadScores.isCurrent, 1)).limit(200),
    db.select({
      campaignId: discoveryScopes.id,
      campaignName: discoveryScopes.name,
      leadId: candidateLeads.promotedLeadId,
    }).from(discoveryScopes)
      .leftJoin(candidateLeads, eq(discoveryScopes.id, candidateLeads.discoveryScopeId))
      .where(eq(discoveryScopes.createdByUserId, userId)).limit(200),
    db.select({
      id: tasks.id,
      title: tasks.title,
      leadId: tasks.leadId,
      dueDate: tasks.dueDate,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      category: tasks.category,
    }).from(tasks).where(and(eq(tasks.status, 'Open'), eq(tasks.assigneeId, userId))).limit(200),
    db.select().from(stageThresholds),
    db.select({
      id: jobRuns.id,
      targetLeadId: jobRuns.targetLeadId,
      status: jobRuns.status,
      jobType: jobRuns.jobType,
    }).from(jobRuns).where(inArray(jobRuns.status, ['QUEUED', 'RUNNING'])).limit(200),
    db.select({ id: discoveryScopes.id, name: discoveryScopes.name }).from(discoveryScopes).where(eq(discoveryScopes.createdByUserId, userId)).orderBy(desc(discoveryScopes.createdAt)).limit(200),
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
  const enrichedLeads = activeLeadsData.map(lead => {
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

  let filteredLeads = campaignIdFilter
    ? enrichedLeads.filter(l => l.campaignId === campaignIdFilter) : enrichedLeads;

  if (stageFilter) {
    filteredLeads = filteredLeads.filter(l => l.stage === stageFilter);
  } else if (activeFilter === 'needs_research') {
    filteredLeads = filteredLeads.filter(l => l.stage === 'New' || l.stage === 'In Research');
  } else if (activeFilter === 'needs_audit') {
    filteredLeads = filteredLeads.filter(l => l.stage === 'Auditing' || l.stage === 'Audited');
  } else if (activeFilter === 'drafting') {
    filteredLeads = filteredLeads.filter(l => l.stage === 'Drafting' || l.stage === 'Ready to Send');
  } else if (activeFilter === 'follow_up_due') {
    filteredLeads = filteredLeads.filter(l => l.isFollowUpDue);
  } else if (activeFilter === 'stale') {
    filteredLeads = filteredLeads.filter(l => l.isStale);
  }

  let description = `Showing ${filteredLeads.length} of ${enrichedLeads.length} active leads.`;
  if (stageFilter) description = `Showing ${filteredLeads.length} active leads currently in the "${stageFilter}" stage.`;
  else if (activeFilter === 'needs_research') description = `Showing ${filteredLeads.length} leads requiring initial market research.`;
  else if (activeFilter === 'needs_audit') description = `Showing ${filteredLeads.length} leads requiring digital presence auditing.`;
  else if (activeFilter === 'drafting') description = `Showing ${filteredLeads.length} leads ready for outreach copy drafting.`;
  else if (activeFilter === 'follow_up_due') description = `Showing ${filteredLeads.length} leads with outstanding overdue follow-up tasks.`;
  else if (activeFilter === 'stale') description = `Showing ${filteredLeads.length} leads stalled in their current stage (inactive past threshold).`;

  return (
    <LeadsTableClient
      leads={filteredLeads as any}
      allScopes={allScopes}
      activeFilter={activeFilter}
      stageFilter={stageFilter}
      campaignIdFilter={campaignIdFilter}
      description={description}
      enrichedCount={enrichedLeads.length}
    />
  );
}
