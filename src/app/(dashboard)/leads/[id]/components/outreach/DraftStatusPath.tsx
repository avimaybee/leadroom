'use client';

import { CheckCircle2, ChevronRight, XCircle, AlertCircle } from 'lucide-react';

interface DraftStatusPathProps {
  status: string;
  feedback?: string | null;
}

export function DraftStatusPath({ status, feedback }: DraftStatusPathProps) {
  const steps = [
    { key: 'DRAFT', label: 'Draft' },
    { key: 'REVIEW', label: 'Human Review' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'SENT', label: 'Sent' },
  ];

  // Map database states to steps index
  const getActiveStepIndex = (status: string) => {
    switch (status) {
      case 'DRAFT': return 0;
      case 'APPROVED': return 2;
      case 'SENT': return 3;
      case 'REJECTED': return -1; // rejected terminal state
      default: return 0;
    }
  };

  const activeIndex = getActiveStepIndex(status);

  if (status === 'REJECTED') {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl space-y-2 text-xs font-medium">
        <div className="flex items-center gap-1.5 font-bold">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>Outreach Draft Rejected</span>
        </div>
        {feedback ? (
          <p className="pl-5 leading-relaxed bg-destructive/5 p-2 rounded border border-destructive/10 font-semibold italic text-destructive/90">
            &ldquo;{feedback}&rdquo;
          </p>
        ) : (
          <p className="pl-5 text-destructive/80 italic font-semibold">No feedback reason provided.</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-muted/30 border border-border/60 p-3.5 rounded-2xl flex flex-wrap items-center gap-3 md:gap-5 text-xs">
      <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] shrink-0">Progress:</span>
      <div className="flex items-center gap-1.5 md:gap-3 flex-wrap">
        {steps.map((step, idx) => {
          // A step is completed if activeIndex is further, active if index matches, otherwise pending.
          const isCompleted = idx < activeIndex || (status === 'SENT' && idx === 3);
          const isActive = idx === activeIndex && status !== 'SENT';
          const isHumanReviewStep = step.key === 'REVIEW';

          // Human review step is marked active/complete depending on whether it's draft (index 0) or approved/sent (index 2/3)
          // For Draft status, "Human Review" is pending.
          // For Approved status, "Human Review" is completed and we are now on "Approved".
          let stepStatus: 'completed' | 'active' | 'pending' = 'pending';
          if (step.key === 'DRAFT') {
            stepStatus = status === 'DRAFT' ? 'active' : 'completed';
          } else if (step.key === 'REVIEW') {
            // Human review is active when the draft is saved and waiting for review
            stepStatus = status === 'DRAFT' ? 'pending' : 'completed';
          } else if (step.key === 'APPROVED') {
            stepStatus = status === 'APPROVED' ? 'active' : (status === 'SENT' ? 'completed' : 'pending');
          } else if (step.key === 'SENT') {
            stepStatus = status === 'SENT' ? 'active' : 'pending';
          }

          return (
            <div key={step.key} className="flex items-center gap-1.5 md:gap-3">
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
              <div
                className={`flex items-center gap-1.5 font-bold transition-colors ${
                  stepStatus === 'completed'
                    ? 'text-chart-2 font-bold'
                    : stepStatus === 'active'
                    ? 'text-primary font-extrabold'
                    : 'text-muted-foreground font-semibold'
                }`}
              >
                {stepStatus === 'completed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-chart-2" />
                ) : stepStatus === 'active' ? (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-primary animate-pulse" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/45 flex items-center justify-center text-[8px] font-bold shrink-0">
                    {idx + 1}
                  </div>
                )}
                <span>{step.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
