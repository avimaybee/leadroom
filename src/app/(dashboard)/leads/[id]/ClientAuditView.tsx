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
    <div className="space-y-4">
      <AuditDisplay
        leadId={leadId}
        audit={initialAudit}
        score={initialScore}
        manualOverrideScoreAction={manualOverrideScoreAction}
      />
    </div>
  );
}
