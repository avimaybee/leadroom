export const dynamic = 'force-dynamic';
import { getDb } from '@/db';
import Link from 'next/link';
import { Users, ExternalLink, Calendar, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { leads, leadScores, candidateLeads, discoveryScopes, tasks, stageThresholds } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { CampaignFilter } from './CampaignFilter';
import LeadRowActions from './LeadRowActions';
import { formatUTC } from '@/lib/date';
import { Badge } from '@/components/ui/badge';

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
      ? (new Date().getTime() - new Date(lead.stageUpdatedAt).getTime()) / (1000 * 60 * 60 * 24)
      : 0;
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
    ? enrichedLeads.filter(l => l.campaignId === campaignIdFilter)
    : enrichedLeads;

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

  // Dynamic header summary based on selection
  let description = `Showing ${filteredLeads.length} of ${enrichedLeads.length} active leads.`;
  if (stageFilter) {
    description = `Showing ${filteredLeads.length} active leads currently in the "${stageFilter}" stage.`;
  } else if (activeFilter === 'needs_research') {
    description = `Showing ${filteredLeads.length} leads requiring initial market research.`;
  } else if (activeFilter === 'needs_audit') {
    description = `Showing ${filteredLeads.length} leads requiring digital presence auditing.`;
  } else if (activeFilter === 'drafting') {
    description = `Showing ${filteredLeads.length} leads ready for outreach copy drafting.`;
  } else if (activeFilter === 'follow_up_due') {
    description = `Showing ${filteredLeads.length} leads with outstanding overdue follow-up tasks.`;
  } else if (activeFilter === 'stale') {
    description = `Showing ${filteredLeads.length} leads stalled in their current stage (inactive past threshold).`;
  }

  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case 'In Research':
        return 'bg-chart-5/10 text-chart-5 border border-chart-5/20';
      case 'Auditing':
        return 'bg-chart-3/10 text-chart-3 border border-chart-3/20';
      case 'Audited':
        return 'bg-chart-2/10 text-chart-2 border border-chart-2/20';
      case 'Drafting':
        return 'bg-primary/10 text-primary border border-primary/20';
      case 'Ready to Send':
        return 'bg-chart-4/10 text-chart-4 border border-chart-4/20';
      case 'Outreach Sent':
        return 'bg-primary/20 text-primary border border-primary/30';
      case 'Meeting':
        return 'bg-destructive/10 text-destructive border border-destructive/20';
      case 'Won':
        return 'bg-chart-2/20 text-chart-2 border border-chart-2/30';
      case 'Lost':
        return 'bg-destructive/20 text-destructive border border-destructive/30';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const FILTER_OPTIONS = [
    { value: 'all', label: 'All Leads' },
    { value: 'needs_research', label: 'Needs Research' },
    { value: 'needs_audit', label: 'Needs Audit' },
    { value: 'drafting', label: 'Drafting' },
    { value: 'follow_up_due', label: 'Follow-up Due' },
    { value: 'stale', label: 'Stale' },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Page Header */}
      <header className="space-y-4 border-b border-border/70 pb-6">
        <nav className="flex items-center gap-2 text-label-14 text-muted-foreground">
          <span className="font-medium text-foreground">Leads</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-heading-3xl text-card-foreground">Active Leads</h1>
            <p className="text-copy-14 text-muted-foreground mt-1.5 leading-relaxed">
              {description}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 lg:mt-1">
            <Link href="/leads/new" className={buttonVariants({ variant: 'default' })}>
              + New Lead
            </Link>
          </div>
        </div>
      </header>

      {/* Filter / Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-2">
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/25 p-1 w-fit">
          {FILTER_OPTIONS.map((opt) => {
            const isSelected = activeFilter === opt.value && !stageFilter;
            const nextParams = new URLSearchParams();
            if (campaignIdFilter) nextParams.set('campaignId', campaignIdFilter);
            if (opt.value !== 'all') nextParams.set('filter', opt.value);
            const href = `/leads?${nextParams.toString()}`;

            return (
              <Link
                key={opt.value}
                href={href}
                className={`inline-flex min-h-8 items-center justify-center rounded-md px-3.5 text-label-12 font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? 'bg-card text-foreground shadow-sm font-semibold border border-border/40'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          {stageFilter && (
            <Link
              href="/leads"
              className="text-label-12 text-primary font-semibold hover:underline"
            >
              Clear Stage Filter ({stageFilter})
            </Link>
          )}
          <CampaignFilter scopes={allScopes} defaultValue={campaignIdFilter || ''} />
        </div>
      </div>

      {/* Leads Content */}
      {filteredLeads.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center max-w-xl mx-auto mt-8 space-y-6">
          <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center text-primary mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-heading-lg text-card-foreground">No active leads found</h3>
            <p className="text-copy-14 text-muted-foreground max-w-md mx-auto leading-relaxed">
              No active leads match the current filters. Adjust your filters or add a new pipeline prospect manually.
            </p>
          </div>
          <div className="flex justify-center items-center gap-3 pt-2">
            <Link href="/leads/new" className={buttonVariants({ variant: 'default' })}>
              + Add New Lead
            </Link>
            <Link href="/leads" className={buttonVariants({ variant: 'outline' })}>
              Reset Filters
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-left">
                <thead className="bg-muted text-muted-foreground text-label-12 uppercase">
                  <tr>
                    <th className="px-6 py-4">Prospect Details</th>
                    <th className="px-6 py-4">Campaign</th>
                    <th className="px-6 py-4">Pipeline Stage</th>
                    <th className="px-6 py-4">Priority / Drivers</th>
                    <th className="px-6 py-4">Next Action</th>
                    <th className="px-6 py-4">Last Active</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card text-copy-14 text-foreground font-medium">
                  {filteredLeads.map((lead: any) => {
                    // Next action determination
                    let nextActionText = 'No next action scheduled';
                    let nextActionType: 'none' | 'overdue' | 'future' | 'stale' = 'none';

                    if (lead.overdueTasks && lead.overdueTasks.length > 0) {
                      nextActionText = `Overdue task: ${lead.overdueTasks[0].title}`;
                      nextActionType = 'overdue';
                    } else if (lead.openTasks && lead.openTasks.length > 0) {
                      const nextTask = lead.openTasks.reduce((earliest: any, current: any) => {
                        if (!earliest.dueDate) return current;
                        if (!current.dueDate) return earliest;
                        return new Date(current.dueDate) < new Date(earliest.dueDate) ? current : earliest;
                      }, lead.openTasks[0]);
                      nextActionText = `${nextTask.title} (due ${formatUTC(nextTask.dueDate)})`;
                      nextActionType = 'future';
                    } else if (lead.isStale) {
                      nextActionText = `Stale: ${Math.floor(lead.stageAgeDays)}d idle in ${lead.stage}`;
                      nextActionType = 'stale';
                    }

                    return (
                      <tr key={lead.id} className="hover:bg-muted/30 transition duration-150">
                        {/* 1. Prospect Details */}
                        <td className="px-6 py-4 min-w-[220px]">
                          <Link href={`/leads/${lead.id}`} className="hover:underline group block">
                            <div className="font-semibold text-card-foreground text-label-14 leading-snug group-hover:text-primary transition-colors max-w-[240px] truncate">
                              {lead.name}
                            </div>
                          </Link>
                          <div className="flex flex-col gap-0.5 mt-1 text-label-12 text-muted-foreground font-semibold">
                            {lead.company && (
                              <div className="text-foreground/80 truncate max-w-[200px]">{lead.company}</div>
                            )}
                            {lead.website && (
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary/95 hover:underline flex items-center gap-1 w-fit mt-0.5"
                              >
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate max-w-[180px]">{lead.website.replace(/^https?:\/\//, '')}</span>
                              </a>
                            )}
                            {lead.email && <div className="truncate max-w-[200px] mt-0.5">{lead.email}</div>}
                          </div>
                        </td>

                        {/* 2. Campaign */}
                        <td className="px-6 py-4">
                          {lead.campaignName ? (
                            <Link
                              href={`/scopes/${lead.campaignId}`}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold bg-muted text-muted-foreground border border-border/70 uppercase tracking-wide hover:bg-muted hover:text-foreground transition-colors"
                            >
                              {lead.campaignName}
                            </Link>
                          ) : (
                            <span className="text-label-12 text-muted-foreground italic font-medium">Manual Entry</span>
                          )}
                        </td>

                        {/* 3. Pipeline Stage */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-label-12 font-semibold ${getStageBadgeClass(lead.stage)}`}>
                            {lead.stage}
                          </span>
                        </td>

                        {/* 4. Priority / Drivers */}
                        <td className="px-6 py-4 max-w-[240px]">
                          {lead.scoreValue !== null && lead.scoreValue !== undefined ? (
                            <div className="space-y-1">
                              <span
                                aria-label={`${lead.scoreLabel} Priority, score ${lead.scoreValue} out of 100`}
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold border ${
                                  lead.scoreLabel === 'High' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                  lead.scoreLabel === 'Medium' ? 'bg-chart-3/15 text-chart-3 border-chart-3/30' :
                                  'bg-muted text-muted-foreground border-border'
                                }`}
                              >
                                <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                                  lead.scoreLabel === 'High' ? 'bg-destructive animate-pulse' :
                                  lead.scoreLabel === 'Medium' ? 'bg-chart-3' : 'bg-muted-foreground'
                                }`} />
                                {lead.scoreLabel} ({lead.scoreValue})
                              </span>
                              {lead.rationaleSummary && (
                                <p className="text-label-12 text-muted-foreground leading-normal line-clamp-2 font-medium">
                                  {lead.rationaleSummary}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold border bg-muted/40 text-muted-foreground border-border/60">
                              Unassessed
                            </span>
                          )}
                        </td>

                        {/* 5. Next Action */}
                        <td className="px-6 py-4 max-w-[200px]">
                          <div className="flex items-center gap-1.5 text-label-12 font-semibold">
                            {nextActionType === 'overdue' && (
                              <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
                            )}
                            {nextActionType === 'stale' && (
                              <Clock className="w-4 h-4 text-chart-5 shrink-0" />
                            )}
                            <span className={`line-clamp-2 leading-snug ${
                              nextActionType === 'overdue' ? 'text-destructive font-semibold' :
                              nextActionType === 'stale' ? 'text-chart-5 font-semibold' :
                              'text-muted-foreground'
                            }`}>
                              {nextActionText}
                            </span>
                          </div>
                        </td>

                        {/* 6. Last Active */}
                        <td className="px-6 py-4 text-label-12 text-muted-foreground font-semibold">
                          {formatUTC(lead.updatedAt)}
                        </td>

                        {/* 7. Actions */}
                        <td className="px-6 py-4 text-right">
                          <LeadRowActions leadId={lead.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden space-y-4">
            {filteredLeads.map((lead: any) => {
              // Next action determination for mobile
              let nextActionText = 'No next action';
              let nextActionType: 'none' | 'overdue' | 'future' | 'stale' = 'none';

              if (lead.overdueTasks && lead.overdueTasks.length > 0) {
                nextActionText = `Overdue task: ${lead.overdueTasks[0].title}`;
                nextActionType = 'overdue';
              } else if (lead.openTasks && lead.openTasks.length > 0) {
                const nextTask = lead.openTasks[0];
                nextActionText = `${nextTask.title} (due ${formatUTC(nextTask.dueDate)})`;
                nextActionType = 'future';
              } else if (lead.isStale) {
                nextActionText = `Stale: ${Math.floor(lead.stageAgeDays)}d idle in ${lead.stage}`;
                nextActionType = 'stale';
              }

              return (
                <div
                  key={lead.id}
                  className={`bg-card rounded-xl border border-border p-5 space-y-4 relative overflow-hidden border-l-4 ${
                    lead.scoreLabel === 'High' ? 'border-l-destructive' :
                    lead.scoreLabel === 'Medium' ? 'border-l-chart-3' : 'border-l-muted'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <Link href={`/leads/${lead.id}`} className="hover:underline block">
                        <h4 className="font-semibold text-card-foreground heading-lg truncate leading-snug">
                          {lead.name}
                        </h4>
                      </Link>
                      {lead.company && (
                        <p className="text-label-12 text-muted-foreground font-semibold mt-0.5">{lead.company}</p>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold ${getStageBadgeClass(lead.stage)}`}>
                        {lead.stage}
                      </span>
                      <LeadRowActions leadId={lead.id} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-label-12 border-t border-border/50 pt-3 font-semibold text-muted-foreground">
                    <div>
                      <span className="block text-label-12 uppercase text-muted-foreground/80">Priority</span>
                      {lead.scoreValue !== null ? (
                        <span className="text-foreground font-semibold">{lead.scoreLabel} ({lead.scoreValue})</span>
                      ) : (
                        <span>Unassessed</span>
                      )}
                    </div>
                    {lead.campaignName && (
                      <div>
                        <span className="block text-label-12 uppercase text-muted-foreground/80">Campaign</span>
                        <span className="text-foreground truncate block max-w-full">{lead.campaignName}</span>
                      </div>
                    )}
                  </div>

                  <div className={`p-2.5 rounded-md border text-label-12 font-semibold leading-relaxed flex items-center gap-2 ${
                    nextActionType === 'overdue' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                    nextActionType === 'stale' ? 'bg-chart-5/10 border-chart-5/20 text-chart-5' :
                    'bg-muted/40 border-border/60 text-muted-foreground'
                  }`}>
                    {nextActionType === 'overdue' && <ShieldAlert className="w-4 h-4 shrink-0" />}
                    {nextActionType === 'stale' && <Clock className="w-4 h-4 shrink-0" />}
                    <span className="truncate">{nextActionText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
