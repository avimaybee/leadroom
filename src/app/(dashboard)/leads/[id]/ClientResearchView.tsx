'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { ResearchSnapshot } from './components/research/types';
import { ResearchLoadingState } from './components/research/ResearchLoadingState';
import { ResearchEmptyState } from './components/research/ResearchEmptyState';
import { ResearchEditForm } from './components/research/ResearchEditForm';
import { ResearchDisplay } from './components/research/ResearchDisplay';

interface ClientResearchViewProps {
  leadId: string;
  initialSnapshot: ResearchSnapshot | null;
  saveResearchSnapshotAction: (
    prevState: { error?: string | null; success?: boolean } | null | undefined,
    formData: FormData
  ) => Promise<{ error?: string | null; success?: boolean } | null | undefined>;
}

export default function ClientResearchView({
  leadId,
  initialSnapshot,
  saveResearchSnapshotAction,
}: ClientResearchViewProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'opportunity'>('overview');
  const [state, formAction] = useActionState(saveResearchSnapshotAction, undefined);

  const [enrichError, setEnrichError] = useState<string | null>(null);
  // Guard to prevent duplicate trigger clicks before pollingJobId is set
  const [isEnriching, setIsEnriching] = useState(false);

  // Polling state for background jobs
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  // Keep a stable ref to router.refresh() so the polling useEffect doesn't need
  // router in its dependency array. useRouter() returns a new object reference
  // on every render, which would otherwise cause the polling interval to restart
  // whenever router.refresh() triggers a re-render — creating duplicate intervals.
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    refreshRef.current = () => router.refresh();
  }); // no dep array: always syncs to latest router instance without causing polling re-runs

  // Polling effect — ONLY depends on pollingJobId, NOT on router
  useEffect(() => {
    if (!pollingJobId) return;

    // `stopped` flag prevents async callbacks from acting after cleanup
    let stopped = false;

    const checkJobStatus = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/jobs/${pollingJobId}`);
        if (!res.ok) {
          throw new Error('Failed to check job status');
        }

        const rawData = await res.json();
        const data = rawData as { status: string; errorSummary?: string };

        if (stopped) return;
        setJobStatus(data.status);

        if (data.status === 'COMPLETED') {
          stopped = true;
          setPollingJobId(null);
          setJobStatus(null);
          setIsEnriching(false);
          // Stable ref prevents this call from being a useEffect dependency
          refreshRef.current();
        } else if (data.status === 'FAILED') {
          stopped = true;
          setPollingJobId(null);
          setJobStatus(null);
          setIsEnriching(false);
          setJobError(data.errorSummary || 'Research enrichment job failed.');
        }
      } catch (err: unknown) {
        if (stopped) return;
        console.error('Polling error:', err);
        stopped = true;
        setPollingJobId(null);
        setJobStatus(null);
        setIsEnriching(false);
        setJobError('Failed to verify job status. Please refresh.');
      }
    };

    // Run first check immediately, then every 5 seconds
    checkJobStatus();
    const intervalId = setInterval(checkJobStatus, 5000);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [pollingJobId]); // ← deliberately omits router

  const handleEnrich = useCallback(async () => {
    // UI-level guard: prevents duplicate requests before the first pollingJobId is set.
    // The API route also has a server-side idempotency guard as a second line of defense.
    if (isEnriching) return;

    setEnrichError(null);
    setJobError(null);
    setIsEnriching(true);
    setJobStatus('QUEUED');

    try {
      const res = await fetch(`/api/leads/${leadId}/research`, {
        method: 'POST',
      });

      if (!res.ok) {
        const text = await res.text();
        let errorMsg = `Failed to trigger research: status ${res.status}`;
        try {
          const errData = JSON.parse(text);
          if (errData.error) errorMsg = errData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const rawData = await res.json();
      const { jobId } = rawData as { jobId: string };
      setPollingJobId(jobId);
    } catch (err: unknown) {
      console.error('Failed to launch research job:', err);
      const msg = err instanceof Error ? err.message : 'Failed to start research enrichment.';
      setEnrichError(msg);
      setJobStatus(null);
      setIsEnriching(false);
    }
  }, [leadId, isEnriching]);

  // 1. Loading/Triggering State
  if (pollingJobId || jobStatus === 'QUEUED' || jobStatus === 'RUNNING') {
    return <ResearchLoadingState jobStatus={jobStatus} />;
  }

  // 2. Empty State
  if (!initialSnapshot && !isEditing) {
    return (
      <ResearchEmptyState
        enrichError={enrichError}
        jobError={jobError}
        onEnrich={handleEnrich}
        onEdit={() => setIsEditing(true)}
        isEnriching={isEnriching}
      />
    );
  }

  // 3. Edit State (Form)
  if (isEditing) {
    const handleFormSubmit = () => {
      setTimeout(() => setIsEditing(false), 200);
    };

    return (
      <ResearchEditForm
        leadId={leadId}
        initialSnapshot={initialSnapshot}
        formAction={formAction}
        onCancel={() => setIsEditing(false)}
        onSave={handleFormSubmit}
      />
    );
  }

  // 4. View Mode
  if (!initialSnapshot) return null;

  return (
    <ResearchDisplay
      initialSnapshot={initialSnapshot}
      jobError={jobError}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onEnrich={handleEnrich}
      onEdit={() => setIsEditing(true)}
      isEnriching={isEnriching}
    />
  );
}
