'use client';

import { useState, useTransition } from 'react';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
import { PIPELINE_STAGES, type PipelineStage } from '@/services/lead';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ClientStageDropdownProps {
  currentStage: string;
  leadName: string;
  leadId?: string;
  unmetRequirements?: Record<string, string>;
  onStageChange: (newStage: string) => Promise<void>;
}

export function ClientStageDropdown({ currentStage, leadName, leadId, unmetRequirements, onStageChange }: ClientStageDropdownProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  const currentIdx = PIPELINE_STAGES.indexOf(currentStage as PipelineStage);
  const isBackward = (target: string) => {
    const targetIdx = PIPELINE_STAGES.indexOf(target as PipelineStage);
    return targetIdx >= 0 && targetIdx < currentIdx;
  };

  const blockedStages = new Map(Object.entries(unmetRequirements || {}));

  const handleSelect = (newStage: string) => {
    if (newStage === currentStage) return;
    if (blockedStages.has(newStage)) return; // blocked, don't allow selection
    if (isBackward(newStage)) {
      setPendingStage(newStage);
      setIsConfirmOpen(true);
    } else {
      commitChange(newStage);
    }
  };

  const commitChange = (stage: string) => {
    startTransition(async () => {
      try {
        await onStageChange(stage);
      } finally {
        setPendingStage(null);
      }
    });
  };

  return (
    <>
      <div className="relative">
        <select
          id="lead-stage"
          value={currentStage}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={isPending}
          className="min-h-10 rounded-md border border-border bg-card py-1.5 pl-3 pr-9 text-label-14 font-semibold text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/30 transition-colors disabled:opacity-50"
        >
          {PIPELINE_STAGES.map((s) => {
            const blocked = blockedStages.has(s);
            return (
              <option
                key={s}
                value={s}
                disabled={blocked}
                className={blocked ? 'text-muted-foreground' : ''}
              >
                {blocked ? `🔒 ${s}` : s}
              </option>
            );
          })}
        </select>
        {isPending && <Loader2 className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Requirement block tooltip */}
      {hoveredStage && blockedStages.has(hoveredStage) && (
        <div className="mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-label-12 text-destructive flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{blockedStages.get(hoveredStage)}</span>
        </div>
      )}

      {/* Requirement indicators below dropdown */}
      {blockedStages.size > 0 && (
        <div className="mt-2 space-y-1 p-2 rounded-md bg-muted/20 border border-border">
          <p className="text-label-12 text-muted-foreground font-semibold flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Stage requirements
          </p>
          {Array.from(blockedStages.entries()).map(([stage, reason]) => (
            <p key={stage} className="text-label-12 text-muted-foreground ml-4">
              <span className="font-medium text-foreground">{stage}:</span> {reason}
            </p>
          ))}
        </div>
      )}

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move lead backward?</DialogTitle>
            <DialogDescription>
              Moving <strong>{leadName}</strong> from <strong>{currentStage}</strong> to{' '}
              <strong>{pendingStage}</strong> will reset its pipeline progress. This may affect
              stale detection and analytics.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="default"
              onClick={() => {
                setIsConfirmOpen(false);
                if (pendingStage) commitChange(pendingStage);
              }}
            >
              Move backward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
