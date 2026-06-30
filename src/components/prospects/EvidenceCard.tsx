'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EvidenceCardProps {
  evidenceQuote: string;
  sourceUrl: string;
  confidence: number;
}

export function EvidenceCard({ evidenceQuote, sourceUrl, confidence }: EvidenceCardProps) {
  const confidenceColor = confidence >= 70 ? 'bg-chart-2' : confidence >= 40 ? 'bg-chart-5' : 'bg-destructive';

  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
      <p className="text-copy-14 italic text-foreground">&ldquo;{evidenceQuote}&rdquo;</p>
      <div className="flex items-center justify-between gap-2">
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-label-12 text-primary hover:underline truncate">
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{sourceUrl}</span>
          </a>
        ) : (
          <span className="text-label-12 text-muted-foreground">No source</span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={cn('w-2 h-2 rounded-full', confidenceColor)} />
          <span className="text-label-12 text-muted-foreground">{confidence}%</span>
        </div>
      </div>
    </div>
  );
}
