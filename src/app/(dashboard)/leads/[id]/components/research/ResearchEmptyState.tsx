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
    <div className="bg-card p-6 rounded-xl border border-border text-center space-y-4 py-8">
      <div>
        <h4 className="text-heading-lg text-card-foreground">No Research Available</h4>
        <p className="text-copy-13 text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
          Gather website details automatically, or write observations manually to start drafting your message.
        </p>
      </div>

      {(enrichError || jobError) && (
        <div className="max-w-md mx-auto">
          {(enrichError || jobError)?.includes('429') ? (
            <div className="bg-chart-5/10 border border-chart-5/20 text-chart-5 p-4 rounded-md text-left text-label-12 space-y-2">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Daily Browser Limits Reached
              </div>
              <p className="leading-relaxed font-medium">
                Cloudflare Browser Run time limit has been exceeded for today (free tier cap). You can input manual research notes below to continue working without interruption.
              </p>
            </div>
          ) : (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-2.5 rounded-md text-label-12">
              {enrichError || jobError}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center items-center gap-3 pt-2">
        <Button onClick={onEnrich} disabled={isEnriching} size="sm">
          {isEnriching ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Starting...</>
          ) : 'Start Research'}
        </Button>
        <Button onClick={onEdit} variant="link" size="sm">
          Add Notes Manually
        </Button>
      </div>
    </div>
  );
}
