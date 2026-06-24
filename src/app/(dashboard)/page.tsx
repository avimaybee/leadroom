export const dynamic = 'force-dynamic';
import { LeadService } from '@/services/lead';
import { DiscoveryService } from '@/services/discovery';
import { getDb } from '@/db';
import { stageThresholds } from '@/db/schema/core';
import { getUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { Users, Search, AlertTriangle, CheckSquare, Clock, ArrowRight, Layers, FileText, CheckCircle2 } from 'lucide-react';
import UnifiedFeedLoader from '@/app/(dashboard)/UnifiedFeedLoader';
import { buttonVariants } from '@/components/ui/button';

export default async function DashboardPage() {
  const db = getDb();
  const userId = await getUserId();

  const leadService = new LeadService(db);
  const discoveryService = new DiscoveryService(db);

  const [leads, scopes, dashboardTasks, thresholds, funnel] = await Promise.all([
    leadService.listLeads(),
    discoveryService.listScopes(),
    leadService.getDashboardTasks(),
    db.select().from(stageThresholds),
    leadService.getStageFunnel(),
  ]);

  const totalLeads = leads.length;
  const activeScopesCount = scopes.length;
  const pendingCandidatesCount = await discoveryService.countPendingCandidates();

  const overdueTasksCount = dashboardTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date()
  ).length;

  const leadsNeedingResearch = leads.filter(
    (l) => l.stage === 'New' || l.stage === 'In Research'
  ).length;

  const leadsNeedingAudit = leads.filter(
    (l) => l.stage === 'Auditing' || l.stage === 'Audited'
  ).length;

  const leadsOutreachReady = leads.filter(
    (l) => l.stage === 'Drafting' || l.stage === 'Ready to Send'
  ).length;

  const STAGE_MAP: Record<string, string> = {
    'NEW': 'New',
    'Researching': 'In Research',
    'Qualified': 'Audited',
    'Outreach in Progress': 'Outreach Sent',
    'Meeting / Call': 'Meeting',
  };

  const stageCounts = leads.reduce((acc: Record<string, number>, lead: { stage: string }) => {
    const raw = lead.stage || 'New';
    const stage = STAGE_MAP[raw] || raw;
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stages = [
    'New', 'In Research', 'Auditing', 'Audited', 'Drafting',
    'Ready to Send', 'Outreach Sent', 'Meeting', 'Won', 'Lost',
  ];

  // Stale leads by stage aggregation
  const staleByStageMap = new Map<string, { count: number; maxDays: number }>();
  let staleLeadsCount = 0;
  for (const lead of leads) {
    if (lead.status !== 'Active') continue;
    const threshold = thresholds.find(t => t.stage === lead.stage)?.days ?? 5;
    const stageAgeMs = lead.stageUpdatedAt ? Date.now() - new Date(lead.stageUpdatedAt).getTime() : 0;
    const stageAgeDays = stageAgeMs / (24 * 60 * 60 * 1000);
    if (stageAgeDays > threshold) {
      staleLeadsCount++;
      const entry = staleByStageMap.get(lead.stage) || { count: 0, maxDays: 0 };
      entry.count++;
      entry.maxDays = Math.max(entry.maxDays, Math.round(stageAgeDays));
      staleByStageMap.set(lead.stage, entry);
    }
  }
  const staleByStage = Array.from(staleByStageMap.entries())
    .map(([stage, data]) => ({ stage, ...data }))
    .sort((a, b) => b.count - a.count);

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
