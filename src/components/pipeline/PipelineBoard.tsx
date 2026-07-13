'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Loader2, ShieldAlert } from 'lucide-react';
import { getPipelineProspectsAction } from '@/app/actions/pipeline';
import type { PIPELINE_STAGES } from '@/services/lead';

interface ProspectCardData {
  id: string;
  name: string;
  company: string | null;
  stage: string;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  website: string | null;
  disqualifiedReason: string | null;
  fitReasoning: string | null;
}

type PipelineStage = (typeof PIPELINE_STAGES)[number];

const stageLabels: Record<string, string> = {
  'New': 'New',
  'In Research': 'In Research',
  'Researched': 'Researched',
  'Outreach Drafted': 'Outreach Drafted',
  'Awaiting Approval': 'Awaiting Approval',
  'Contacted': 'Contacted',
  'Meeting Booked': 'Meeting Booked',
  'Won': 'Won',
  'Lost': 'Lost',
};

export function PipelineBoard() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prospects, setProspects] = useState<ProspectCardData[]>([]);
  const [hasShadow, setHasShadow] = useState(false);

  useEffect(() => {
    getPipelineProspectsAction().then(r => {
      if (r.success) {
        setProspects(r.prospects);
      } else {
        setError(r.error ?? 'Failed to load');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setHasShadow(el.scrollLeft > 4);
    el.addEventListener('scroll', check);
    check();
    return () => el.removeEventListener('scroll', check);
  }, [loading]);

  const grouped: Record<string, ProspectCardData[]> = {};
  for (const s of ['New', 'In Research', 'Researched', 'Outreach Drafted', 'Awaiting Approval', 'Contacted', 'Meeting Booked', 'Won', 'Lost']) {
    grouped[s] = [];
  }
  for (const p of prospects) {
    const s = p.stage || 'New';
    if (grouped[s]) grouped[s].push(p);
    else grouped[s] = [p];
  }

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="min-w-[220px] w-[220px] flex-shrink-0 space-y-3">
            <div className="h-5 w-20 bg-muted rounded animate-pulse" />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-24 bg-muted rounded-xl animate-pulse" style={{ animationDelay: `${j * 150}ms` }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
        <span className="text-copy-14 text-destructive">{error}</span>
      </div>
    );
  }

  const total = prospects.length;

  if (total === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <LayoutDashboard className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-heading-lg text-foreground">No prospects in pipeline</h3>
        <p className="text-copy-14 text-muted-foreground mt-1 max-w-md mx-auto">
          Add prospects and run research to build your pipeline.
        </p>
        <Link
          href="/markets"
          className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
        >
          Go to Markets
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      {hasShadow && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent z-10" />
      )}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]"
      >
        {Object.entries(grouped).map(([stage, cards]) => {
          const sorted = [...cards].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
          return (
            <div key={stage} className="min-w-[220px] w-[220px] flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-label-14 text-foreground font-semibold">{stageLabels[stage] || stage}</span>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-label-12 text-muted-foreground">
                  {sorted.length}
                </span>
              </div>
              <div className="space-y-3">
                {sorted.length === 0 && (
                  <p className="text-copy-13 text-muted-foreground text-center py-8">No prospects</p>
                )}
                {sorted.map(p => <ProspectCard key={p.id} prospect={p} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProspectCard({ prospect }: { prospect: ProspectCardData }) {
  const topSignal = extractTopSignal(prospect);
  return (
    <Link
      href={`/prospects/${prospect.id}`}
      className="block rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow duration-150 cursor-pointer"
    >
      <p className="text-copy-14 font-medium text-foreground truncate">{prospect.company || prospect.name}</p>
      <div className="flex items-center gap-2 mt-2">
        {prospect.fitScore != null && (
          <span className={`text-label-12 font-semibold ${
            prospect.fitScore >= 70 ? 'text-chart-2' : prospect.fitScore >= 40 ? 'text-chart-4' : 'text-muted-foreground'
          }`}>
            Fit {prospect.fitScore}
          </span>
        )}
        {prospect.priorityTier && (
          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-label-11 font-semibold ${
            prospect.priorityTier === 'tier1' ? 'border-chart-2/30 bg-chart-2/10 text-chart-2'
              : prospect.priorityTier === 'tier2' ? 'border-border bg-muted/30 text-muted-foreground'
              : prospect.priorityTier === 'disqualified' ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-border bg-muted/30 text-muted-foreground'
          }`}>
            {prospect.priorityTier === 'tier1' ? 'T1'
              : prospect.priorityTier === 'tier2' ? 'T2'
              : prospect.priorityTier === 'tier3' ? 'T3'
              : prospect.priorityTier === 'disqualified' ? 'DQ'
              : prospect.priorityTier}
          </span>
        )}
        {prospect.disqualifiedReason && (
          <span className="text-label-12 text-destructive">Disqualified</span>
        )}
      </div>
      {topSignal && (
        <p className="text-copy-13 text-muted-foreground mt-1 truncate">{topSignal}</p>
      )}
    </Link>
  );
}

function extractTopSignal(p: ProspectCardData): string | null {
  if (!p.fitReasoning) return null;
  try {
    const parsed = JSON.parse(p.fitReasoning);
    if (parsed.matchedSignals?.length > 0) {
      return parsed.matchedSignals[0].name || parsed.matchedSignals[0];
    }
    if (Array.isArray(parsed)) {
      const first = parsed[0];
      if (typeof first === 'string') return first;
      return first.name || first.signal || null;
    }
    return null;
  } catch {
    if (p.fitReasoning.length > 80) return p.fitReasoning.slice(0, 80) + '...';
    return p.fitReasoning;
  }
}
