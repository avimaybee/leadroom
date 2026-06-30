'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LayoutGrid, List, ArrowRight, Target, Users, TrendingUp, BrainCircuit } from 'lucide-react';
import { getPipelineBoardAction, getPipelineTableAction, updateProspectStageAction, getPipelineAnalyticsAction } from '@/app/actions/pipelineActions';

const ALL_STAGES = ['New', 'In Research', 'Auditing', 'Audited', 'Drafting', 'Ready to Send', 'Outreach Sent', 'Meeting', 'Won', 'Lost'];

const STAGE_COLORS: Record<string, string> = {
  'New': 'bg-blue-100 border-blue-300 text-blue-800',
  'In Research': 'bg-purple-100 border-purple-300 text-purple-800',
  'Auditing': 'bg-indigo-100 border-indigo-300 text-indigo-800',
  'Audited': 'bg-teal-100 border-teal-300 text-teal-800',
  'Drafting': 'bg-amber-100 border-amber-300 text-amber-800',
  'Ready to Send': 'bg-orange-100 border-orange-300 text-orange-800',
  'Outreach Sent': 'bg-cyan-100 border-cyan-300 text-cyan-800',
  'Meeting': 'bg-green-100 border-green-300 text-green-800',
  'Won': 'bg-chart-2/20 border-chart-2/50 text-chart-2',
  'Lost': 'bg-destructive/10 border-destructive/30 text-destructive',
};

interface ProspectRow {
  id: string;
  name: string;
  company: string | null;
  stage: string;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  disqualifiedReason?: string | null;
  fitReasoning?: string | null;
  updatedAt: Date | null;
  createdAt: Date | null;
}

interface Analytics {
  stageCounts: Record<string, number>;
  totalActive: number;
  outcomeStats: { total: number; replied: number; bounced: number };
  pendingSuggestions: number;
}

