'use client';

import { useState, useMemo } from 'react';
import { ShieldAlert, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { calculateScore, type IcpSignalDef } from '@/lib/domain/scoring';

interface ScoringPreviewProps {
  positiveSignals: IcpSignalDef[];
  negativeSignals: IcpSignalDef[];
  disqualifiers: string[];
}

export function ScoringPreview({ positiveSignals, negativeSignals, disqualifiers }: ScoringPreviewProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const allSignals = useMemo(
    () => [
      ...positiveSignals.map((s) => ({ ...s, type: 'positive' as const })),
      ...negativeSignals.map((s) => ({ ...s, type: 'negative' as const })),
    ],
    [positiveSignals, negativeSignals]
  );

  const toggleSignal = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const result = useMemo(() => {
    const matched = allSignals
      .filter((s) => checked.has(s.name))
      .map((s) => ({
        signalName: s.name,
        matchedIcpRule: s.name,
        matchStrength: 'strong' as const,
        evidenceQuote: '',
        sourceUrl: '',
      }));

    const icpProfile = { positiveSignals, negativeSignals, disqualifiers };
    return calculateScore({ icpProfile, extractedSignals: matched, researchConfidence: 90 });
  }, [checked, positiveSignals, negativeSignals, disqualifiers, allSignals]);

  if (allSignals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Info className="w-4 h-4" />
          <p className="text-copy-14">Add positive and negative signals to preview scoring.</p>
        </div>
      </div>
    );
  }

  const scoreColor =
    result.priorityTier === 'disqualified' || result.fitScore === 0
      ? 'text-destructive'
      : result.priorityTier === 'tier1'
        ? 'text-chart-2'
        : result.priorityTier === 'tier2'
          ? 'text-chart-5'
          : 'text-muted-foreground';

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-label-12 uppercase text-muted-foreground">Scoring Preview</label>
        <span className="text-copy-13 text-muted-foreground">Simulate a prospect to verify weights</span>
      </div>

      <div className="space-y-2">
        {positiveSignals.map((s) => (
          <label key={s.name} className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={checked.has(s.name)}
              onChange={() => toggleSignal(s.name)}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <span className="text-copy-14 flex-1">{s.name}</span>
            <span className="text-label-12 text-chart-2 font-semibold">+{s.weight}</span>
          </label>
        ))}
        {negativeSignals.map((s) => (
          <label key={s.name} className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={checked.has(s.name)}
              onChange={() => toggleSignal(s.name)}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <span className="text-copy-14 flex-1">{s.name}</span>
            <span className="text-label-12 text-destructive font-semibold">-{s.weight}</span>
          </label>
        ))}
        {disqualifiers.length > 0 && (
          <details className="group pt-2 border-t border-border/40">
            <summary className="text-label-12 text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Hard Disqualifiers ({disqualifiers.length})
            </summary>
            <div className="mt-2 space-y-1">
              {disqualifiers.map((d) => (
                <div key={d} className="flex items-center gap-2 text-copy-13 text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-destructive" />
                  {d}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="border-t border-border pt-4">
        {result.priorityTier === 'disqualified' ? (
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-label-14">Prospect is disqualified</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <span className="text-label-12 text-muted-foreground uppercase block mb-1">Fit Score</span>
              <span className={`text-heading-2xl ${scoreColor}`}>{result.fitScore}</span>
              <span className="text-copy-14 text-muted-foreground">/100</span>
            </div>
            <div>
              <span className="text-label-12 text-muted-foreground uppercase block mb-1">Priority</span>
              <Badge variant={result.priorityTier === 'tier1' ? 'default' : 'secondary'}>
                {result.priorityTier === 'tier1' ? 'Tier 1' : result.priorityTier === 'tier2' ? 'Tier 2' : 'Tier 3'}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
