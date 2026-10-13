'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  autoEnrich?: boolean;
  saveResearchSnapshotAction: (
    prevState: { error?: string | null; success?: boolean } | null | undefined,
    formData: FormData
  ) => Promise<{ error?: string | null; success?: boolean } | null | undefined>;
  pollingJobId: string | null;
  setPollingJobId: (id: string | null) => void;
  jobStatus: string | null;
  setJobStatus: (status: string | null) => void;
  isEnriching: boolean;
  setIsEnriching: (enriching: boolean) => void;
  jobError: string | null;
  setJobError: (err: string | null) => void;
  handleCancelResearch: () => void;
}

export default function ClientResearchView({
  leadId,
  initialSnapshot,
  autoEnrich,
  saveResearchSnapshotAction,
  pollingJobId,
  setPollingJobId,
  jobStatus,
  setJobStatus,
  isEnriching,
  setIsEnriching,
  jobError,
  setJobError,
  handleCancelResearch,
}: ClientResearchViewProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'opportunity'>('overview');
  const [state, formAction] = useActionState(saveResearchSnapshotAction, undefined);

  const [enrichError, setEnrichError] = useState<string | null>(null);

  const handleEnrich = useCallback(async () => {
    // UI-level guard: prevents duplicate requests before the first pollingJobId is set.
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
  }, [leadId, isEnriching, setIsEnriching, setJobStatus, setPollingJobId, setJobError]);

  const autoEnrichStarted = useRef(false);

  useEffect(() => {
    if (autoEnrich && !initialSnapshot && !autoEnrichStarted.current) {
      autoEnrichStarted.current = true;
      handleEnrich();
    }
  }, [autoEnrich, initialSnapshot, handleEnrich]);

  // 1. Loading/Triggering State
  if (pollingJobId || jobStatus === 'QUEUED' || jobStatus === 'RUNNING') {
    return <ResearchLoadingState jobStatus={jobStatus} leadId={leadId} onCancel={handleCancelResearch} />;
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
