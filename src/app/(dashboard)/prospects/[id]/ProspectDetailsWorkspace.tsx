'use client';

import { useCallback, useEffect, useState, useActionState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  CheckSquare2,
  ClipboardList,
  ContactRound,
  FileSearch,
  Loader2,
  MessageSquareText,
  Radar,
  XCircle,
  Edit,
  Archive,
  Sliders,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNotifications } from '@/components/NotificationProvider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import ClientLeadProfile from '@/app/(dashboard)/leads/[id]/ClientLeadProfile';
import ClientResearchView from '@/app/(dashboard)/leads/[id]/ClientResearchView';
import ClientAuditView from '@/app/(dashboard)/leads/[id]/ClientAuditView';
import ClientActivityList from '@/app/(dashboard)/leads/[id]/ClientActivityList';
import ClientNotesForm from '@/app/(dashboard)/leads/[id]/ClientNotesForm';
import ClientTaskForm from '@/app/(dashboard)/leads/[id]/ClientTaskForm';
import ClientTaskItem from '@/app/(dashboard)/leads/[id]/ClientTaskItem';
import ClientContactsList from '@/app/(dashboard)/leads/[id]/ClientContactsList';
import OutreachAssistant from '@/app/(dashboard)/leads/[id]/OutreachAssistant';
import { updateStageAction, addNoteAction, updateLeadAction, archiveLeadAction } from '@/app/actions/prospects';
import { logNbaActionAction, dismissNbaActionAction } from '@/app/actions/tracking';
import { getCalendarStatusAction } from '@/app/actions/calendar';
import { ClientStageDropdown } from '@/components/ClientStageDropdown';
import { SetReminderDialog } from '@/components/SetReminderDialog';
import { StageAgingBar } from '@/components/lead/StageAgingBar';
import { NextBestActionsList } from '@/components/lead/NextBestActionsList';
import { createTaskAction, toggleTaskStatusAction } from '@/app/actions/tasks';
import { saveResearchSnapshotAction, addContactAction, updateContactAction, deleteContactAction } from '@/app/actions/research';
import { manualOverrideScoreAction, triggerAuditAction } from '@/app/actions/audits';
import { generateOutreachDraftAction } from '@/app/actions/outreach';

type WorkspaceView = 'overview' | 'research' | 'outreach' | 'activity';

interface ProspectDetailsWorkspaceProps {
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
  initialView: WorkspaceView;
  initialChannel?: string;
  stageThreshold?: number;
  nbaResults?: any[];
  autoFollowUpDue?: Date | null;
  unmetRequirements?: Record<string, string>;
  researchTasks: any[];
}

const WORKSPACE_NAV: Array<{ value: WorkspaceView; label: string; icon: typeof Building2 }> = [
  { value: 'overview', label: 'Overview', icon: Building2 },
  { value: 'research', label: 'Research & Audit', icon: FileSearch },
  { value: 'outreach', label: 'Outreach', icon: MessageSquareText },
  { value: 'activity', label: 'Activity', icon: Activity },
];

