'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Lightbulb, ArrowRight } from 'lucide-react';
import type { NBAResult } from '@/services/lead';
import { logNbaActionAction, dismissNbaActionAction } from '@/app/actions/tracking';
import { toast } from 'sonner';

const PRIORITY_VARIANTS: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  High: 'destructive',
  Medium: 'secondary',
  Low: 'outline',
};

interface Props {
  recommendations: NBAResult[];
  leadId?: string;
}

export function NextBestActionsList({ recommendations, leadId }: Props) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? recommendations : recommendations.slice(0, 3);

  if (recommendations.length === 0) {
    return (
      <div className="bg-card p-6 rounded-xl border border-border">
        <div className="flex items-center gap-2 text-label-12 text-muted-foreground uppercase mb-3">
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Recommended Next Actions</span>
        </div>
        <p className="text-copy-14 text-muted-foreground">
          No recommendations — all signals are clear or the lead is in a terminal stage.
        </p>
      </div>
    );
  }

  const handleClick = (r: NBAResult) => {
    if (leadId) {
      logNbaActionAction(leadId, r.action, r.priority).catch((err) => console.error('Failed to log NBA action', err));
    }
  };

  return (
    <div className="bg-card p-6 rounded-xl border border-border space-y-3">
      <div className="flex items-center gap-2 text-label-12 text-muted-foreground uppercase">
        <Lightbulb className="w-3.5 h-3.5" />
        <span>Recommended Next Actions</span>
        <span className="ml-auto text-label-12">{recommendations.length} signals</span>
      </div>

      <div className="space-y-2">
        {displayed.map((r) => (
          <div
            key={r.action}
            className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-copy-14 font-semibold text-foreground">{r.action}</span>
                <Badge variant={PRIORITY_VARIANTS[r.priority]} className="uppercase">
                  {r.priority}
                </Badge>
              </div>
              <p className="text-copy-13 text-muted-foreground mt-0.5">{r.rationale}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {leadId && (
                <Button 
                  variant="ghost" 
                  size="icon-xs" 
                  title="Dismiss recommendation"
                  onClick={async () => {
                    const signal = r.action.toLowerCase().includes('overdue') ? 'overdue_task'
                      : r.action.toLowerCase().includes('task') ? 'future_task'
                      : r.action.toLowerCase().includes('stall') ? 'stale'
                      : r.action.toLowerCase().includes('draft') ? 'unsent_draft'
                      : r.action.toLowerCase().includes('research') ? 'no_research'
                      : r.action.toLowerCase().includes('audit') ? 'no_audit'
                      : 'unread';
                    await dismissNbaActionAction(leadId, signal);
                    toast.success('Recommendation dismissed');
                    router.refresh();
                  }}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
              {r.link && (
                <Link href={r.link} onClick={() => handleClick(r)}>
                  <Button variant="ghost" size="icon-xs">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {recommendations.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-label-12"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show fewer' : `Show all ${recommendations.length} recommendations`}
        </Button>
      )}
    </div>
  );
}
