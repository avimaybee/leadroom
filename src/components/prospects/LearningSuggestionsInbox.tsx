'use client';

import { useState } from 'react';
import { Lightbulb, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { applyLearningSuggestionAction, dismissLearningSuggestionAction } from '@/app/actions/learning';

interface SupportingEvidence {
  totalOutcomes: number;
  positiveOutcomes: number;
  negativeOutcomes: number;
  signalAppearanceRate: number;
  sampleProspectIds: string[];
}

interface SuggestedChange {
  type: string;
  target: string;
  currentValue?: number;
  suggestedValue?: number;
  reason: string;
}

interface Suggestion {
  id: string;
  suggestedChange: string;
  supportingEvidence: string;
  createdAt: Date | null;
}

interface LearningSuggestionsInboxProps {
  suggestions: Suggestion[];
}

export function LearningSuggestionsInbox({ suggestions: initial }: LearningSuggestionsInboxProps) {
  const [suggestions, setSuggestions] = useState(initial);
  const [applying, setApplying] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const handleApply = async (id: string) => {
    setApplying(id);
    const result = await applyLearningSuggestionAction(id);
    if (result.success) {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    }
    setApplying(null);
  };

  const handleDismiss = async (id: string) => {
    setDismissing(id);
    const result = await dismissLearningSuggestionAction(id);
    if (result.success) {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    }
    setDismissing(null);
  };

  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
        <Lightbulb className="w-8 h-8 mx-auto text-muted-foreground/40" />
        <p className="text-copy-14 text-muted-foreground">
          No pending optimization suggestions. Log more outcomes to generate suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s) => {
        let change: SuggestedChange = { type: '', target: '', reason: '' };
        let evidence: SupportingEvidence | null = null;
        try {
          change = JSON.parse(s.suggestedChange);
          evidence = JSON.parse(s.supportingEvidence);
        } catch {}

        return (
          <div key={s.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-label-12">
                    {change.type?.replace(/_/g, ' ') || 'Unknown'}
                  </Badge>
                  <span className="text-copy-14 font-medium text-foreground truncate">
                    {change.target}
                  </span>
                </div>
                <p className="text-copy-14 text-muted-foreground">{change.reason}</p>
                {change.currentValue !== undefined && (
                  <p className="text-label-12 text-muted-foreground">
                    Current: {change.currentValue}
                    {change.suggestedValue !== undefined && ` → Suggested: ${change.suggestedValue}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleApply(s.id)}
                  disabled={applying === s.id || dismissing === s.id}
                >
                  {applying === s.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                  Apply
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => handleDismiss(s.id)}
                  disabled={applying === s.id || dismissing === s.id}
                >
                  {dismissing === s.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                  Dismiss
                </Button>
              </div>
            </div>
            {evidence && (
              <div className="flex flex-wrap gap-3 text-label-12 text-muted-foreground border-t border-border pt-2">
                <span>{evidence.totalOutcomes} total outcomes</span>
                <span className="text-chart-2">{evidence.positiveOutcomes} positive</span>
                <span className="text-destructive">{evidence.negativeOutcomes} negative</span>
                <span>{evidence.signalAppearanceRate}% appearance rate</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