function Section({ title, description, icon: Icon, action, children }: {
  title: string;
  description?: string;
  icon: typeof Building2;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-heading-lg text-foreground">{title}</h2>
            {description ? <p className="mt-0.5 text-label-12 leading-5 text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export default function ProspectDetailsWorkspace({
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
  initialView,
  initialChannel,
  stageThreshold,
  nbaResults,
  autoFollowUpDue,
  unmetRequirements,
  researchTasks,
}: ProspectDetailsWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<WorkspaceView>(initialView);
  const [pollingJobId, setPollingJobId] = useState<string | null>(activeResearchJob?.id ?? null);
  const [jobStatus, setJobStatus] = useState<string | null>(activeResearchJob ? activeResearchJob.status : null);
  const [isEnriching, setIsEnriching] = useState(Boolean(activeResearchJob));
  const [jobError, setJobError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  const nbaTop = nbaResults && nbaResults.length > 0 ? nbaResults[0] : null;

  const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; isConfigured: boolean } | null>(null);

  useEffect(() => {
    getCalendarStatusAction().then(setCalendarStatus).catch(() => setCalendarStatus(null));
  }, []);

  const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [editState, editFormAction] = useActionState(updateLeadAction, undefined);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    if (editState && !editState.error && editState.success) {
      setIsEditLeadOpen(false);
      toast.success('Prospect updated');
      router.refresh();
    }
  }, [editState, router]);

  useEffect(() => {
    if (!pollingJobId) return;
    let cancelled = false;

    const checkJob = async () => {
      try {
        const res = await fetch(`/api/jobs/${pollingJobId}`);
        if (!res.ok) return;
        const data = await res.json() as { status: string; error?: string };
        if (cancelled) return;

        setJobStatus(data.status);
        if (data.error) setJobError(data.error);

        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(data.status)) {
          setPollingJobId(null);
          setJobStatus(null);
          setIsEnriching(false);
          router.refresh();
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    };

    // Run immediately
    checkJob();

    // Poll every 3 seconds
    const interval = setInterval(checkJob, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollingJobId, router]);

  const { recentJobUpdates } = useNotifications();

  useEffect(() => {
    if (!pollingJobId) return;
    const status = recentJobUpdates[pollingJobId];
    if (status === 'SUCCESS' || status === 'ERROR') {
      setPollingJobId(null);
      setJobStatus(null);
      setIsEnriching(false);
      router.refresh();
    }
  }, [pollingJobId, recentJobUpdates, router]);

  const navigateTo = useCallback((view: WorkspaceView) => {
    setActiveView(view);
    const next = new URLSearchParams(searchParams.toString());
    next.set('view', view);
    if (view !== 'outreach') next.delete('channel');
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const handleCancelResearch = useCallback(async () => {
    if (!pollingJobId) return;
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}/research/cancel`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to cancel research');
      setPollingJobId(null);
      setJobStatus(null);
      setIsEnriching(false);
      setJobError(null);
      toast.success('Research enrichment cancelled');
    } catch {
      toast.error('Research could not be cancelled');
    } finally {
      setIsCancelling(false);
      router.refresh();
    }
  }, [lead.id, pollingJobId, router]);

  const handleArchiveLead = async () => {
    if (confirm('Are you sure you want to archive this prospect? This will hide them from the active list.')) {
      try {
        await archiveLeadAction(lead.id);
        toast.success('Prospect archived');
        router.push('/prospects');
      } catch (error) {
        toast.error('Failed to archive prospect');
      }
    }
  };

  const openTasks = [...tasks]
    .filter((task) => task.status !== 'Completed' && task.status !== 'COMPLETED')
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const nextTask = openTasks[0];
  const displayedTasks = showAllTasks ? openTasks : openTasks.slice(0, 5);

  const sortedContacts = [...contactsList].sort((a, b) => {
    const aPri = a.isPrimary === 1 || a.isPrimary === true ? 1 : 0;
    const bPri = b.isPrimary === 1 || b.isPrimary === true ? 1 : 0;
    return bPri - aPri;
  });

  const primaryContact = sortedContacts.find((c) => c.isPrimary || c.isPrimary === 1);
  
  const opportunityFindings = (() => {
    const findings: Array<{ title: string; detail: string; source: string }> = [];
    if (latestAudit) {
      if (latestAudit.keyWeaknesses) {
        const textClean = latestAudit.keyWeaknesses.replace(/^[#\-*\d.\s]+/, '').trim();
        if (textClean) {
          findings.push({
            title: 'Audit Weakness',
            detail: textClean,
            source: 'Audit'
          });
        }
      }
      if (latestAudit.recommendedImprovements) {
        const textClean = latestAudit.recommendedImprovements.replace(/^[#\-*\d.\s]+/, '').trim();
        if (textClean) {
          findings.push({
            title: 'Improvement Recommended',
            detail: textClean,
            source: 'Audit'
          });
        }
      }
    }
    if (latestSnapshot) {
      if (findings.length < 3 && latestSnapshot.opportunityHypotheses) {
        const textClean = latestSnapshot.opportunityHypotheses.replace(/^[#\-*\d.\s]+/, '').trim();
        if (textClean) {
          findings.push({
            title: 'Growth Opportunity',
            detail: textClean,
            source: 'Research'
          });
        }
      }
      if (findings.length < 3 && latestSnapshot.painPointsHypotheses) {
        const textClean = latestSnapshot.painPointsHypotheses.replace(/^[#\-*\d.\s]+/, '').trim();
        if (textClean) {
          findings.push({
            title: 'Client Pain Point',
            detail: textClean,
            source: 'Research'
          });
        }
      }
    }
    return findings.slice(0, 3);
  })();

  const nextTaskDueState = (() => {
    if (!nextTask || !nextTask.dueDate) return null;
    const due = new Date(nextTask.dueDate);
    const now = new Date();
    const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = dueMidnight.getTime() - nowMidnight.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: 'Due today', isOverdue: false };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', isOverdue: false };
    } else {
      return { text: `Due in ${diffDays} days`, isOverdue: false };
    }
  })();

  const metadataItems = [];
  if (lead.location || lead.city) {
    metadataItems.push(lead.location || lead.city);
  }
  if (lead.industry) {
    metadataItems.push(lead.industry);
  }
  if (lead.website) {
    const domain = lead.website.replace(/^https?:\/\/(www\.)?/, '');
    metadataItems.push(
      <a
        key="website"
        href={lead.website}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-border underline-offset-4 hover:text-foreground"
      >
        {domain}
      </a>
    );
  }
  if (primaryContact && primaryContact.fullName) {
    metadataItems.push(
      `Primary contact: ${primaryContact.fullName}${primaryContact.roleTitle ? ` (${primaryContact.roleTitle})` : ''}`
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-16">
      <header className="space-y-4 border-b border-border/70 pb-6">
        <nav className="flex items-center gap-2 text-label-14 text-muted-foreground">
          <Link href="/prospects" className="hover:text-foreground transition-colors">Prospects</Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="font-medium text-foreground">{lead.name}</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="break-words heading-3xl text-foreground sm:heading-2xl">{lead.name}</h1>
            <p className="mt-1 text-copy-14 text-muted-foreground">
              Verify research context, execute digital audits, draft outreach, and review interactions.
            </p>
            {metadataItems.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-copy-14 text-muted-foreground">
                {metadataItems.map((item, idx) => (
                  <span key={idx} className="flex items-center gap-2">
                    {idx > 0 && <span className="text-muted-foreground/30">·</span>}
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:mt-1">
            {calendarStatus && (
              <span className={`inline-flex items-center gap-1.5 text-label-12 font-medium ${calendarStatus.connected ? 'text-chart-3' : 'text-muted-foreground'}`}>
                <Calendar className="w-3.5 h-3.5" />
                {calendarStatus.connected ? 'Calendar synced' : 'Calendar off'}
              </span>
            )}
            <SetReminderDialog leadId={lead.id} leadName={lead.name} />
            <label htmlFor="lead-stage" className="text-label-14 font-medium text-muted-foreground">Change stage:</label>
            <ClientStageDropdown
              currentStage={displayStage}
              leadName={lead.name}
              leadId={lead.id}
              unmetRequirements={unmetRequirements}
              onStageChange={async (newStage) => {
                const formData = new FormData();
                formData.append('leadId', lead.id);
                formData.append('stage', newStage);
                await updateStageAction(formData);
                toast.success(`Stage updated to ${newStage}`);
              }}
            />
          </div>
        </div>

        {isEnriching ? (
          <div className="flex flex-col gap-3 rounded-md border border-primary/20 bg-primary/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div>
                <p className="text-label-14 font-medium text-foreground">Research is running</p>
                <p className="text-label-12 text-muted-foreground">You can continue working while evidence is collected.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleCancelResearch} disabled={isCancelling}>
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Cancel research
            </Button>
          </div>
        ) : null}
      </header>

      <nav aria-label="Prospect workspace" className="-mx-2 overflow-x-auto px-2">
        <div className="flex min-w-max gap-1 rounded-md border border-border bg-muted/25 p-1">
          {WORKSPACE_NAV.map((item) => {
            const Icon = item.icon;
            const selected = activeView === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => navigateTo(item.value)}
                aria-current={selected ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3.5 text-label-14 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main>
        {activeView === 'overview' ? (
          <div className="grid gap-6 lg:gap-8 xl:grid-cols-12">
            {/* Main Column (8 spans) */}
            <div className="space-y-6 xl:col-span-8">
              {/* 1. Next Action */}
              <section className="rounded-xl border border-foreground/10 bg-foreground px-5 py-5 text-background sm:px-6 relative">
                <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
                  <div className="flex items-center gap-2">
                    <p className="text-label-12 uppercase text-background">Next action</p>
                    {nextTaskDueState && (
                      <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-label-12 font-semibold ${nextTaskDueState.isOverdue ? 'bg-destructive/20 text-background' : 'bg-background/25 text-background'}`}>
                        {nextTaskDueState.text}
                      </span>
                    )}
                  </div>
                </div>
                {nbaTop && (
                  <button 
                    className="absolute top-5 right-5 text-background/50 hover:text-background transition-colors"
                    title="Dismiss this recommendation"
                    onClick={async () => {
                      const signal = nbaTop.action.toLowerCase().includes('overdue') ? 'overdue_task'
                        : nbaTop.action.toLowerCase().includes('task') ? 'future_task'
                        : nbaTop.action.toLowerCase().includes('stall') ? 'stale'
                        : nbaTop.action.toLowerCase().includes('draft') ? 'unsent_draft'
                        : nbaTop.action.toLowerCase().includes('research') ? 'no_research'
                        : nbaTop.action.toLowerCase().includes('audit') ? 'no_audit'
                        : 'unread';
                      await dismissNbaActionAction(lead.id, signal);
                      toast.success('Recommendation dismissed');
                      router.refresh();
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <h2 className="mt-3 text-heading-xl">
                  {nbaTop?.action || nextTask?.title || (latestSnapshot ? 'Review evidence and prepare outreach' : 'Start Research')}
                </h2>
                <p className="mt-2 text-copy-14 leading-6 text-background/80">
                  {nbaTop?.rationale || nextTask?.description || (latestSnapshot ? 'Research data is ready for your review.' : 'Gather website research and pain signals before drafting outreach.')}
                </p>
                {nbaTop && nbaTop.priority === 'High' && (
                  <span className="inline-flex items-center gap-1 mt-2 text-label-12 font-semibold text-background/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
                    Recommended Step — based on pipeline criteria
                  </span>
                )}
                <div className="flex items-center gap-2 mt-5">
                  <Button 
                    className="bg-background text-foreground hover:bg-background/90"
                    disabled={!!executingAction}
                    onClick={async () => {
                      if (nbaTop) {
                        logNbaActionAction(lead.id, nbaTop.action, nbaTop.priority).catch(() => {});
                        if (nbaTop.type === 'research') {
                          setExecutingAction('research');
                          try {
                            const res = await fetch(`/api/leads/${lead.id}/research`, { method: 'POST' });
                            const data = await res.json() as { jobId?: string };
                            if (data.jobId) setPollingJobId(data.jobId);
                            navigateTo('research');
                          } catch {
                            window.location.href = `/prospects/${lead.id}?tab=research`;
                          } finally {
                            setExecutingAction(null);
                          }
                        } else if (nbaTop.type === 'audit') {
                          setExecutingAction('audit');
                          try {
                            await triggerAuditAction(lead.id);
                            navigateTo('research');
                          } catch {
                            window.location.href = `/prospects/${lead.id}?tab=research`;
                          } finally {
                            setExecutingAction(null);
                          }
                        } else if (nbaTop.type === 'outreach') {
                          setExecutingAction('outreach');
                          try {
                            await generateOutreachDraftAction(lead.id, 'EMAIL');
                            navigateTo('outreach');
                          } catch {
                            window.location.href = `/prospects/${lead.id}?tab=outreach`;
                          } finally {
                            setExecutingAction(null);
                          }
                        } else if (nbaTop.type === 'review') {
                          if (nbaTop.link && nbaTop.link.includes('?view=')) {
                            const view = nbaTop.link.split('?view=')[1];
                            navigateTo(view as any);
                          } else {
                            navigateTo('outreach');
                          }
                        } else if (nbaTop.link) {
                          if (nbaTop.link.includes('?view=')) {
                            const view = nbaTop.link.split('?view=')[1];
                            navigateTo(view as any);
                          } else {
                            router.push(nbaTop.link);
                          }
                        }
                      } else if (nextTask) {
                        // Stay on overview
                      } else if (latestSnapshot) {
                        navigateTo('outreach');
                      } else {
                        navigateTo('research');
                      }
                    }}
                  >
                    {executingAction === 'research' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                    {executingAction === 'audit' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                    {executingAction === 'outreach' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                    {!executingAction && (nbaTop ? nbaTop.action : nextTask ? 'Execute Task' : latestSnapshot ? 'Open outreach' : 'Open research')}
                    {executingAction === 'research' && 'Starting research...'}
                    {executingAction === 'audit' && 'Starting audit...'}
                    {executingAction === 'outreach' && 'Generating draft...'}
                  </Button>
                  {nbaTop && nbaTop.link && !executingAction && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-transparent border-background/30 text-background hover:bg-background hover:text-foreground"
                      onClick={() => {
                        logNbaActionAction(lead.id, nbaTop.action, nbaTop.priority).catch(() => {});
                        if (nbaTop.type === 'review') {
                          if (nbaTop.link.includes('?view=')) {
                            const view = nbaTop.link.split('?view=')[1];
                            navigateTo(view as any);
                          } else {
                            navigateTo('outreach');
                          }
                        } else if (nbaTop.link.includes('?view=')) {
                          const view = nbaTop.link.split('?view=')[1];
                          navigateTo(view as any);
                        } else {
                          router.push(nbaTop.link);
                        }
                      }}
                    >
                      View details
                    </Button>
                  )}
                </div>
              </section>

              {/* 2. Prospect Summary */}
              <Section title="Prospect Details" description="Overview of company details and profile fields." icon={Building2}>
                <ClientLeadProfile lead={lead} />
              </Section>

              {/* 3. Open Tasks */}
              <Section title="Open Tasks" description={`${openTasks.length} item${openTasks.length === 1 ? '' : 's'} requiring attention.`} icon={CheckSquare2}>
                <div className="space-y-3">
                  <ClientTaskForm leadId={lead.id} createTaskAction={createTaskAction} tasksCount={tasks.length} />
                  {openTasks.length > 0 ? (
                    <div className="divide-y divide-border/60 border-t border-border/60">
                      {displayedTasks.map((task: any) => (
                        <ClientTaskItem 
                          key={task.id} 
                          leadId={lead.id} 
                          task={task} 
                          toggleTaskStatusAction={toggleTaskStatusAction} 
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="py-3 text-copy-14 text-muted-foreground">No open tasks. Add the next concrete follow-up.</p>
                  )}
                  {openTasks.length > 5 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full mt-2" 
                      onClick={() => setShowAllTasks(!showAllTasks)}
                    >
                      {showAllTasks ? 'Show less' : `View all open tasks (${openTasks.length})`}
                    </Button>
                  )}
                </div>
              </Section>

              {/* 4. Recent Interactions */}
              <Section
                title="Recent Activity"
                description="The latest activity for this prospect."
                icon={ClipboardList}
                action={<Button variant="ghost" size="sm" onClick={() => navigateTo('activity')}>View activity</Button>}
              >
                <ClientActivityList activities={activities.slice(0, 3)} />
              </Section>
            </div>

            {/* Supporting Column (4 spans) */}
            <div className="space-y-6 xl:col-span-4">
              {/* 0. Stage Aging */}
              {stageThreshold !== undefined && (
                <StageAgingBar
                  stage={displayStage}
                  stageUpdatedAt={lead.stageUpdatedAt}
                  daysThreshold={stageThreshold}
                  autoFollowUpDue={autoFollowUpDue}
                />
              )}

              {/* 0b. Next Best Actions */}
              {nbaResults && nbaResults.length > 0 && (
                <NextBestActionsList recommendations={nbaResults} leadId={lead.id} />
              )}

              {/* 1. Contacts */}
              <Section title="Contacts" description="People and channels available for outreach." icon={ContactRound}>
                <ClientContactsList 
                  leadId={lead.id} 
                  initialContacts={sortedContacts} 
                  addContactAction={addContactAction} 
                  updateContactAction={updateContactAction} 
                  deleteContactAction={deleteContactAction} 
                />
              </Section>

              {/* 2. Opportunity Snapshot */}
              <Section title="Opportunity Snapshot" description="Evidence-linked findings from research and audit." icon={Radar}>
                {opportunityFindings.length > 0 ? (
                  <div className="space-y-4">
                    {opportunityFindings.map((finding, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-label-12 font-semibold text-primary uppercase">
                            {finding.source}
                          </span>
                          <h4 className="text-label-12 font-semibold text-foreground">{finding.title}</h4>
                        </div>
                        <p className="text-copy-13 text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {finding.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-label-12 text-muted-foreground leading-relaxed">
                      No opportunity findings discovered yet. Run research or audit generation to build opportunity hypotheses.
                    </p>
                    <div className="flex justify-center gap-2 pt-2">
                      <Button variant="outline" size="xs" onClick={() => navigateTo('research')}>
                        Go to Research & Audit
                      </Button>
                    </div>
                  </div>
                )}
              </Section>

              {/* 3. Lead Controls */}
              <Section title="More Options" description="Edit or archive this prospect's record." icon={Sliders}>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" className="w-full justify-start text-label-12 font-semibold" onClick={() => setIsEditLeadOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit details
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-label-12 font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void handleArchiveLead()}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive prospect
                  </Button>
                </div>
              </Section>
            </div>
          </div>
        ) : null}

        {activeView === 'research' ? (
          <div className="space-y-6">
            <ClientResearchView leadId={lead.id} initialSnapshot={latestSnapshot} saveResearchSnapshotAction={saveResearchSnapshotAction} pollingJobId={pollingJobId} setPollingJobId={setPollingJobId} jobStatus={jobStatus} setJobStatus={setJobStatus} isEnriching={isEnriching} setIsEnriching={setIsEnriching} jobError={jobError} setJobError={setJobError} handleCancelResearch={handleCancelResearch} />
            <ClientAuditView 
              leadId={lead.id} 
              initialAudit={latestAudit} 
              initialScore={currentScore} 
              manualOverrideScoreAction={manualOverrideScoreAction}
              fitScore={lead.fitScore}
              confidenceScore={lead.confidenceScore}
              priorityTier={lead.priorityTier}
              fitReasoning={lead.fitReasoning}
              researchTasks={researchTasks}
              isResearchRunning={!!pollingJobId || jobStatus === 'QUEUED' || jobStatus === 'RUNNING'}
            />
          </div>
        ) : null}

        {activeView === 'outreach' ? (
          !latestSnapshot ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-2">
                <FileSearch className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-label-14 font-semibold text-foreground">
                {pollingJobId || jobStatus === 'QUEUED' || jobStatus === 'RUNNING'
                  ? 'Research in progress'
                  : 'No research yet'}
              </h3>
              <p className="text-copy-13 text-muted-foreground max-w-sm mx-auto">
                {pollingJobId || jobStatus === 'QUEUED' || jobStatus === 'RUNNING'
                  ? 'Drafts will be available once the AI research agent finishes collecting evidence.'
                  : 'Run research first to give the AI enough context to generate a meaningful outreach draft.'}
              </p>
              {!(pollingJobId || jobStatus === 'QUEUED' || jobStatus === 'RUNNING') && (
                <Button variant="outline" size="sm" onClick={() => navigateTo('research')} className="mt-2">
                  Go to Research &amp; Audit
                </Button>
              )}
            </div>
          ) : (
            <OutreachAssistant
              leadId={lead.id}
              initialDrafts={outreachDrafts.map((draft: any) => ({ ...draft, createdAt: draft.createdAt ? new Date(draft.createdAt) : null, updatedAt: draft.updatedAt ? new Date(draft.updatedAt) : null }))}
              researchSnapshot={latestSnapshot}
              auditSnapshot={latestAudit}
              contacts={contactsList}
              initialChannel={initialChannel}
            />
          )
        ) : null}

        {activeView === 'activity' ? (
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-6">
            <div className="pb-6 border-b border-border/50">
              <ClientNotesForm leadId={lead.id} addNoteAction={addNoteAction} embedded />
            </div>
            <ClientActivityList activities={activities} />
          </div>
        ) : null}
      </main>

      <Dialog open={isEditLeadOpen} onOpenChange={setIsEditLeadOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-xl bg-card border border-border">
          <form action={editFormAction} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-heading-xl text-foreground">Edit Details</DialogTitle>
              <DialogDescription className="text-copy-14 text-muted-foreground">
                Update details for this prospect.
              </DialogDescription>
            </DialogHeader>

            {editState?.error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-label-12 border border-destructive/20 font-semibold animate-fade-in">
                {editState.error}
              </div>
            )}

            <input type="hidden" name="leadId" value={lead.id} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-lead-name" className="text-label-12 text-muted-foreground uppercase">Contact Name *</Label>
                <Input required id="edit-lead-name" type="text" name="name" defaultValue={lead.name} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="edit-lead-company" className="text-label-12 text-muted-foreground uppercase">Company</Label>
                <Input id="edit-lead-company" type="text" name="company" defaultValue={lead.company || ''} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="edit-lead-email" className="text-label-12 text-muted-foreground uppercase">Email Address</Label>
                <Input id="edit-lead-email" type="email" name="email" defaultValue={lead.email || ''} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="edit-lead-phone" className="text-label-12 text-muted-foreground uppercase">Phone Number</Label>
                <Input id="edit-lead-phone" type="text" name="phone" defaultValue={lead.phone || ''} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="edit-lead-website" className="text-label-12 text-muted-foreground uppercase">Website URL</Label>
                <Input id="edit-lead-website" type="url" name="website" defaultValue={lead.website || ''} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="edit-lead-city" className="text-label-12 text-muted-foreground uppercase">Location / City</Label>
                <Input id="edit-lead-city" type="text" name="city" defaultValue={lead.city || ''} className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="edit-lead-industry" className="text-label-12 text-muted-foreground uppercase">Industry</Label>
                <Input id="edit-lead-industry" type="text" name="industry" defaultValue={lead.industry || ''} className="mt-1" />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditLeadOpen(false)}>
                Discard Changes
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
