'use client';

import { AuditSnapshot, LeadScore } from './components/audit/types';
import { AuditDisplay } from './components/audit/AuditDisplay';
import { ActionState } from '@/app/actions/audits';

interface ClientAuditViewProps {
  leadId: string;
  initialAudit: AuditSnapshot | null;
  initialScore: LeadScore | null;
  manualOverrideScoreAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}

export default function ClientAuditView({
  leadId,
  initialAudit,
  initialScore,
  manualOverrideScoreAction,
}: ClientAuditViewProps) {
  return (
    <div className="bg-muted/50 p-6 rounded-2xl border border-border/50 space-y-4">
      <h3 className="text-base font-bold text-card-foreground">
        Digital Presence Audit &amp; Lead Scoring
      </h3>

      <AuditDisplay
        leadId={leadId}
        audit={initialAudit}
        score={initialScore}
        manualOverrideScoreAction={manualOverrideScoreAction}
      />
    </div>
  );
}
