'use client';

import { Loader2, Check, XCircle } from 'lucide-react';

interface ResearchLoadingStateProps {
  jobStatus: string | null;
  leadId: string;
  onCancel: () => void;
}

export function ResearchLoadingState({ jobStatus, leadId, onCancel }: ResearchLoadingStateProps) {
  return (
    <div className="bg-card p-8 rounded-2xl border border-border max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <h4 className="text-label-14 text-foreground uppercase">Research Pipeline Executing</h4>
            <p className="text-label-12 text-muted-foreground mt-0.5">Cloudflare Workflows durable agent run</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-lg text-label-12 uppercase bg-chart-5/10 text-chart-5 border border-chart-5/20 animate-pulse">
          {jobStatus || 'QUEUED'}
        </span>
      </div>

      {/* Timeline Steps */}
      <div className="relative pl-6 border-l border-border space-y-5 ml-4">
        {[
          {
            label: 'Queueing Background Work',
            desc: 'Acquiring sandbox instance',
            activeStatus: 'QUEUED',
          },
          {
            label: 'Fetching Website Contents',
            desc: 'Extracting clean markdown via Jina Reader',
            activeStatus: 'RUNNING',
          },
          {
            label: 'LLM Footprint & Branding Audit',
            desc: 'Analyzing layout, copywriting, positioning, and pain points',
            activeStatus: 'RUNNING',
          },
          {
            label: 'Finalizing Snapshot',
            desc: 'Storing research, evidence URLs, and opportunity hypotheses',
            activeStatus: 'COMPLETED',
          },
        ].map((step, idx) => {
          const stepStatuses = ['QUEUED', 'RUNNING', 'RUNNING', 'COMPLETED'];
          const isStepActive = stepStatuses.indexOf(jobStatus || '') >= idx;
          const isStepCompleted = stepStatuses.indexOf('COMPLETED') >= idx && (jobStatus === 'COMPLETED');
          const isCurrentStep = stepStatuses.indexOf(jobStatus || '') === idx;

          return (
            <div key={idx} className="relative">
              <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                isStepCompleted
                  ? 'bg-chart-2 border-chart-2 text-white'
                  : isCurrentStep
                    ? 'bg-primary border-primary text-white animate-pulse'
                    : 'bg-card border-border'
              }`}>
                {isStepCompleted ? (
                  <Check className="w-2.5 h-2.5" />
                ) : isCurrentStep ? (
                  <div className="w-1.5 h-1.5 bg-card rounded-full" />
                ) : null}
              </div>
              <div>
                <p className={`text-label-12 ${isCurrentStep ? 'text-primary' : isStepCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
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
