'use client';

import { useState, useTransition, useRef, useEffect, useMemo } from 'react';
import { Loader2, AlertTriangle, ChevronDown, Check } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentIdx = Math.max(0, PIPELINE_STAGES.indexOf(
    PIPELINE_STAGES.includes(currentStage as PipelineStage) ? currentStage as PipelineStage : 'New'
  ));
  const isBackward = (target: string) => {
    if (!PIPELINE_STAGES.includes(target as PipelineStage)) return false;
    const targetIdx = PIPELINE_STAGES.indexOf(target as PipelineStage);
    return targetIdx >= 0 && targetIdx < currentIdx;
  };

  const blockedStages = useMemo(() => new Map(Object.entries(unmetRequirements || {})), [unmetRequirements]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (newStage: string) => {
    if (newStage === currentStage) {
      setIsOpen(false);
      return;
    }
    if (blockedStages.has(newStage)) return; // blocked, do not allow selection
    
    setIsOpen(false);
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
      <div className="relative inline-block text-left" ref={containerRef}>
        <button
          type="button"
          onClick={() => !isPending && setIsOpen(!isOpen)}
          disabled={isPending}
          className="inline-flex min-h-10 w-48 items-center justify-between rounded-md border border-border bg-card px-3 py-1.5 text-label-14 font-semibold text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/30 transition-colors disabled:opacity-50"
        >
          <span className="truncate">{currentStage}</span>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 z-50 mt-1 w-56 origin-top-right rounded-md border border-border bg-card shadow-lg py-1 focus:outline-none animate-in fade-in-50 slide-in-from-top-1 duration-100">
            {PIPELINE_STAGES.map((s) => {
              const blocked = blockedStages.has(s);
              const isCurrent = s === currentStage;
              
              return (
                <div
                  key={s}
                  onMouseEnter={() => setHoveredStage(s)}
                  onMouseLeave={() => setHoveredStage(null)}
                  onClick={() => !blocked && handleSelect(s)}
                  className={`group relative flex w-full select-none items-center justify-between px-3 py-2 text-label-14 font-semibold transition-colors ${
                    blocked
                      ? 'text-muted-foreground/60 cursor-not-allowed bg-transparent'
                      : isCurrent
                      ? 'bg-primary/10 text-primary cursor-default'
                      : 'text-foreground hover:bg-muted/40 cursor-pointer'
                  }`}
                >
                  <span className="truncate">{s}</span>
                  {isCurrent && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}

                  {/* Tooltip for blocked stages */}
                  {blocked && hoveredStage === s && (
                    <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 w-64 z-[60] bg-card border border-border p-3 rounded-lg shadow-xl text-label-12 text-muted-foreground font-medium animate-in fade-in-50 slide-in-from-right-1 duration-150 text-left">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground mb-0.5">Stage Locked</p>
                          <p className="leading-relaxed text-muted-foreground">{blockedStages.get(s)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
