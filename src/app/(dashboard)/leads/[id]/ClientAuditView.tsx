'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuditSnapshot, LeadScore } from './components/audit/types';
import { AuditDisplay } from './components/audit/AuditDisplay';
import { ActionState } from '@/app/actions/audits';
import { z } from 'zod';

const JobStatusResponseSchema = z.object({
  status: z.string(),
  errorSummary: z.string().nullable().optional(),
});

interface ClientAuditViewProps {
  leadId: string;
  initialAudit: AuditSnapshot | null;
  initialScore: LeadScore | null;
  triagePriority: string;
  triageReason: string | null;
  triggerAuditAction: (leadId: string) => Promise<{ error: string | null; success?: boolean; jobId?: string | null }>;
  manualOverrideScoreAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}

export default function ClientAuditView({
  leadId,
  initialAudit,
  initialScore,
  triagePriority,
  triageReason,
  triggerAuditAction,
  manualOverrideScoreAction,
}: ClientAuditViewProps) {
  const router = useRouter();

  // Job Polling state
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Stable ref to router.refresh() — prevents the polling useEffect from needing
  // router in its dep array (useRouter() returns a new reference on every render,
  // which would otherwise restart the interval every time router.refresh() fires).
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    refreshRef.current = () => router.refresh();
  }); // no dep array: always syncs to latest router instance

  // Polling effect — ONLY depends on pollingJobId, NOT on router
  useEffect(() => {
    if (!pollingJobId) return;

    let stopped = false;

    const checkJobStatus = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/jobs/${pollingJobId}`);
        if (!res.ok) {
          throw new Error('Failed to verify audit job status');
        }

        const json = await res.json();
        const data = JobStatusResponseSchema.parse(json);
        if (stopped) return;
        setJobStatus(data.status);

        if (data.status === 'COMPLETED') {
          stopped = true;
          setPollingJobId(null);
          setJobStatus(null);
          setIsAuditing(false);
          setJobError(null);
          refreshRef.current(); // stable ref — no dep array issue
        } else if (data.status === 'FAILED') {
          stopped = true;
          setPollingJobId(null);
          setJobStatus(null);
          setIsAuditing(false);
          setJobError(data.errorSummary || 'Audit job execution failed.');
        }
      } catch (err: unknown) {
        if (stopped) return;
        console.error('Audit job status check error:', err);
        stopped = true;
        setPollingJobId(null);
        setJobStatus(null);
        setIsAuditing(false);
        setJobError('Failed to verify status. Please refresh.');
      }
    };

    checkJobStatus();
    const intervalId = setInterval(checkJobStatus, 5000);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [pollingJobId]); // ← deliberately omits router

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
          triagePriority={triagePriority}
          triageReason={triageReason}
          onRunAudit={handleRunAudit}
          isAuditing={isAuditing}
          auditError={jobError}
          manualOverrideScoreAction={manualOverrideScoreAction}
        />
      )}
    </div>
  );
}
