'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuditSnapshot, LeadScore } from './components/audit/types';
import { AuditDisplay } from './components/audit/AuditDisplay';
import { ActionState } from '@/app/actions/audits';
import { useNotifications } from '@/components/NotificationProvider';

interface ClientAuditViewProps {
  leadId: string;
  initialAudit: AuditSnapshot | null;
  initialScore: LeadScore | null;
  triggerAuditAction: (leadId: string) => Promise<{ error: string | null; success?: boolean; jobId?: string | null }>;
  manualOverrideScoreAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}

export default function ClientAuditView({
  leadId,
  initialAudit,
  initialScore,
  triggerAuditAction,
  manualOverrideScoreAction,
}: ClientAuditViewProps) {
  const router = useRouter();
  const { recentJobUpdates } = useNotifications();

  // Job state
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    if (!pollingJobId) return;
    
    const status = recentJobUpdates[pollingJobId];
    if (status === 'SUCCESS') {
      setPollingJobId(null);
      setJobStatus(null);
      setIsAuditing(false);
      setJobError(null);
      router.refresh();
    } else if (status === 'ERROR') {
      setPollingJobId(null);
      setJobStatus(null);
      setIsAuditing(false);
      setJobError('Audit job execution failed. Please check notifications for details.');
    }
  }, [pollingJobId, recentJobUpdates, router]);

  const handleRunAudit = useCallback(async () => {
    if (isAuditing) return; // UI-level guard against duplicate clicks

    setJobError(null);
    setIsAuditing(true);
    setJobStatus('QUEUED');

    try {
      const res = await triggerAuditAction(leadId);
      if (res.error) {
        throw new Error(res.error);
      }
      if (res.jobId) {
        setPollingJobId(res.jobId);
        setJobStatus('QUEUED');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Audit request failed';
      setJobStatus(null);
      setIsAuditing(false);
      setJobError(msg);
    }
  }, [leadId, isAuditing, triggerAuditAction]);

  return (
    <div className="bg-muted/50 p-6 rounded-2xl border border-border/50 space-y-4">
      <h3 className="text-base font-bold text-card-foreground">
        Digital Presence Audit &amp; Lead Scoring
      </h3>

      {isAuditing && (
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <div className="text-center">
            <p className="text-xs font-bold text-card-foreground">Scraping site and running design audit...</p>
            <p className="text-xs text-muted-foreground font-semibold mt-1">Status: {jobStatus}. Takes up to 1-2 minutes.</p>
          </div>
        </div>
      )}

      {!isAuditing && (
        <AuditDisplay
          leadId={leadId}
          audit={initialAudit}
          score={initialScore}
          onRunAudit={handleRunAudit}
          isAuditing={isAuditing}
          auditError={jobError}
          manualOverrideScoreAction={manualOverrideScoreAction}
        />
      )}
    </div>
  );
}
