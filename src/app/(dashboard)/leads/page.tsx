export const dynamic = 'force-dynamic';
import { getDb } from '@/db';
import { discoveryScopes } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import LeadsTableClient from '@/components/LeadsTableClient';
import { getUserId } from '@/lib/auth';
import { fetchEnrichedLeadsPage } from '@/lib/leads-query';

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

  const [pageData, allScopes] = await Promise.all([
    fetchEnrichedLeadsPage(db, userId, { offset: 0, limit: 200 }),
    db.select({ id: discoveryScopes.id, name: discoveryScopes.name }).from(discoveryScopes).where(eq(discoveryScopes.createdByUserId, userId)).orderBy(desc(discoveryScopes.createdAt)).limit(500),
  ]);

  const { leads: activeLeadsData, total: totalCount } = pageData;

  let filteredLeads = campaignIdFilter
    ? activeLeadsData.filter(l => l.campaignId === campaignIdFilter) : activeLeadsData;

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

  let description = `Showing ${filteredLeads.length} of ${totalCount} active leads.`;
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
      enrichedCount={totalCount}
      totalCount={totalCount}
    />
  );
}
