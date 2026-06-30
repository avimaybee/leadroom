'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BreakdownItem {
  factor: string;
  contribution: number;
  evidenceQuote: string;
  sourceUrl: string;
}

interface ScoreBreakdownProps {
  fitScore: number;
  confidenceScore: number;
  priorityTier: string;
  breakdown: BreakdownItem[];
  isOverridden?: boolean;
  overrideReason?: string;
  fitReasoning?: string | null;
}

const TIER_COLORS: Record<string, string> = {
  tier1: 'bg-chart-2 text-white',
  tier2: 'bg-chart-5 text-white',
  tier3: 'bg-muted-foreground text-white',
  disqualified: 'bg-destructive text-white',
};

const TIER_LABELS: Record<string, string> = {
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
  disqualified: 'Disqualified',
};

function CircularGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" className="-rotate-90">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <circle
          cx="44" cy="44" r={radius}
          fill="none" stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
        <text x="44" y="44" textAnchor="middle" dy="0.35em" className="fill-foreground text-lg font-bold" transform="rotate(90 44 44)">
          {value}
        </text>
      </svg>
      <span className="text-label-12 text-muted-foreground">{label}</span>
    </div>
  );
}

export function ScoreBreakdown({ fitScore, confidenceScore, priorityTier, breakdown, isOverridden, overrideReason, fitReasoning }: ScoreBreakdownProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const fitColor = fitScore >= 70 ? 'hsl(var(--chart-2))' : fitScore >= 40 ? 'hsl(var(--chart-5))' : 'hsl(var(--muted-foreground))';

  return (
    <div className="space-y-6">
      {isOverridden && (
        <div className="rounded-lg bg-chart-5/10 border border-chart-5/30 px-4 py-3 text-copy-14 text-chart-5">
          Score manually overridden: {overrideReason}
        </div>
      )}

      {fitReasoning && !isOverridden && (
        <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 space-y-1">
          <p className="text-label-12 text-muted-foreground">Why this score?</p>
          <p className="text-copy-14 text-foreground">{fitReasoning}</p>
        </div>
      )}

      <div className="flex items-center justify-around">
        <CircularGauge value={fitScore} label="Fit Score" color={fitColor} />
        <CircularGauge value={confidenceScore} label="Confidence" color="hsl(var(--primary))" />
        <Badge className={cn('text-label-12 px-3 py-1', TIER_COLORS[priorityTier] || 'bg-muted-foreground')}>
          {TIER_LABELS[priorityTier] || priorityTier}
        </Badge>
      </div>

      <div className="space-y-1">
        <h4 className="text-label-12 text-muted-foreground uppercase">Score Breakdown</h4>
        {breakdown.length === 0 ? (
          <p className="text-copy-14 text-muted-foreground">No signals evaluated yet.</p>
        ) : (
          breakdown.map((item, i) => (
            <div key={i} className="rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {expanded === i ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                  <span className="text-copy-14 truncate">{item.factor}</span>
                </div>
                <span className={cn('text-label-12 font-semibold shrink-0 ml-2', item.contribution < 0 ? 'text-destructive' : item.contribution > 0 ? 'text-chart-2' : 'text-muted-foreground')}>
                  {item.contribution > 0 ? `+${item.contribution}` : item.contribution}
                </span>
              </button>
              {expanded === i && (
                <div className="border-t border-border px-3 py-2.5 space-y-2 bg-muted/20">
                  <p className="text-copy-14 italic text-muted-foreground">&ldquo;{item.evidenceQuote}&rdquo;</p>
                  {item.sourceUrl && (
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-label-12 text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      {item.sourceUrl}
                    </a>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
