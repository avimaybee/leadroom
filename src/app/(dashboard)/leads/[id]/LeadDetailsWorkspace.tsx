'use client';

import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/components/NotificationProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, Loader2, XCircle, Info, Sparkles, Check, CheckCircle2, ChevronRight } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import Link from 'next/link';

// Import child components
import ClientLeadProfile from './ClientLeadProfile';
import ClientResearchView from './ClientResearchView';
import ClientAuditView from './ClientAuditView';
import { ClientScoreDrivers } from './ClientScoreDrivers';
import ClientActivityList from './ClientActivityList';
import ClientNotesForm from './ClientNotesForm';
import ClientTaskForm from './ClientTaskForm';
import ClientTaskItem from './ClientTaskItem';
import ClientContactsList from './ClientContactsList';
import OutreachAssistant from './OutreachAssistant';

// Import Server Actions
import { updateStageAction, addNoteAction, updateLeadAction } from '@/app/actions/leads';
import { createTaskAction, toggleTaskStatusAction } from '@/app/actions/tasks';
import { saveResearchSnapshotAction, addContactAction, updateContactAction, deleteContactAction } from '@/app/actions/research';
import { manualOverrideScoreAction } from '@/app/actions/audits';

interface LeadDetailsWorkspaceProps {
  lead: any;
  notes: any[];
  tasks: any[];
  activities: any[];
  latestSnapshot: any;
  contactsList: any[];
  latestAudit: any;
  currentScore: any;
  outreachDrafts: any[];
  activeResearchJob: { id: string; status: string } | null;
  displayStage: string;
  stages: string[];
}

