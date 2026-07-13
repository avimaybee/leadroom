export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Plus, Upload, Info, ShieldAlert } from 'lucide-react';
import { getDb } from '@/db';
import { prospects } from '@/db/schema/core';
import { markets, offers, icpProfiles } from '@/db/schema/strategy';
import { researchTasks } from '@/db/schema/jobs';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

export const metadata = {
  title: 'Market Prospects | Leadroom',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-chart-5/10 text-chart-5',
  RUNNING: 'bg-primary/10 text-primary',
  COMPLETED: 'bg-chart-2/10 text-chart-2',
  FAILED: 'bg-destructive/10 text-destructive',
};

export default async function MarketProspectsPage({ params }: { params: Promise<{ marketId: string }> }) {
  const { marketId } = await params;
  const userId = await getUserId();
  const db = getDb();

  if (!userId) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
        <p className="text-copy-14 text-destructive">Unauthorized. Please log in.</p>
      </div>
    );
  }

  const [market] = await db.select().from(markets).where(eq(markets.id, marketId)).limit(1);
  if (!market) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <Info className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-heading-lg">Market not found</h3>
      </div>
    );
  }

  const [offer] = market.offerId
    ? await db.select({ name: offers.name }).from(offers).where(eq(offers.id, market.offerId)).limit(1)
    : [null];
  const [icp] = market.icpProfileId
    ? await db.select({ name: icpProfiles.name }).from(icpProfiles).where(eq(icpProfiles.id, market.icpProfileId)).limit(1)
    : [null];

  const prospectRows = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.marketId, marketId), eq(prospects.workspaceId, market.workspaceId)))
    .orderBy(sql`COALESCE(${prospects.fitScore}, 0) DESC`);

  const prospectIds = prospectRows.map(p => p.id);
  const taskRows = prospectIds.length > 0
    ? await db
        .select()
        .from(researchTasks)
        .where(inArray(researchTasks.prospectId, prospectIds))
    : [];

  const taskMap = new Map<string, typeof researchTasks.$inferSelect[]>();
  for (const task of taskRows) {
    const existing = taskMap.get(task.prospectId) || [];
    existing.push(task);
    taskMap.set(task.prospectId, existing);
  }

  const totalCount = prospectRows.length;
  const researchedCount = prospectRows.filter(p => p.fitScore !== null && p.fitScore !== undefined).length;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-heading-2xl">{market.name} Prospects</h2>
          <p className="text-copy-14 text-muted-foreground mt-1">
            {offer || icp ? (
              <>Linked to: {offer?.name || '(no offer)'} (offer) &middot; {icp?.name || '(no ICP)'} (ICP)</>
            ) : (
              'Add prospects to this market for research and scoring.'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/markets/${marketId}/prospects/new`}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Prospect
          </Link>
          <Link
            href={`/markets/${marketId}/prospects/new?tab=csv`}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
        </div>
      </div>

      {prospectRows.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <Info className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-heading-lg text-foreground">No prospects in this market yet</h3>
          <p className="text-copy-14 text-muted-foreground mt-1 max-w-md mx-auto">
            Add companies to research and score.
          </p>
          <Link
            href={`/markets/${marketId}/prospects/new`}
            className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Prospect
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Company</th>
                  <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Domain</th>
                  <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Fit</th>
                  <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Confidence</th>
                  <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Research</th>
                  <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Stage</th>
                </tr>
              </thead>
              <tbody>
                {prospectRows.map((p) => {
                  const tasks = taskMap.get(p.id) || [];
                  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
                  const totalTasks = tasks.length;
                  const worstStatus = tasks.some(t => t.status === 'FAILED') ? 'FAILED'
                    : tasks.some(t => t.status === 'RUNNING') ? 'RUNNING'
                    : tasks.every(t => t.status === 'COMPLETED') ? 'COMPLETED'
                    : 'PENDING';

                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/prospects/${p.id}`}
                    >
                      <td className="px-4 py-3 text-copy-14 font-medium">{p.company || p.name}</td>
                      <td className="px-4 py-3 text-copy-13 text-muted-foreground">
                        {p.website ? new URL(p.website).hostname.replace(/^www\./, '') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {p.fitScore !== null && p.fitScore !== undefined ? (
                          <span className={`text-label-14 font-semibold ${
                            p.fitScore >= 70 ? 'text-chart-2' : p.fitScore >= 40 ? 'text-chart-5' : 'text-muted-foreground'
                          }`}>
                            {p.fitScore}
                          </span>
                        ) : (
                          <span className="text-copy-13 text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.confidenceScore !== null && p.confidenceScore !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  p.confidenceScore >= 70 ? 'bg-chart-2' : p.confidenceScore >= 40 ? 'bg-chart-5' : 'bg-destructive'
                                }`}
                                style={{ width: `${p.confidenceScore}%` }}
                              />
                            </div>
                            <span className="text-label-12 text-muted-foreground">{p.confidenceScore}</span>
                          </div>
                        ) : (
                          <span className="text-copy-13 text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold ${STATUS_COLORS[worstStatus] || 'bg-muted/10 text-muted-foreground'}`}>
                          {worstStatus === 'COMPLETED' ? `${completedCount}/${totalTasks} done`
                            : worstStatus === 'RUNNING' ? 'Running'
                            : worstStatus === 'FAILED' ? 'Failed'
                            : 'Queued'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-copy-13 text-muted-foreground">{p.stage}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-label-12 text-muted-foreground mt-3">
            {totalCount} prospects &middot; {researchedCount} researched
          </p>
        </>
      )}
    </div>
  );
}
