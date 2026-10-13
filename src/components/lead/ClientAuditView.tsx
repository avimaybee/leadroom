'use client';

import { AuditSnapshot, LeadScore } from './components/audit/types';
import { AuditDisplay } from './components/audit/AuditDisplay';
import { ActionState } from '@/app/actions/audits';

interface ClientAuditViewProps {
  leadId: string;
  initialAudit: AuditSnapshot | null;
  initialScore: LeadScore | null;
  manualOverrideScoreAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  fitReasoning: string | null;
  researchTasks: any[];
  isResearchRunning: boolean;
}

export default function ClientAuditView({
  leadId,
  initialAudit,
  initialScore,
  manualOverrideScoreAction,
  fitScore,
  confidenceScore,
  priorityTier,
  fitReasoning,
  researchTasks,
  isResearchRunning,
}: ClientAuditViewProps) {
  if (isResearchRunning) {
    return (
      <div className="bg-card p-8 rounded-2xl border border-border text-center py-12 space-y-3">
        <h3 className="text-label-14 font-semibold text-foreground">Research in progress</h3>
        <p className="text-copy-13 text-muted-foreground max-w-sm mx-auto">
          Assessment data and design audit details will be displayed once the agentic research tasks are completed.
        </p>
      </div>
    );
  }

  if (!initialAudit && (!researchTasks || researchTasks.length === 0)) {
    return (
      <div className="bg-card p-8 rounded-2xl border border-border text-center py-12 space-y-3">
        <h3 className="text-label-14 font-semibold text-foreground">No research data yet</h3>
        <p className="text-copy-13 text-muted-foreground max-w-sm mx-auto">
          Run research enrichment on this lead to generate the design audit and fit assessment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AuditDisplay
        leadId={leadId}
        audit={initialAudit}
        score={initialScore}
        manualOverrideScoreAction={manualOverrideScoreAction}
        fitScore={fitScore}
        confidenceScore={confidenceScore}
        priorityTier={priorityTier}
        fitReasoning={fitReasoning}
        researchTasks={researchTasks}
      />
    </div>
  );
}
