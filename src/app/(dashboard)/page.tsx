export const dynamic = 'force-dynamic';
import { LeadService } from '@/services/lead';
import { DiscoveryService } from '@/services/discovery';
import { getDb } from '@/db';
import { prospects, stageThresholds } from '@/db/schema/core';
import { getUserId } from '@/lib/auth';
import { eq, sql, count } from 'drizzle-orm';
import Link from 'next/link';
import { Users, Search, AlertTriangle, CheckSquare, Clock, ArrowRight, Layers, FileText, CheckCircle2, Target } from 'lucide-react';
import UnifiedFeedLoader from '@/app/(dashboard)/UnifiedFeedLoader';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const TIER_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  tier1: { variant: 'default', label: 'Tier 1' },
  tier2: { variant: 'secondary', label: 'Tier 2' },
  tier3: { variant: 'outline', label: 'Tier 3' },
  disqualified: { variant: 'destructive', label: 'Disqualified' },
};

export default async function DashboardPage() {
  const db = getDb();
  const userId = await getUserId();

  const leadService = new LeadService(db);
  const discoveryService = new DiscoveryService(db);

  const NOW = Date.now();
  const NOW_SECONDS = Math.floor(NOW / 1000);

  // SQL aggregation: stage counts for pipeline distribution
  const stageCountRows = await db
    .select({
      stage: prospects.stage,
      count: count(),
    })
    .from(prospects)
    .where(eq(prospects.status, 'Active'))
    .groupBy(prospects.stage);

  // SQL aggregation: stale leads by stage (using stageUpdatedAt)
  const staleRows = await db
    .select({
      stage: prospects.stage,
      count: count(),
    })
    .from(prospects)
    .innerJoin(stageThresholds, eq(prospects.stage, stageThresholds.stage))
    .where(
      sql`${prospects.status} = 'Active'
          AND ${prospects.stageUpdatedAt} IS NOT NULL
          AND (${NOW_SECONDS} - ${prospects.stageUpdatedAt}) > ${stageThresholds.days} * 86400`
    )
    .groupBy(prospects.stage);

  // SQL aggregation: research/audit/outreach stage counts
  const [needResearchRow] = await db
    .select({ count: count() })
    .from(prospects)
    .where(sql`${prospects.status} = 'Active' AND (${prospects.stage} = 'New' OR ${prospects.stage} = 'In Research')`);

  const [needAuditRow] = await db
    .select({ count: count() })
    .from(prospects)
    .where(sql`${prospects.status} = 'Active' AND (${prospects.stage} = 'Auditing' OR ${prospects.stage} = 'Audited')`);

  const [outreachReadyRow] = await db
    .select({ count: count() })
    .from(prospects)
    .where(sql`${prospects.status} = 'Active' AND (${prospects.stage} = 'Drafting' OR ${prospects.stage} = 'Ready to Send')`);

  const [totalActiveRow] = await db
    .select({ count: count() })
    .from(prospects)
    .where(eq(prospects.status, 'Active'));

  const totalLeads = totalActiveRow?.count ?? 0;
  const leadsNeedingResearch = needResearchRow?.count ?? 0;
  const leadsNeedingAudit = needAuditRow?.count ?? 0;
  const leadsOutreachReady = outreachReadyRow?.count ?? 0;
  let staleLeadsCount = staleRows.reduce((s, r) => s + r.count, 0);

  const stageCounts: Record<string, number> = {};
  for (const r of stageCountRows) {
    stageCounts[r.stage] = r.count;
  }

  const staleByStage = staleRows.map((r) => ({ stage: r.stage, count: r.count, maxDays: 0 }));

  const stages = [
    'New', 'In Research', 'Auditing', 'Audited', 'Drafting',
    'Ready to Send', 'Outreach Sent', 'Meeting', 'Won', 'Lost',
  ];

  const [scopes, funnel, scoredProspects] = await Promise.all([
    discoveryService.listScopes(),
    leadService.getStageFunnel(),
    userId ? leadService.getDashboardProspects(userId) : Promise.resolve([]),
  ]);

  const activeScopesCount = scopes.length;
  const pendingCandidatesCount = await discoveryService.countPendingCandidates();

  const dashboardTasks = await leadService.getDashboardTasks();
  const overdueTasksCount = dashboardTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date()
  ).length;

  // My Tasks
  let myTasks: any[] = [];
  let overdueMyTasks = 0;
  if (userId) {
    myTasks = await leadService.getMyTasks(userId);
    overdueMyTasks = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;
  }

  // Dynamic summary
  const summaryParts = [];
  if (overdueTasksCount > 0) {
    summaryParts.push(`${overdueTasksCount} task${overdueTasksCount === 1 ? '' : 's'} overdue`);
  }
  if (staleLeadsCount > 0) {
    summaryParts.push(`${staleLeadsCount} stale lead${staleLeadsCount === 1 ? '' : 's'}`);
  }
  if (leadsOutreachReady > 0) {
    summaryParts.push(`${leadsOutreachReady} lead${leadsOutreachReady === 1 ? '' : 's'} ready for outreach`);
  }
  if (pendingCandidatesCount > 0) {
    summaryParts.push(`${pendingCandidatesCount} candidate${pendingCandidatesCount === 1 ? '' : 's'} to review`);
  }
  const dynamicSummary = summaryParts.length > 0
    ? `${summaryParts.join(', ')}.`
    : 'All caught up. No urgent items require attention.';

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* App Shell Header */}
      <header className="space-y-4 border-b border-border/70 pb-6">
        <nav className="flex items-center gap-2 text-copy-14 text-muted-foreground">
          <span className="font-medium text-foreground">Dashboard</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-heading-4xl text-card-foreground">Leadroom</h1>
            <p className="text-copy-14 text-muted-foreground mt-1.5 leading-relaxed">
              Pipeline orientation &bull; <span className="font-semibold text-foreground">{dynamicSummary}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 lg:mt-1">
            <Link href="/scopes/new" className={buttonVariants({ variant: 'default' })}>
              Start Discovery
            </Link>
            <Link href="/leads/new" className={buttonVariants({ variant: 'outline' })}>
              Add Lead
            </Link>
          </div>
        </div>
      </header>

      {/* Action-First Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Overdue card */}
        <Link
          href="/leads?filter=follow_up_due"
          className={`group p-4 rounded-lg border transition-all flex flex-col justify-between h-28 ${
            overdueTasksCount > 0
              ? 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/15'
              : 'bg-card border-border hover:border-primary/45 hover:shadow-sm'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-label-12 uppercase opacity-90">Follow-up Due</span>
            <CheckSquare className="w-4 h-4 opacity-70 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <h3 className="text-heading-2xl">{overdueTasksCount}</h3>
            <p className="text-label-12 opacity-80 mt-1">Overdue tasks</p>
          </div>
        </Link>

        {/* Needs Research card */}
        <Link
          href="/leads?filter=needs_research"
          className="group bg-card p-4 rounded-lg border border-border hover:border-primary/45 hover:shadow-sm transition-all flex flex-col justify-between h-28"
        >
          <div className="flex justify-between items-center">
            <span className="text-label-12 uppercase text-muted-foreground">Needs Research</span>
            <Search className="w-4 h-4 text-muted-foreground group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <h3 className="text-heading-2xl text-foreground">{leadsNeedingResearch}</h3>
            <p className="text-label-12 text-muted-foreground mt-1">In research stage</p>
          </div>
        </Link>

        {/* Stale Leads card */}
        <Link
          href="/leads?filter=stale"
          className={`group p-4 rounded-lg border transition-all flex flex-col justify-between h-28 ${
            staleLeadsCount > 0
              ? 'bg-chart-5/10 border-chart-5/30 text-chart-5 hover:bg-chart-5/15'
              : 'bg-card border-border hover:border-primary/45 hover:shadow-sm'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-label-12 uppercase opacity-90">Stale Leads</span>
            <Clock className="w-4 h-4 opacity-70 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <h3 className="text-heading-2xl">{staleLeadsCount}</h3>
            <p className="text-label-12 opacity-80 mt-1">{staleLeadsCount === 1 ? 'Lead is' : 'Leads are'} past threshold</p>
          </div>
        </Link>

        {/* Outreach Ready card */}
        <Link
          href="/leads?filter=drafting"
          className="group bg-card p-4 rounded-lg border border-border hover:border-primary/45 hover:shadow-sm transition-all flex flex-col justify-between h-28"
        >
          <div className="flex justify-between items-center">
            <span className="text-label-12 uppercase text-muted-foreground">Outreach Ready</span>
            <FileText className="w-4 h-4 text-muted-foreground group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <h3 className="text-heading-2xl text-foreground">{leadsOutreachReady}</h3>
            <p className="text-label-12 text-muted-foreground mt-1">Drafting & ready stage</p>
          </div>
        </Link>

        {/* Pending Candidates card */}
        <Link
          href="/scopes?filter=pending"
          className="group bg-card p-4 rounded-lg border border-border hover:border-primary/45 hover:shadow-sm transition-all flex flex-col justify-between h-28 col-span-2 md:col-span-1"
        >
          <div className="flex justify-between items-center">
            <span className="text-label-12 uppercase text-muted-foreground">Pending Triages</span>
            <AlertTriangle className="w-4 h-4 text-muted-foreground group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <h3 className="text-heading-2xl text-foreground">{pendingCandidatesCount}</h3>
            <p className="text-label-12 text-muted-foreground mt-1">Candidates to triage</p>
          </div>
        </Link>
      </div>

      {/* Ready to Review — Command Center */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h2 className="text-label-14 text-foreground uppercase">Ready to Review</h2>
          </div>
          <span className="text-label-12 text-muted-foreground">{scoredProspects.length} prospect{scoredProspects.length === 1 ? '' : 's'}</span>
        </div>
        {scoredProspects.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Target className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-copy-14 text-muted-foreground">Add prospects and run research to see your command center.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-copy-13">
              <thead>
                <tr className="text-label-12 text-muted-foreground border-b border-border">
                  <th className="text-left py-3 px-6">Company</th>
                  <th className="text-right py-3 px-4">Fit Score</th>
                  <th className="text-right py-3 px-4">Confidence</th>
                  <th className="text-center py-3 px-4">Priority</th>
                  <th className="text-left py-3 px-4">Top Signal</th>
                  <th className="text-right py-3 px-4">Updated</th>
                  <th className="text-center py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {scoredProspects.slice(0, 20).map((p, idx) => {
                  const tier = TIER_BADGE[p.priorityTier as keyof typeof TIER_BADGE] || TIER_BADGE.tier3;
                  return (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-6 font-medium text-foreground">{p.company || p.name}</td>
                      <td className={`text-right py-3 px-4 font-semibold ${(p.fitScore ?? 0) >= 70 ? 'text-chart-2' : (p.fitScore ?? 0) >= 40 ? 'text-chart-5' : 'text-muted-foreground'}`}>
                        {p.fitScore}
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="inline-flex items-center gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${p.confidenceScore ?? 0}%` }} />
                          </div>
                          <span className="text-label-12 text-muted-foreground">{p.confidenceScore ?? '--'}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant={tier.variant}>{tier.label}</Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground truncate max-w-[200px]">
                        {p.disqualifiedReason || '--'}
                      </td>
                      <td className="text-right py-3 px-4 text-label-12 text-muted-foreground">
                        {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '--'}
                      </td>
                      <td className="text-center py-3 px-4">
                        <Link href={`/prospects/${p.id}`} className={buttonVariants({ variant: 'outline', size: 'xs' })}>
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Attention feed + Funnel */}
        <div className="lg:col-span-2 space-y-8">
          <UnifiedFeedLoader />

          {/* Stage Funnel Analytics */}
          <div className="bg-card p-6 rounded-xl border border-border space-y-4">
            <div>
              <h3 className="text-label-14 text-foreground uppercase border-b border-border pb-1.5">
                Stage Conversion
              </h3>
              <p className="text-label-12 text-muted-foreground mt-1">
                Pipeline flow rates and average dwell times.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-copy-13">
                <thead>
                  <tr className="text-label-12 text-muted-foreground border-b border-border">
                    <th className="text-left py-2 pr-4">Stage</th>
                    <th className="text-right py-2 px-4">Entered</th>
                    <th className="text-right py-2 px-4">Exited</th>
                    <th className="text-right py-2 px-4">&rarr; Conv.</th>
                    <th className="text-right py-2 px-4">Avg Time</th>
                    <th className="text-right py-2 pl-4">Dropped</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.map((row) => (
                    <tr key={row.stage} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-foreground">{row.stage}</td>
                      <td className="text-right py-2.5 px-4 text-muted-foreground">{row.entered}</td>
                      <td className="text-right py-2.5 px-4 text-muted-foreground">{row.exited}</td>
                      <td className={`text-right py-2.5 px-4 font-semibold ${
                        row.conversionRate !== null && row.conversionRate < 50 ? 'text-destructive'
                        : row.conversionRate !== null && row.conversionRate < 75 ? 'text-chart-5'
                        : 'text-chart-2'
                      }`}>
                        {row.conversionRate !== null ? `${row.conversionRate}%` : '\u2014'}
                      </td>
                      <td className="text-right py-2.5 px-4 text-muted-foreground">
                        {row.avgDaysInStage !== null ? `${row.avgDaysInStage.toFixed(1)}d` : '\u2014'}
                      </td>
                      <td className={`text-right py-2.5 pl-4 ${row.droppedCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {row.droppedCount > 0 ? `${row.droppedCount} (${row.droppedPercent}%)` : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar summaries */}
        <div className="space-y-6">
          {/* Stale Leads by Stage */}
          <div className="bg-card p-6 rounded-xl border border-border space-y-4">
            <div>
              <h3 className="text-label-14 text-foreground uppercase border-b border-border pb-1.5 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-chart-5" />
                Stale by Stage
              </h3>
            </div>
            {staleByStage.length > 0 ? (
              <div className="space-y-2">
                {staleByStage.map(({ stage, count, maxDays }) => (
                  <Link
                    key={stage}
                    href={`/leads?stage=${encodeURIComponent(stage)}&filter=stale`}
                    className="flex items-center justify-between p-2.5 rounded-md bg-destructive/5 hover:bg-destructive/10 border border-destructive/10 transition-colors group"
                  >
                    <div className="space-y-0.5">
                      <span className="text-copy-14 font-medium text-foreground">{stage}</span>
                      <p className="text-label-12 text-muted-foreground">Inactive {maxDays}+ days</p>
                    </div>
                    <span className="text-heading-lg text-destructive font-bold">{count}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center text-copy-14 text-muted-foreground py-4">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-chart-2" />
                <p>No stale leads. All stages are within threshold.</p>
              </div>
            )}
          </div>

          {/* My Tasks */}
          <div className="bg-card p-6 rounded-xl border border-border space-y-3">
            <h3 className="text-label-14 text-foreground uppercase border-b border-border pb-1.5 flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5" />
              My Tasks
            </h3>
            {myTasks.length > 0 ? (
              <>
                <p className="text-heading-2xl text-foreground">{myTasks.length}</p>
                <p className="text-label-12 text-muted-foreground">
                  {overdueMyTasks > 0 && (
                    <span className="text-destructive font-semibold">{overdueMyTasks} overdue. </span>
                  )}
                  Open tasks assigned to you.
                </p>
                <Link
                  href="/leads?filter=my_tasks"
                  className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full' })}
                >
                  View My Tasks
                </Link>
              </>
            ) : (
              <p className="text-copy-14 text-muted-foreground py-2">No tasks assigned to you.</p>
            )}
          </div>

          {/* Pipeline Distribution */}
          <div className="bg-card p-6 rounded-xl border border-border space-y-5">
            <div>
              <h3 className="text-label-14 text-foreground uppercase border-b border-border pb-1.5">
                Pipeline Distribution
              </h3>
              <p className="text-label-12 text-muted-foreground mt-1">Click a stage to filter active leads.</p>
            </div>
            <div className="space-y-4">
              {stages.map((stage) => {
                const count = stageCounts[stage] || 0;
                const percent = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <Link
                    key={stage}
                    href={`/leads?stage=${encodeURIComponent(stage)}`}
                    className="block space-y-1.5 group"
                  >
                    <div className="flex justify-between text-label-12">
                      <span className="text-muted-foreground group-hover:text-primary transition-colors">
                        {stage}
                      </span>
                      <span className="text-foreground font-semibold">
                        {count} {count === 1 ? 'lead' : 'leads'}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/20">
                      <div
                        className="bg-primary/85 h-full rounded-full transition-all duration-300 group-hover:bg-primary"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-card p-6 rounded-xl border border-border flex flex-col justify-between min-h-[180px]">
            <div className="space-y-4">
              <h3 className="text-label-14 text-foreground uppercase border-b border-border pb-1.5">
                Quick Shortcuts
              </h3>
              <div className="space-y-2">
                <Link
                  href="/scopes"
                  className="flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/70 rounded-md transition text-foreground text-label-12 group"
                >
                  <span>All Discovery Campaigns</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition" />
                </Link>
                <Link
                  href="/leads"
                  className="flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/70 rounded-md transition text-foreground text-label-12 group"
                >
                  <span>All Active Leads</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition" />
                </Link>
              </div>
            </div>
            <div className="pt-4 border-t border-border/50 text-label-12 text-muted-foreground text-center">
              Leadroom operating system
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
