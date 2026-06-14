'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResearchEmptyStateProps {
  enrichError: string | null;
  jobError: string | null;
  onEnrich: () => void;
  onEdit: () => void;
  isEnriching?: boolean;
}

export function ResearchEmptyState({
  enrichError,
  jobError,
  onEnrich,
  onEdit,
  isEnriching = false,
}: ResearchEmptyStateProps) {
  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm text-center space-y-4 py-8">
      <div>
        <h4 className="text-base font-bold text-card-foreground">No Research Available</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
          Run an automated enrichment scan or input custom branding observations to kickstart outreach preparation.
        </p>
      </div>

      {(enrichError || jobError) && (
        <div className="max-w-md mx-auto">
          {(enrichError || jobError)?.includes('429') ? (
            <div className="bg-chart-5/10 border border-chart-5/20 text-chart-5 p-4 rounded-xl text-left text-xs space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Daily Browser Limits Reached
              </div>
              <p className="leading-relaxed font-medium">
                Cloudflare Browser Run time limit has been exceeded for today (free tier cap). You can input manual research notes below to continue working without interruption.
              </p>
            </div>
          ) : (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-2.5 rounded-lg text-xs font-semibold">
              {enrichError || jobError}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center items-center gap-3 pt-2">
        <Button onClick={onEnrich} disabled={isEnriching} size="sm">
          {isEnriching ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Starting...</>
          ) : 'Enrich via AI'}
        </Button>
        <Button onClick={onEdit} variant="link" size="sm">
          Add Notes Manually
        </Button>
      </div>
    </div>
  );
}
