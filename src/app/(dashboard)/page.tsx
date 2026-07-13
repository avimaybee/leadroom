export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { prospects } from '@/db/schema/core';
import { outreachDrafts } from '@/db/schema/outreach';
import { researchTasks } from '@/db/schema/jobs';
import { markets } from '@/db/schema/strategy';
import { getUserId } from '@/lib/auth';
import { eq, sql, count, and, inArray } from 'drizzle-orm';
import { ShieldAlert, TriangleAlert, Target } from 'lucide-react';
import Link from 'next/link';
import { MetricsBar } from '@/components/command-center/MetricsBar';
import { ProspectTable } from '@/components/command-center/ProspectTable';

export default async function DashboardPage() {
  const db = getDb();
  const userId = await getUserId();

  const allProspects = await db
    .select()
    .from(prospects)
    .where(eq(prospects.status, 'Active'))
    .orderBy(sql`COALESCE(${prospects.fitScore}, 0) DESC`);

  const scoredProspects = allProspects.filter(p => p.fitScore !== null && p.fitScore !== undefined);

  const totalQueue = allProspects.length;
  const highFit = scoredProspects.filter(p => (p.fitScore ?? 0) >= 70).length;
  const needsResearch = allProspects.filter(p => p.fitScore === null || p.fitScore === undefined).length;

  const avgConfidence = scoredProspects.length > 0
    ? Math.round(scoredProspects.reduce((s, p) => s + (p.confidenceScore ?? 0), 0) / scoredProspects.length)
    : 0;

  const [pendingApprovalRow] = await db
    .select({ count: count() })
    .from(outreachDrafts)
    .where(eq(outreachDrafts.status, 'DRAFT'));

  const pendingApprovals = pendingApprovalRow?.count ?? 0;

  const lowConfidenceProspects = scoredProspects.filter(p => (p.confidenceScore ?? 0) < 50);
  const lowConfidenceCount = lowConfidenceProspects.length;

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

  return (
    <div className="space-y-8 animate-fade-in text-left">
      <header className="space-y-4 pb-6">
        <nav className="flex items-center gap-2 text-copy-14 text-muted-foreground">
          <span className="font-medium text-foreground">Command Center</span>
        </nav>
        <h1 className="text-heading-2xl">Command Center</h1>
        <p className="text-copy-14 text-muted-foreground">
          Prioritize, review, and act on scored prospects.
          {totalQueue > 0 && (
            <span className="font-semibold text-foreground">
              {' '}{totalQueue} active prospects, {highFit} high-fit.
            </span>
          )}
        </p>
      </header>

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
            <p className="label-14">Low data confidence</p>
            <p className="copy-14">
              {lowConfidenceCount} prospect{lowConfidenceCount === 1 ? '' : 's'} have confidenceScore below 50.
              Scores may be unreliable — review evidence before acting.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h2 className="text-label-14 text-foreground uppercase">Ready to Review</h2>
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
              Add prospects and run research to see your command center.
            </p>
            <Link
              href="/markets"
              className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
            >
              Go to Markets
            </Link>
          </div>
        ) : (
          <ProspectTable prospects={prospectsWithSignals} />
        )}
      </div>
    </div>
  );
}