export default function LeadDetailsWorkspace({
  lead,
  notes,
  tasks,
  activities,
  latestSnapshot,
  contactsList,
  latestAudit,
  currentScore,
  outreachDrafts,
  activeResearchJob,
  displayStage,
  stages,
}: LeadDetailsWorkspaceProps) {
  const router = useRouter();
  const { recentJobUpdates } = useNotifications();

  // Active workflow tabs state
  const [activeTab, setActiveTab] = useState<string>('outreach');

  // Job Polling state
  const [pollingJobId, setPollingJobId] = useState<string | null>(activeResearchJob?.id ?? null);
  const [jobStatus, setJobStatus] = useState<string | null>(activeResearchJob ? 'QUEUED' : null);
  const [isEnriching, setIsEnriching] = useState<boolean>(!!activeResearchJob);
  const [jobError, setJobError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Left rail context accordions expanded/collapsed states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    profile: true,
    score: false,
    contacts: false,
    tasks: false,
    activity: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Resume polling on mount if active job exists
  useEffect(() => {
    if (activeResearchJob && !latestSnapshot) {
      setPollingJobId(activeResearchJob.id);
      setJobStatus('QUEUED');
      setIsEnriching(true);
    }
  }, [activeResearchJob, latestSnapshot]);

  // Verify the job is still actually alive — the server data can be stale
  useEffect(() => {
    if (!activeResearchJob) return;
    let cancelled = false;
    fetch(`/api/jobs/${activeResearchJob.id}`)
      .then(res => res.ok ? res.json() as Promise<{ status: string }> : null)
      .then(data => {
        if (cancelled) return;
        if (!data || !data.status) {
          // Job doesn't exist anymore — clear stale state
          setPollingJobId(null);
          setJobStatus(null);
          setIsEnriching(false);
          return;
        }
        const finalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED'];
        if (finalStatuses.includes(data.status)) {
          setPollingJobId(null);
          setJobStatus(null);
          setIsEnriching(false);
          router.refresh();
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Network error — leave state as-is, notifications will catch it
      });
    return () => { cancelled = true; };
  }, [activeResearchJob, router]);

  // Handle updates from Server Sent Events
  useEffect(() => {
    if (!pollingJobId) return;

    const status = recentJobUpdates[pollingJobId];
    if (status === 'SUCCESS') {
      setPollingJobId(null);
      setJobStatus(null);
      setIsEnriching(false);
      toast.success('Research enrichment completed!');
      router.refresh();
    } else if (status === 'ERROR') {
      setPollingJobId(null);
      setJobStatus(null);
      setIsEnriching(false);
      setJobError('Research enrichment job failed. Please check notifications.');
      toast.error('Research enrichment failed.');
    }
  }, [pollingJobId, recentJobUpdates, router]);

  // Cancel research function
  const handleCancelResearch = useCallback(async () => {
    if (!pollingJobId) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/research/cancel`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to cancel research');
      }
      toast.success('Research enrichment cancelled');
      setPollingJobId(null);
      setJobStatus(null);
      setIsEnriching(false);
      setJobError(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel research enrichment');
    } finally {
      setIsCancelling(false);
      router.refresh();
    }
  }, [lead.id, pollingJobId, router]);

  const [isUpdatingStage, startTransition] = useTransition();

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStage = e.target.value;
    startTransition(async () => {
      const formData = new FormData();
      formData.append('leadId', lead.id);
      formData.append('stage', newStage);
      await updateStageAction(formData);
      toast.success('Stage updated to ' + newStage);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <Link 
            href="/leads" 
            className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 transition w-fit py-1"
          >
            &larr; Back to Leads
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{lead.name}</h1>
            {currentScore && (
              <span 
                aria-label={`${currentScore.scoreLabel} Priority, score ${currentScore.scoreValue} out of 100`}
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                  currentScore.scoreLabel === 'High' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                  currentScore.scoreLabel === 'Medium' ? 'bg-chart-5/10 text-chart-5 border border-chart-5/20' :
                  'bg-muted/50 text-muted-foreground border border-border'
                }`}
              >
                {currentScore.scoreLabel} Priority ({currentScore.scoreValue})
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-muted/50 text-muted-foreground border border-border">
              {displayStage}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select 
            name="stage" 
            aria-label="Change pipeline stage"
            defaultValue={displayStage}
            onChange={handleStageChange}
            disabled={isUpdatingStage}
            className="block rounded-xl border border-input py-1.5 px-3 text-xs font-bold focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground bg-transparent"
          >
            {stages.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          {isUpdatingStage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* 2-Column Split-Pane Layout */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        
        {/* Left Column: Left Context Rail (Sticky, width ~320px) */}
        <div className="w-full xl:w-[320px] shrink-0 space-y-4 xl:sticky xl:top-6 max-h-[calc(100vh-140px)] overflow-y-auto pr-1 -mr-1">
          
          {/* Active enrichment / Cancel Banner */}
          {isEnriching && (
            <div className="bg-primary/[0.03] border border-primary/20 p-4 rounded-2xl space-y-3 shadow-sm animate-pulse">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Research enrichment active</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold">
                Running research and digital audit. Cancel anytime.
              </p>
              <Button
                variant="outline"
                size="xs"
                onClick={handleCancelResearch}
                disabled={isCancelling}
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
              >
                {isCancelling ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Cancelling...</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1.5" /> Cancel Research</>
                )}
              </Button>
            </div>
          )}

          {/* Pinned Critical Weaknesses from Audit */}
          {latestAudit?.keyWeaknesses && (
            <div className="bg-destructive/[0.02] border border-destructive/25 p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                <h4 className="text-xs font-black uppercase text-destructive tracking-wider">Critical Audit Weaknesses</h4>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed max-h-[140px] overflow-y-auto pr-1">
                {latestAudit.keyWeaknesses}
              </p>
              <Button
                variant="link"
                size="xs"
                onClick={() => setActiveTab('audit')}
                className="text-[10px] p-0 h-auto font-bold text-destructive hover:text-destructive/80 flex items-center gap-0.5"
              >
                View Audit details <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Accordion: Contact & Business Profile */}
          <div className="bg-card rounded-2xl border border-border/80 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('profile')}
              className="w-full flex items-center justify-between p-4 font-bold text-xs uppercase tracking-wider text-muted-foreground bg-muted/20 hover:bg-muted/30 transition-colors border-b border-border/40"
            >
              <span>Business Profile</span>
              <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${expandedSections.profile ? 'rotate-90' : ''}`} />
            </button>
            {expandedSections.profile && (
              <div className="p-4 bg-card">
                <ClientLeadProfile lead={lead} updateLeadAction={updateLeadAction} />
              </div>
            )}
          </div>

          {/* Accordion: Lead Priority Score */}
          <div className="bg-card rounded-2xl border border-border/80 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('score')}
              className="w-full flex items-center justify-between p-4 font-bold text-xs uppercase tracking-wider text-muted-foreground bg-muted/20 hover:bg-muted/30 transition-colors border-b border-border/40"
            >
              <span>Priority Score Drivers</span>
              <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${expandedSections.score ? 'rotate-90' : ''}`} />
            </button>
            {expandedSections.score && (
              <div className="p-4 bg-card space-y-4">
                {currentScore ? (
                  <ClientScoreDrivers
                    factors={currentScore?.factors ?? null}
                    scoreValue={currentScore?.scoreValue ?? null}
                    scoreLabel={currentScore?.scoreLabel ?? null}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-2">No scoring data available yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Accordion: Contacts & Stakeholders */}
          <div className="bg-card rounded-2xl border border-border/80 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('contacts')}
              className="w-full flex items-center justify-between p-4 font-bold text-xs uppercase tracking-wider text-muted-foreground bg-muted/20 hover:bg-muted/30 transition-colors border-b border-border/40"
            >
              <span>Contacts &amp; Stakeholders</span>
              <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${expandedSections.contacts ? 'rotate-90' : ''}`} />
            </button>
            {expandedSections.contacts && (
              <div className="p-4 bg-card">
                <ClientContactsList
                  leadId={lead.id}
                  initialContacts={contactsList}
                  addContactAction={addContactAction}
                  updateContactAction={updateContactAction}
                  deleteContactAction={deleteContactAction}
                />
              </div>
            )}
          </div>

          {/* Accordion: Tasks Checklist */}
          <div className="bg-card rounded-2xl border border-border/80 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('tasks')}
              className="w-full flex items-center justify-between p-4 font-bold text-xs uppercase tracking-wider text-muted-foreground bg-muted/20 hover:bg-muted/30 transition-colors border-b border-border/40"
            >
              <span>Task Checklist</span>
              <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${expandedSections.tasks ? 'rotate-90' : ''}`} />
            </button>
            {expandedSections.tasks && (
              <div className="p-4 bg-card space-y-3">
                <ClientTaskForm leadId={lead.id} createTaskAction={createTaskAction} tasksCount={tasks.length} />
                {tasks.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-border/40">
                    {tasks.map((task: any) => (
                      <ClientTaskItem 
                        key={task.id} 
                        leadId={lead.id}
                        task={task} 
                        toggleTaskStatusAction={toggleTaskStatusAction} 
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Accordion: Notes & Activities */}
          <div className="bg-card rounded-2xl border border-border/80 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('activity')}
              className="w-full flex items-center justify-between p-4 font-bold text-xs uppercase tracking-wider text-muted-foreground bg-muted/20 hover:bg-muted/30 transition-colors border-b border-border/40"
            >
              <span>Notes &amp; Activities</span>
              <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${expandedSections.activity ? 'rotate-90' : ''}`} />
            </button>
            {expandedSections.activity && (
              <div className="p-4 bg-card space-y-4">
                <ClientNotesForm leadId={lead.id} addNoteAction={addNoteAction} />
                <div className="pt-3 border-t border-border/40">
                  <ClientActivityList activities={activities} />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Main Tabbed Workspace (Takes remaining width) */}
        <div className="flex-1 min-w-0 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-3 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="outreach" className="rounded-lg text-xs font-bold">
                Outreach Assistant
              </TabsTrigger>
              <TabsTrigger value="research" className="rounded-lg text-xs font-bold">
                Research Snapshot
              </TabsTrigger>
              <TabsTrigger value="audit" className="rounded-lg text-xs font-bold">
                Audit & Scoring
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Outreach Assistant */}
            <TabsContent value="outreach" className="focus-visible:outline-none">
              <OutreachAssistant
                leadId={lead.id}
                initialDrafts={outreachDrafts.map((d: any) => ({
                  ...d,
                  createdAt: d.createdAt ? new Date(d.createdAt) : null,
                  updatedAt: d.updatedAt ? new Date(d.updatedAt) : null,
                }))}
                researchSnapshot={latestSnapshot}
                auditSnapshot={latestAudit}
              />
            </TabsContent>

            {/* Tab 2: Research Snapshot */}
            <TabsContent value="research" className="focus-visible:outline-none">
              <ClientResearchView
                leadId={lead.id}
                initialSnapshot={latestSnapshot}
                saveResearchSnapshotAction={saveResearchSnapshotAction}
                pollingJobId={pollingJobId}
                setPollingJobId={setPollingJobId}
                jobStatus={jobStatus}
                setJobStatus={setJobStatus}
                isEnriching={isEnriching}
                setIsEnriching={setIsEnriching}
                jobError={jobError}
                setJobError={setJobError}
                handleCancelResearch={handleCancelResearch}
              />
            </TabsContent>

            {/* Tab 3: Detailed Audit & Scoring */}
            <TabsContent value="audit" className="focus-visible:outline-none space-y-6">
              <ClientAuditView
                leadId={lead.id}
                initialAudit={latestAudit}
                initialScore={currentScore}
                manualOverrideScoreAction={manualOverrideScoreAction}
              />

              <ClientScoreDrivers
                factors={currentScore?.factors ?? null}
                scoreValue={currentScore?.scoreValue ?? null}
                scoreLabel={currentScore?.scoreLabel ?? null}
              />
            </TabsContent>
          </Tabs>
        </div>

      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}
