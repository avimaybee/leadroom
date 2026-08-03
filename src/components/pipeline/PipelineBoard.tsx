'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, ShieldAlert, GripVertical } from 'lucide-react';
import { getPipelineProspectsAction, updateProspectStageAction } from '@/app/actions/pipeline';
import { PIPELINE_STAGES } from '@/services/lead';
import { toast } from 'sonner';

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

export function PipelineBoard() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prospects, setProspects] = useState<ProspectCardData[]>([]);
  const [hasShadow, setHasShadow] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  useEffect(() => {
    getPipelineProspectsAction().then(r => {
      if (r.success) {
        setProspects(r.prospects);
        setError(null);
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

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStage(null);
  };

  const handleDrop = async (targetStage: string) => {
    const id = draggingId;
    setDraggingId(null);
    setDragOverStage(null);
    if (!id) return;

    const prospect = prospects.find(p => p.id === id);
    if (!prospect || prospect.stage === targetStage) return;

    // Optimistic update
    const previous = prospects;
    setProspects(prospects.map(p => p.id === id ? { ...p, stage: targetStage } : p));

    const result = await updateProspectStageAction(id, targetStage);
    if (result.error) {
      setProspects(previous);
      toast.error(`Stage change blocked: ${result.error}`);
    } else {
      toast.success(`${prospect.company || prospect.name} moved to ${targetStage}`);
    }
  };

  const grouped: Record<string, ProspectCardData[]> = {};
  for (const s of PIPELINE_STAGES) {
    grouped[s] = [];
  }
  for (const p of prospects) {
    const s = PIPELINE_STAGES.includes(p.stage as (typeof PIPELINE_STAGES)[number]) ? p.stage : 'New';
    grouped[s].push(p);
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
        {PIPELINE_STAGES.map((stage) => {
          const cards = grouped[stage];
          const sorted = [...cards].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
          const isOver = dragOverStage === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage); }}
              onDragLeave={() => setDragOverStage(cur => (cur === stage ? null : cur))}
              onDrop={(e) => { e.preventDefault(); handleDrop(stage); }}
              className={`min-w-[220px] w-[220px] flex-shrink-0 rounded-xl transition-colors duration-150 ${
                isOver ? 'bg-primary/5 ring-1 ring-primary/40' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-label-14 text-foreground font-semibold">{stage}</span>
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-label-12 text-muted-foreground transition-colors ${
                  isOver ? 'bg-primary/20 text-primary' : ''
                }`}>
                  {sorted.length}
                </span>
              </div>
              <div className="space-y-3 min-h-[120px] rounded-lg">
                {sorted.length === 0 && (
                  <p className="text-copy-13 text-muted-foreground text-center py-8 border border-dashed border-border/60 rounded-lg">
                    Drop here
                  </p>
                )}
                {sorted.map(p => (
                  <ProspectCard
                    key={p.id}
                    prospect={p}
                    isDragging={draggingId === p.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProspectCard({
  prospect,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  prospect: ProspectCardData;
  isDragging: boolean;
  onDragStart: (_id: string) => void;
  onDragEnd: () => void;
}) {
  const topSignal = extractTopSignal(prospect);
  return (
    <Link
      href={`/prospects/${prospect.id}`}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart(prospect.id);
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd();
      }}
      onClick={(e) => {
        if (isDragging) e.preventDefault();
      }}
      className={`block rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow duration-150 cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-40 ring-2 ring-primary/40' : ''
      }`}
      title="Drag to move between stages"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-copy-14 font-medium text-foreground truncate flex-1">{prospect.company || prospect.name}</p>
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
      </div>
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
