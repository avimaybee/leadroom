'use client';

import { Loader2, Check, XCircle } from 'lucide-react';

interface ResearchLoadingStateProps {
  jobStatus: string | null;
  leadId: string;
  onCancel: () => void;
}

const PIPELINE_STEPS = [
  {
    label: 'Job Queued',
    desc: 'Research task created and submitted to the workflow',
    activeWhen: ['QUEUED', 'RUNNING', 'COMPLETED'],
  },
  {
    label: 'Scraping Website',
    desc: 'Fetching and parsing the prospect\'s website content',
    activeWhen: ['RUNNING', 'COMPLETED'],
  },
  {
    label: 'Running AI Analysis',
    desc: 'Research engine analysing company profile, brand presence, and pain signals',
    activeWhen: ['RUNNING', 'COMPLETED'],
  },
  {
    label: 'Persisting Evidence',
    desc: 'Storing research snapshot, audit findings, contacts, and fit score',
    activeWhen: ['COMPLETED'],
  },
];

export function ResearchLoadingState({ jobStatus, leadId, onCancel }: ResearchLoadingStateProps) {
  const status = jobStatus || 'QUEUED';

  return (
    <div className="bg-card p-8 rounded-2xl border border-border max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <h4 className="text-label-14 text-foreground uppercase">Research In Progress</h4>
            <p className="text-label-12 text-muted-foreground mt-0.5">AI agent is gathering evidence on this prospect</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-lg text-label-12 uppercase bg-chart-5/10 text-chart-5 border border-chart-5/20 animate-pulse">
          {status}
        </span>
      </div>

      {/* Timeline Steps */}
      <div className="relative pl-6 border-l border-border space-y-5 ml-4">
        {PIPELINE_STEPS.map((step, idx) => {
          const isActive = step.activeWhen.includes(status);
          const isCompleted = status === 'COMPLETED';
          // The "current" step is the last active step when not yet completed
          const isCurrentStep = isActive && !isCompleted && idx === PIPELINE_STEPS.filter(s => s.activeWhen.includes(status)).length - 1;

          return (
            <div key={idx} className="relative">
              <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                isCompleted && isActive
                  ? 'bg-chart-2 border-chart-2 text-white'
                  : isCurrentStep
                    ? 'bg-primary border-primary text-white animate-pulse'
                    : isActive
                      ? 'bg-primary/30 border-primary/50'
                      : 'bg-card border-border'
              }`}>
                {isCompleted && isActive ? (
                  <Check className="w-2.5 h-2.5" />
                ) : isCurrentStep ? (
                  <div className="w-1.5 h-1.5 bg-card rounded-full" />
                ) : null}
              </div>
              <div>
                <p className={`text-label-12 ${isCurrentStep ? 'text-primary' : (isCompleted && isActive) ? 'text-foreground' : isActive ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                  {step.label}
                </p>
                <p className="text-label-12 text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 flex justify-center">
        <button
          onClick={async () => {
            try {
              await fetch(`/api/leads/${leadId}/research/cancel`, { method: 'POST' });
            } catch (_) {}
            onCancel();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-12 text-destructive hover:bg-destructive/10 border border-destructive/30 hover:border-destructive/50 transition"
        >
          <XCircle className="w-3.5 h-3.5" />
          Cancel Research
        </button>
      </div>
    </div>
  );
}
