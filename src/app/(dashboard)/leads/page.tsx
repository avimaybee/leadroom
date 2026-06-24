export const dynamic = 'force-dynamic';
import { getDb } from '@/db';
import { leads, leadScores, candidateLeads, discoveryScopes, tasks, stageThresholds } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import LeadsTableClient from '@/components/LeadsTableClient';

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ campaignId?: string; filter?: string; stage?: string }> }) {
  const db = getDb();
  const resolvedParams = await searchParams;
  const campaignIdFilter = resolvedParams.campaignId;
  const activeFilter = resolvedParams.filter || 'all';
  const stageFilter = resolvedParams.stage;

  const [activeLeadsData, scores, campaigns, allTasks, thresholds] = await Promise.all([
    db.select().from(leads).where(eq(leads.status, 'Active')).orderBy(desc(leads.updatedAt)),
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
      .leftJoin(candidateLeads, eq(discoveryScopes.id, candidateLeads.discoveryScopeId)),
    db.select().from(tasks).where(eq(tasks.status, 'Open')),
    db.select().from(stageThresholds),
  ]);

  const allScopes = await db.select({ id: discoveryScopes.id, name: discoveryScopes.name }).from(discoveryScopes).orderBy(desc(discoveryScopes.createdAt));

  const scoreMap = new Map(scores.map(s => [s.leadId, { scoreValue: s.scoreValue, scoreLabel: s.scoreLabel, rationaleSummary: s.rationaleSummary }]));
  const campaignMap = new Map(campaigns.filter(c => c.leadId).map(c => [c.leadId!, { campaignId: c.campaignId, campaignName: c.campaignName }]));

  const enrichedLeads = activeLeadsData.map(lead => {
    const leadTasks = allTasks.filter(t => t.leadId === lead.id);
    const isFollowUpDue = leadTasks.some(t => t.dueDate && new Date(t.dueDate) < new Date());
    const overdueTasks = leadTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
    const openTasks = leadTasks.filter(t => t.status === 'Open');
    const stageThreshold = thresholds.find(t => t.stage === lead.stage)?.days ?? 5;
    const stageAgeDays = lead.stageUpdatedAt 
      ? (new Date().getTime() - new Date(lead.stageUpdatedAt).getTime()) / (1000 * 60 * 60 * 24) : 0;
    const isStale = stageAgeDays > stageThreshold;

    return {
      ...lead,
      isFollowUpDue,
      overdueTasks,
      openTasks,
      isStale,
      stageAgeDays,
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
