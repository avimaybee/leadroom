'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { ResearchSnapshot } from './components/research/types';
import { ResearchLoadingState } from './components/research/ResearchLoadingState';
import { ResearchEmptyState } from './components/research/ResearchEmptyState';
import { ResearchEditForm } from './components/research/ResearchEditForm';
import { ResearchDisplay } from './components/research/ResearchDisplay';
import { useNotifications } from '@/components/NotificationProvider';

interface ClientResearchViewProps {
  leadId: string;
  initialSnapshot: ResearchSnapshot | null;
  autoEnrich?: boolean;
  activeJobId?: string | null;
  saveResearchSnapshotAction: (
    prevState: { error?: string | null; success?: boolean } | null | undefined,
    formData: FormData
  ) => Promise<{ error?: string | null; success?: boolean } | null | undefined>;
}

export default function ClientResearchView({
  leadId,
  initialSnapshot,
  autoEnrich,
  activeJobId,
  saveResearchSnapshotAction,
}: ClientResearchViewProps) {
  const router = useRouter();
  const { recentJobUpdates } = useNotifications();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'opportunity'>('overview');
  const [state, formAction] = useActionState(saveResearchSnapshotAction, undefined);

  const [enrichError, setEnrichError] = useState<string | null>(null);
  // Guard to prevent duplicate trigger clicks before pollingJobId is set
  const [isEnriching, setIsEnriching] = useState(false);

  // Job state
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  // Resume polling on mount if an active research job exists
  useEffect(() => {
    if (activeJobId && !initialSnapshot) {
      setPollingJobId(activeJobId);
      setJobStatus(activeJobId ? 'QUEUED' : null);
      setIsEnriching(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pollingJobId) return;

    const status = recentJobUpdates[pollingJobId];
    if (status === 'SUCCESS') {
      setPollingJobId(null);
      setJobStatus(null);
      setIsEnriching(false);
      router.refresh();
    } else if (status === 'ERROR') {
      setPollingJobId(null);
      setJobStatus(null);
      setIsEnriching(false);
      setJobError('Research enrichment job failed. Please check notifications for details.');
    }
  }, [pollingJobId, recentJobUpdates, router]);

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

  const autoEnrichStarted = useRef(false);

  useEffect(() => {
    if (autoEnrich && !initialSnapshot && !autoEnrichStarted.current) {
      autoEnrichStarted.current = true;
      handleEnrich();
    }
  }, [autoEnrich, initialSnapshot, handleEnrich]);

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