export default function PipelinePage() {
  const [view, setView] = useState<'board' | 'table'>('board');
  const [board, setBoard] = useState<Record<string, ProspectRow[]>>({});
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [boardRes, tableRes, analyticsRes] = await Promise.all([
      getPipelineBoardAction(),
      getPipelineTableAction(),
      getPipelineAnalyticsAction(),
    ]);
    if (boardRes && !('error' in boardRes)) setBoard(boardRes.board);
    if (tableRes && !('error' in tableRes)) setProspects(tableRes.prospects);
    if (analyticsRes && !('error' in analyticsRes)) setAnalytics(analyticsRes as Analytics);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStageChange = async (prospectId: string, newStage: string) => {
    setActionLoading(prospectId);
    const result = await updateProspectStageAction(prospectId, newStage);
    if (result.success) {
      await loadData();
    }
    setActionLoading(null);
  };

  const handleDragStart = (e: React.DragEvent, prospect: ProspectRow) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: prospect.id, stage: prospect.stage }));
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.stage !== targetStage) {
        await handleStageChange(data.id, targetStage);
      }
    } catch { /* ignore */ }
  };

  const getScoreColor = (score: number | null) => {
    if (score == null) return 'text-muted-foreground';
    return score >= 70 ? 'text-chart-2' : score >= 40 ? 'text-chart-5' : 'text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in text-left">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
        <div className="h-96 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-left">
      <nav className="flex items-center gap-2 text-copy-14 text-muted-foreground">
        <span className="font-medium text-foreground">Pipeline</span>
      </nav>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-label-12 text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              Total Active
            </div>
            <p className="text-heading-2xl font-semibold text-foreground">{analytics.totalActive}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-label-12 text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5 text-chart-2" />
              Positive Outcomes
            </div>
            <p className="text-heading-2xl font-semibold text-chart-2">{analytics.outcomeStats.replied}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-label-12 text-muted-foreground">
              <Target className="w-3.5 h-3.5 text-destructive" />
              Bounced / Lost
            </div>
            <p className="text-heading-2xl font-semibold text-destructive">{analytics.outcomeStats.bounced}</p>
          </div>
          <Link href="/learning" className="rounded-xl border border-border bg-card p-4 space-y-1 hover:border-primary/40 transition-colors group">
            <div className="flex items-center gap-2 text-label-12 text-muted-foreground">
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>Learning</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-heading-2xl font-semibold text-foreground">{analytics.pendingSuggestions}</p>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-label-12 text-muted-foreground">Pending suggestions</p>
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-heading-lg font-semibold text-foreground">Active Prospects</h2>
        <Tabs value={view} onValueChange={(v) => setView(v as 'board' | 'table')} className="w-auto">
          <TabsList>
            <TabsTrigger value="board">
              <LayoutGrid className="w-3.5 h-3.5" />
              Board
            </TabsTrigger>
            <TabsTrigger value="table">
              <List className="w-3.5 h-3.5" />
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === 'board' ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {ALL_STAGES.map((stage) => {
              const items = board[stage] || [];
              return (
                <div
                  key={stage}
                  className="w-64 shrink-0"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className={`px-3 py-2 border-b border-border ${STAGE_COLORS[stage] || ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-label-12 font-semibold">{stage}</span>
                        <Badge variant="outline" className="text-label-11">{items.length}</Badge>
                      </div>
                    </div>
                    <div className="p-2 space-y-2 min-h-[120px]">
                      {items.length === 0 ? (
                        <p className="text-label-12 text-muted-foreground text-center py-6">No prospects</p>
                      ) : (
                        items.slice(0, 15).map((prospect) => (
                          <div
                            key={prospect.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, prospect)}
                            className="rounded-lg border border-border bg-background p-3 space-y-1.5 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow group"
                          >
                            <div className="flex items-center justify-between">
                              <Link href={`/leads/${prospect.id}`} className="text-copy-14 font-medium text-foreground truncate hover:underline">
                                {prospect.company || prospect.name}
                              </Link>
                              {actionLoading === prospect.id && (
                                <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-label-12 font-semibold ${getScoreColor(prospect.fitScore)}`}>
                                {prospect.fitScore ?? '--'}
                              </span>
                              <span className="text-label-11 text-muted-foreground">fit</span>
                            </div>
                            {prospect.fitReasoning && (
                              <p className="text-label-11 text-muted-foreground truncate max-w-[220px]" title={prospect.fitReasoning}>
                                {prospect.fitReasoning}
                              </p>
                            )}
                            {prospect.priorityTier && (
                              <Badge variant={prospect.priorityTier === 'tier1' ? 'default' : prospect.priorityTier === 'disqualified' ? 'destructive' : 'outline'} className="text-label-11">
                                {prospect.priorityTier}
                              </Badge>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {prospects.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Target className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-copy-14 text-muted-foreground">No active prospects in the pipeline.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-copy-13">
                <thead>
                  <tr className="text-label-12 text-muted-foreground border-b border-border">
                    <th className="text-left py-3 px-6">Company</th>
                    <th className="text-left py-3 px-4">Stage</th>
                    <th className="text-right py-3 px-4">Fit Score</th>
                    <th className="text-right py-3 px-4">Confidence</th>
                    <th className="text-center py-3 px-4">Priority</th>
                    <th className="text-right py-3 px-4">Updated</th>
                    <th className="text-center py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p) => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-6 font-medium text-foreground">{p.company || p.name}</td>
                      <td className="py-3 px-4">
                        <select
                          value={p.stage}
                          onChange={(e) => handleStageChange(p.id, e.target.value)}
                          disabled={actionLoading === p.id}
                          className="text-copy-14 bg-transparent border border-border rounded px-2 py-1 text-foreground disabled:opacity-50"
                        >
                          {ALL_STAGES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className={`text-right py-3 px-4 font-semibold ${getScoreColor(p.fitScore)}`}>{p.fitScore ?? '--'}</td>
                      <td className="text-right py-3 px-4 text-muted-foreground">{p.confidenceScore ?? '--'}</td>
                      <td className="text-center py-3 px-4">
                        {p.priorityTier && (
                          <Badge variant={p.priorityTier === 'tier1' ? 'default' : p.priorityTier === 'disqualified' ? 'destructive' : 'outline'}>
                            {p.priorityTier}
                          </Badge>
                        )}
                      </td>
                      <td className="text-right py-3 px-4 text-label-12 text-muted-foreground">
                        {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '--'}
                      </td>
                      <td className="text-center py-3 px-4">
                        <Link href={`/leads/${p.id}`} className={buttonVariants({ variant: 'outline', size: 'xs' })}>
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
