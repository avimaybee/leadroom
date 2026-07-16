'use client';

import { useState } from 'react';
import { Pencil, ChevronDown, ChevronRight, ShieldAlert, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { manualOverrideScoreAction } from '@/app/actions/audits';
import { toast } from 'sonner';
import { clientLog } from '@/lib/client-logger';
import { handleClientError } from '@/lib/actions/toast-error';

interface BreakdownItem {
  factor: string;
  contribution: number;
  evidenceQuote: string;
  sourceUrl: string;
}

interface ProspectScorePanelProps {
  prospectId: string;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  breakdown: BreakdownItem[];
  fitReasoning: string | null;
  isOverridden?: boolean;
  overrideReason?: string;
}

export function ProspectScorePanel({
  prospectId,
  fitScore,
  confidenceScore,
  priorityTier,
  breakdown,
  fitReasoning,
  isOverridden,
  overrideReason,
}: ProspectScorePanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideScore, setOverrideScore] = useState(fitScore ?? 50);
  const [overrideReason_, setOverrideReason_] = useState('');
  const [overriding, setOverriding] = useState(false);

  const scoreColor = !fitScore ? 'text-muted-foreground'
    : fitScore >= 70 ? 'text-chart-2'
    : fitScore >= 40 ? 'text-chart-5'
    : 'text-destructive';

  const confColor = !confidenceScore ? 'bg-muted'
    : confidenceScore >= 70 ? 'bg-chart-2'
    : confidenceScore >= 40 ? 'bg-chart-5'
    : 'bg-destructive';

  const tierLabel = priorityTier === 'tier1' ? 'Tier 1 (Strong)'
    : priorityTier === 'tier2' ? 'Tier 2 (Medium)'
    : priorityTier === 'tier3' ? 'Tier 3 (Low)'
    : priorityTier === 'disqualified' ? 'Disqualified'
    : 'Not Scored';

  const tierVariant = priorityTier === 'tier1' ? 'default' as const
    : priorityTier === 'tier2' ? 'secondary' as const
    : priorityTier === 'disqualified' ? 'destructive' as const
    : 'outline' as const;

  const handleOverride = async () => {
    if (!overrideReason_.trim() || overrideReason_.trim().length < 3) {
      toast.error('Please provide a reason (min 3 characters)');
      return;
    }
    setOverriding(true);
    clientLog.info('ProspectScorePanel', 'Manual override submitted', { prospectId, score: overrideScore });
    try {
      const form = new FormData();
      form.set('leadId', prospectId);
      form.set('score', overrideScore.toString());
      form.set('reason', overrideReason_.trim());
      const result = await manualOverrideScoreAction(null, form);
      if (result.error) {
        handleClientError('ProspectScorePanel', 'Manual override', new Error(result.error), result.error);
      } else {
        toast.success('Score overridden');
        clientLog.info('ProspectScorePanel', 'Manual override succeeded', { prospectId });
        setShowOverride(false);
      }
    } catch (err) {
      handleClientError('ProspectScorePanel', 'Manual override', err, 'Failed to override score');
    } finally {
      setOverriding(false);
    }
  };

  return (
    <div className="space-y-5">
      {isOverridden && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-chart-5/10 border border-chart-5/20">
          <Pencil className="w-4 h-4 text-chart-5 shrink-0" />
          <div>
            <p className="text-label-12 text-chart-5 font-semibold">Score manually overridden</p>
            <p className="text-copy-13 text-chart-5">{overrideReason}</p>
          </div>
        </div>
      )}

      {priorityTier === 'disqualified' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <p className="text-label-14 text-destructive">Disqualified</p>
            {fitReasoning && <p className="text-copy-14 text-destructive/90">{fitReasoning}</p>}
          </div>
        </div>
      )}

      <div>
        <span className="text-label-12 text-muted-foreground uppercase block mb-1">Fit Score</span>
        <span className={`text-heading-2xl ${scoreColor}`}>{fitScore ?? '--'}</span>
        <span className="text-copy-14 text-muted-foreground">/100</span>
      </div>

      <div>
        <span className="text-label-12 text-muted-foreground uppercase block mb-1">Confidence</span>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${confColor}`}
              style={{ width: `${confidenceScore ?? 0}%` }}
            />
          </div>
          <span className="text-label-14 font-semibold text-foreground">{confidenceScore ?? '--'}%</span>
        </div>
      </div>

      <div>
        <span className="text-label-12 text-muted-foreground uppercase block mb-1">Priority</span>
        <Badge variant={tierVariant}>{tierLabel}</Badge>
      </div>

      {fitReasoning && !isOverridden && (
        <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 space-y-1">
          <p className="text-label-12 text-muted-foreground">Fit Reasoning</p>
          <p className="text-copy-14 italic text-muted-foreground">{fitReasoning}</p>
        </div>
      )}

      <div className="space-y-1">
        <span className="text-label-12 text-muted-foreground uppercase block mb-2">Score Breakdown</span>
        {breakdown.length === 0 ? (
          <p className="text-copy-14 text-muted-foreground">No signals evaluated yet.</p>
        ) : (
          breakdown.map((item) => (
            <div key={item.factor} className="rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(expanded === item.factor ? null : item.factor)}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {expanded === item.factor ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                  <span className="text-copy-14 truncate">{item.factor}</span>
                </div>
                <span className={`text-label-12 font-semibold shrink-0 ml-2 px-2 py-0.5 rounded border ${
                  item.contribution < 0 ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                  item.contribution > 0 ? 'bg-chart-2/10 border-chart-2/20 text-chart-2' :
                  'bg-muted border-border text-muted-foreground'
                }`}>
                  {item.contribution < 0 ? 'Negative' : item.contribution > 0 ? 'Positive' : 'Neutral'}
                </span>
              </button>
              {expanded === item.factor && (
                <div className="border-t border-border px-3 py-2.5 space-y-2 bg-muted/20">
                  {item.evidenceQuote && (
                    <p className="text-copy-13 italic text-muted-foreground border-l-2 border-border pl-3">
                      &ldquo;{item.evidenceQuote}&rdquo;
                    </p>
                  )}
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-label-12 text-primary hover:underline decoration-border underline-offset-4"
                    >
                      {item.sourceUrl}
                    </a>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {!showOverride ? (
        <button
          type="button"
          onClick={() => setShowOverride(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors w-full justify-center"
        >
          <Pencil className="w-4 h-4" />
          Override Score
        </button>
      ) : (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <label className="text-label-12 text-muted-foreground block mb-1">New Score (1-100)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={overrideScore}
              onChange={(e) => setOverrideScore(parseInt(e.target.value) || 0)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-copy-14 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-label-12 text-muted-foreground block mb-1">Reason</label>
            <textarea
              value={overrideReason_}
              onChange={(e) => setOverrideReason_(e.target.value)}
              rows={2}
              placeholder="Why are you overriding this score?"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-copy-14 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={overriding}
              onClick={handleOverride}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {overriding && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Override
            </button>
            <button
              type="button"
              onClick={() => setShowOverride(false)}
              className="inline-flex items-center h-9 px-3 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
