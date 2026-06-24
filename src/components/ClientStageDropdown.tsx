'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
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
  onStageChange: (newStage: string) => Promise<void>;
}

export function ClientStageDropdown({ currentStage, leadName, onStageChange }: ClientStageDropdownProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const currentIdx = PIPELINE_STAGES.indexOf(currentStage as PipelineStage);
  const isBackward = (target: string) => {
    const targetIdx = PIPELINE_STAGES.indexOf(target as PipelineStage);
    return targetIdx >= 0 && targetIdx < currentIdx;
  };

  const handleSelect = (newStage: string) => {
    if (newStage === currentStage) return;
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
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {isPending && <Loader2 className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

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
