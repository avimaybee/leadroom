export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { prospects, stageThresholds } from '@/db/schema/core';
import { outreachDrafts } from '@/db/schema/outreach';
import { researchTasks } from '@/db/schema/jobs';
import { markets } from '@/db/schema/strategy';
import { getUserId } from '@/lib/auth';
import { LeadService } from '@/services/lead';
import { eq, sql, count, and, inArray, desc } from 'drizzle-orm';
import { ShieldAlert, TriangleAlert, Target, Clock, CheckSquare, ArrowRight, CheckCircle2, LayoutList } from 'lucide-react';
import Link from 'next/link';
import { MetricsBar } from '@/components/command-center/MetricsBar';
import { ProspectTable } from '@/components/command-center/ProspectTable';
import UnifiedFeedLoader from '@/app/(dashboard)/UnifiedFeedLoader';
import { buttonVariants } from '@/components/ui/button';

export default async function DashboardPage() {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return <div className="p-8 text-center text-muted-foreground">Unauthorized. Please log in.</div>;
  }

  const leadService = new LeadService(db);

  // Fetch all core data in parallel
  const [allProspects, activeMarkets, pendingApprovalRow, thresholds, funnel, myTasks] = await Promise.all([
    db.select().from(prospects).where(and(eq(prospects.status, 'Active'), eq(prospects.ownerId, userId))).orderBy(sql`COALESCE(${prospects.fitScore}, 0) DESC`),
    db.select().from(markets).where(and(eq(markets.workspaceId, userId), eq(markets.status, 'active'))),
    db.select({ count: count() }).from(outreachDrafts).innerJoin(prospects, eq(outreachDrafts.leadId, prospects.id)).where(and(eq(outreachDrafts.status, 'DRAFT'), eq(prospects.ownerId, userId))),
    db.select().from(stageThresholds),
    leadService.getStageFunnel(userId),
    leadService.getMyTasks(userId),
  ]);

  const scoredProspects = allProspects.filter(p => p.fitScore !== null && p.fitScore !== undefined);

  // High-level metrics calculations
  const totalQueue = allProspects.length;
  const highFit = scoredProspects.filter(p => (p.fitScore ?? 0) >= 70).length;
  const needsResearch = allProspects.filter(p => p.fitScore === null || p.fitScore === undefined).length;

  const avgConfidence = scoredProspects.length > 0
    ? Math.round(scoredProspects.reduce((s, p) => s + (p.confidenceScore ?? 0), 0) / scoredProspects.length)
    : 0;

  const pendingApprovals = pendingApprovalRow[0]?.count ?? 0;
  const lowConfidenceCount = scoredProspects.filter(p => (p.confidenceScore ?? 0) < 50).length;

  // Stale Prospects by Stage calculation
  const staleByStageMap = new Map<string, { count: number; maxDays: number }>();
  let staleLeadsCount = 0;
  for (const lead of allProspects) {
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

  // My Tasks due dates status
  const overdueMyTasks = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;

  // Pipeline Distribution
  const stageCounts = allProspects.reduce((acc: Record<string, number>, prospect: any) => {
    const stage = prospect.stage || 'New';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pipelineStages = [
    'New', 'In Research', 'Researched', 'Outreach Drafted',
    'Awaiting Approval', 'Contacted', 'Meeting Booked', 'Won', 'Lost',
  ];

  // Fetch top signals for scored prospects to render signals in list
  const prospectsWithSignals: {
    id: string;
    company: string | null;
    name: string;
    fitScore: number | null;
    confidenceScore: number | null;
    priorityTier: string | null;
    updatedAt: Date | number | null;
    topSignal: string | null;
  }[] = [];

  if (scoredProspects.length > 0) {
    const prospectIds = scoredProspects.map(p => p.id);
    const taskRows = await db
      .select()
      .from(researchTasks)
      .where(and(
        eq(researchTasks.status, 'COMPLETED'),
        inArray(researchTasks.prospectId, prospectIds)
      ));

    const taskMap = new Map<string, { signalName: string; matchStrength: string }[]>();
    for (const task of taskRows) {
      if (task.extractedSignals) {
        try {
          const signals = JSON.parse(task.extractedSignals);
          const existing = taskMap.get(task.prospectId) || [];
          taskMap.set(task.prospectId, [...existing, ...signals]);
        } catch {}
      }
    }

    for (const p of scoredProspects) {
      const signals = taskMap.get(p.id) || [];
      const topSignal = signals.length > 0
        ? signals.sort((a, b) => {
            const order = { strong: 3, partial: 2, weak: 1 };
            return (order[b.matchStrength as keyof typeof order] || 0) - (order[a.matchStrength as keyof typeof order] || 0);
          })[0].signalName
        : null;
      prospectsWithSignals.push({
        id: p.id,
        company: p.company || p.name,
        name: p.name,
        fitScore: p.fitScore,
        confidenceScore: p.confidenceScore,
        priorityTier: p.priorityTier,
        updatedAt: p.updatedAt,
        topSignal,
      });
    }
  }

  // Dynamic status summary text
  const summaryParts = [];
  if (overdueMyTasks > 0) {
    summaryParts.push(`${overdueMyTasks} follow-up${overdueMyTasks === 1 ? '' : 's'} overdue`);
  }
  if (staleLeadsCount > 0) {
    summaryParts.push(`${staleLeadsCount} stale prospect${staleLeadsCount === 1 ? '' : 's'}`);
  }
  if (pendingApprovals > 0) {
    summaryParts.push(`${pendingApprovals} draft${pendingApprovals === 1 ? '' : 's'} awaiting approval`);
  }
  const dynamicSummary = summaryParts.length > 0
    ? `${summaryParts.join(', ')}.`
    : 'All caught up. No urgent items require attention.';

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Dashboard Page Header */}
      <header className="space-y-4 border-b border-border/70 pb-6">
        <nav className="flex items-center gap-2 text-copy-14 text-muted-foreground">
          <span className="font-medium text-foreground">Command Center</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-heading-3xl font-bold tracking-tight text-foreground">Command Center</h1>
            <p className="text-copy-14 text-muted-foreground mt-1.5 leading-relaxed">
              Operational overview &bull; <span className="font-semibold text-foreground">{dynamicSummary}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 lg:mt-1">
            <Link href="/markets" className={buttonVariants({ variant: 'default' })}>
              Manage Markets
            </Link>
            <Link href="/prospects" className={buttonVariants({ variant: 'outline' })}>
              View All Prospects
            </Link>
          </div>
        </div>
      </header>

      {/* Top Metrics Row */}
      <MetricsBar
        metrics={{
          totalQueue,
          highFit,
          pendingApprovals,
          avgConfidence,
          needsResearch,
        }}
      />

      {lowConfidenceCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-chart-5/10 text-chart-5 border border-chart-5/20">
          <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-label-14">Low data confidence warning</p>
            <p className="text-copy-14 text-muted-foreground mt-0.5">
              {lowConfidenceCount} prospect{lowConfidenceCount === 1 ? '' : 's'} have confidence scores below 50%.
              Review the cited source evidence carefully before approving outreach.
            </p>
          </div>
        </div>
      )}

      {/* Main Split Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2-Columns: Ready to Review Table & Funnel Analytics & Unified Feed */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Prospects Ready to Review Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h2 className="text-label-14 text-foreground font-semibold uppercase">Ready to Review</h2>
              </div>
              <span className="text-label-12 text-muted-foreground">
                {scoredProspects.length} prospect{scoredProspects.length === 1 ? '' : 's'} sorted by fit score
              </span>
            </div>
            {scoredProspects.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                  <Target className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-copy-14 text-muted-foreground">
                  Add prospects to a market and run research to see them here.
                </p>
                <Link
                  href="/markets"
                  className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
                >
                  Configure Markets
                </Link>
              </div>
            ) : (
              <ProspectTable prospects={prospectsWithSignals} />
            )}
          </div>

          {/* Unified Daily Action Feed */}
          <UnifiedFeedLoader />

          {/* Pipeline Funnel Conversion Rates */}
          <div className="bg-card p-6 rounded-xl border border-border space-y-4">
            <div>
              <h3 className="text-label-14 text-foreground font-semibold uppercase border-b border-border pb-1.5">
                Stage Conversion Heuristics
              </h3>
              <p className="text-label-12 text-muted-foreground mt-1">
                Historical flow rates and average times for prospects moving across pipeline stages.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-copy-13 text-left">
                <thead>
                  <tr className="text-label-12 text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4">Stage</th>
                    <th className="text-right py-2 px-4">Entered</th>
                    <th className="text-right py-2 px-4">Exited</th>
                    <th className="text-right py-2 px-4">&rarr; Conv. Rate</th>
                    <th className="text-right py-2 px-4">Avg Duration</th>
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

        {/* Right 1-Column: Sidebar Summaries */}
        <div className="space-y-6">
          
          {/* Stale Prospects by Stage */}
          <div className="bg-card p-6 rounded-xl border border-border space-y-4">
            <div>
              <h3 className="text-label-14 text-foreground font-semibold uppercase border-b border-border pb-1.5 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-chart-5" />
                Stale Prospects
              </h3>
            </div>
            {staleByStage.length > 0 ? (
              <div className="space-y-2">
                {staleByStage.map(({ stage, count, maxDays }) => (
                  <Link
                    key={stage}
                    href={`/prospects?stage=${encodeURIComponent(stage)}`}
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
                <p>No stale prospects found. All items are updated.</p>
              </div>
            )}
          </div>

          {/* My Assigned Tasks */}
          <div className="bg-card p-6 rounded-xl border border-border space-y-3">
            <h3 className="text-label-14 text-foreground font-semibold uppercase border-b border-border pb-1.5 flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5" />
              Follow-Up Tasks
            </h3>
            {myTasks.length > 0 ? (
              <>
                <p className="text-heading-2xl font-bold text-foreground">{myTasks.length}</p>
                <p className="text-label-12 text-muted-foreground">
                  {overdueMyTasks > 0 && (
                    <span className="text-destructive font-semibold">{overdueMyTasks} overdue. </span>
                  )}
                  Open follow-up items assigned to you.
                </p>
                <Link
                  href="/prospects"
                  className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full' })}
                >
                  View Prospects
                </Link>
              </>
            ) : (
              <p className="text-copy-14 text-muted-foreground py-2">No active tasks assigned.</p>
            )}
          </div>

          {/* Pipeline Distribution Bar Chart */}
          <div className="bg-card p-6 rounded-xl border border-border space-y-5">
            <div>
              <h3 className="text-label-14 text-foreground font-semibold uppercase border-b border-border pb-1.5">
                Pipeline Distribution
              </h3>
              <p className="text-label-12 text-muted-foreground mt-1">Prospect counts across active statuses.</p>
            </div>
            <div className="space-y-4">
              {pipelineStages.map((stage) => {
                const count = stageCounts[stage] || 0;
                const percent = totalQueue > 0 ? (count / totalQueue) * 100 : 0;
                return (
                  <Link
                    key={stage}
                    href={`/prospects?stage=${encodeURIComponent(stage)}`}
                    className="block space-y-1.5 group"
                  >
                    <div className="flex justify-between text-label-12">
                      <span className="text-muted-foreground group-hover:text-primary transition-colors">
                        {stage}
                      </span>
                      <span className="text-foreground font-semibold">
                        {count} {count === 1 ? 'prospect' : 'prospects'}
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
              <h3 className="text-label-14 text-foreground font-semibold uppercase border-b border-border pb-1.5">
                Quick Shortcuts
              </h3>
              <div className="space-y-2">
                <Link
                  href="/markets"
                  className="flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/70 rounded-md transition text-foreground text-label-12 group border border-transparent hover:border-border"
                >
                  <span>Active Target Markets ({activeMarkets.length})</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition" />
                </Link>
                <Link
                  href="/approvals"
                  className="flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/70 rounded-md transition text-foreground text-label-12 group border border-transparent hover:border-border"
                >
                  <span>Outreach Drafts Queue ({pendingApprovals})</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition" />
                </Link>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
