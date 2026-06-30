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
  tier1: 'Tier 1 (Strong)',
  tier2: 'Tier 2 (Medium)',
  tier3: 'Tier 3 (Low)',
  disqualified: 'Disqualified',
};

export function ScoreBreakdown({
  confidenceScore,
  priorityTier,
  breakdown,
  isOverridden,
  overrideReason,
  fitReasoning,
}: ScoreBreakdownProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

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

      <div className="flex flex-wrap items-center gap-6 pb-2">
        <div className="flex flex-col gap-1">
          <span className="text-label-12 text-muted-foreground uppercase">Fit Assessment</span>
          <Badge className={cn('text-label-12 px-3 py-1 font-semibold w-fit', TIER_COLORS[priorityTier] || 'bg-muted-foreground')}>
            {TIER_LABELS[priorityTier] || priorityTier}
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-label-12 text-muted-foreground uppercase">Data Confidence</span>
          <Badge className={cn('text-label-12 px-3 py-1 font-semibold w-fit', 
            confidenceScore >= 70 ? 'bg-chart-2/10 text-chart-2 border border-chart-2/20' : 
            confidenceScore >= 40 ? 'bg-chart-5/10 text-chart-5 border border-chart-5/20' : 
            'bg-destructive/10 text-destructive border border-destructive/20'
          )}>
            {confidenceScore >= 70 ? 'High Confidence' : confidenceScore >= 40 ? 'Medium Confidence' : 'Low Confidence'}
          </Badge>
        </div>
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
                <span className={cn('text-label-12 font-semibold shrink-0 ml-2 px-2 py-0.5 rounded border', 
                  item.contribution < 0 ? 'bg-destructive/10 border-destructive/20 text-destructive' : 
                  item.contribution > 0 ? 'bg-chart-2/10 border-chart-2/20 text-chart-2' : 
                  'bg-muted border-border text-muted-foreground'
                )}>
                  {item.contribution < 0 ? 'Negative Signal' : item.contribution > 0 ? 'Positive Match' : 'Neutral'}
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
