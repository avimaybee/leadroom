'use client';

import { useState } from 'react';
import { Lightbulb, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { applyLearningSuggestionAction, dismissLearningSuggestionAction } from '@/app/actions/learning';

interface SuggestedChange {
  type: string;
  target: string;
  currentValue?: number;
  suggestedValue?: number;
  reason: string;
}

interface SupportingEvidence {
  totalOutcomes: number;
  positiveOutcomes: number;
  negativeOutcomes: number;
  signalAppearanceRate: number;
  sampleProspectIds: string[];
}

interface Suggestion {
  id: string;
  suggestedChange: string;
  supportingEvidence: string;
  createdAt: Date | null;
}

interface LearningInboxProps {
  initialSuggestions: Suggestion[];
}

export function LearningInbox({ initialSuggestions }: LearningInboxProps) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [applying, setApplying] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const handleApply = async (id: string) => {
    setApplying(id);
    const result = await applyLearningSuggestionAction(id);
    if (result.success) {
      setSuggestions(prev => prev.filter(s => s.id !== id));
    }
    setApplying(null);
  };

  const handleDismiss = async (id: string) => {
    setDismissing(id);
    const result = await dismissLearningSuggestionAction(id);
    if (result.success) {
      setSuggestions(prev => prev.filter(s => s.id !== id));
    }
    setDismissing(null);
  };

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <Lightbulb className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-heading-lg text-foreground">No suggestions yet</h3>
        <p className="text-copy-14 text-muted-foreground mt-1 max-w-md mx-auto">
          As you log outcomes, the system will identify patterns and suggest ICP improvements here.
        </p>
        <Link
          href="/prospects"
          className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
        >
          Review prospects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {suggestions.map(s => {
        let change: SuggestedChange = { type: '', target: '', reason: '' };
        let evidence: SupportingEvidence | null = null;
        try { change = JSON.parse(s.suggestedChange); } catch {}
        try { evidence = JSON.parse(s.supportingEvidence); } catch {}

        return (
          <div key={s.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-chart-5/10 flex items-center justify-center shrink-0">
                <Lightbulb className="w-4 h-4 text-chart-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-label-14 text-foreground">
                  {change.type?.replace(/_/g, ' ')} &ldquo;{change.target}&rdquo;
                </p>
                <p className="text-copy-14 text-muted-foreground mt-1">
                  {change.reason}
                </p>
                {change.currentValue !== undefined && (
                  <p className="text-label-12 text-muted-foreground mt-0.5">
                    Current: {change.currentValue}
                    {change.suggestedValue !== undefined && ` → Suggested: ${change.suggestedValue}`}
                  </p>
                )}
              </div>
            </div>

            {evidence && (
              <details className="group">
                <summary className="text-label-12 text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Supporting data ({evidence.totalOutcomes} outcomes)
                </summary>
                <div className="border-l-2 border-border pl-3 mt-2 space-y-1">
                  <p className="text-copy-13 text-muted-foreground">Total outcomes: {evidence.totalOutcomes}</p>
                  <p className="text-copy-13 text-muted-foreground">
                    Positive: {evidence.positiveOutcomes} · Negative: {evidence.negativeOutcomes}
                  </p>
                  <p className="text-copy-13 text-muted-foreground">
                    Signal appearance rate: {evidence.signalAppearanceRate}%
                  </p>
                  {evidence.sampleProspectIds?.length > 0 && (
                    <p className="text-copy-13 text-muted-foreground">
                      Sample prospects: {evidence.sampleProspectIds.length} prospects
                    </p>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={applying === s.id || dismissing === s.id}
                onClick={() => handleApply(s.id)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-chart-2 text-white text-label-14 hover:bg-chart-2/90 transition-colors disabled:opacity-50"
              >
                {applying === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {applying === s.id ? 'Applying...' : 'Apply'}
              </button>
              <button
                type="button"
                disabled={applying === s.id || dismissing === s.id}
                onClick={() => handleDismiss(s.id)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                {dismissing === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
