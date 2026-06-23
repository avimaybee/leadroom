'use client';

import { useCallback, useEffect, useState, useTransition, useActionState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Building2,
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
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
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
import ClientLeadProfile from './ClientLeadProfile';
import ClientResearchView from './ClientResearchView';
import ClientAuditView from './ClientAuditView';
import ClientActivityList from './ClientActivityList';
import ClientNotesForm from './ClientNotesForm';
import ClientTaskForm from './ClientTaskForm';
import ClientTaskItem from './ClientTaskItem';
import ClientContactsList from './ClientContactsList';
import OutreachAssistant from './OutreachAssistant';
import { updateStageAction, addNoteAction, updateLeadAction, archiveLeadAction } from '@/app/actions/leads';
import { createTaskAction, toggleTaskStatusAction } from '@/app/actions/tasks';
import { saveResearchSnapshotAction, addContactAction, updateContactAction, deleteContactAction } from '@/app/actions/research';
import { manualOverrideScoreAction } from '@/app/actions/audits';

type WorkspaceView = 'overview' | 'research' | 'audit' | 'outreach' | 'activity';

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
  initialView: WorkspaceView;
  initialChannel?: string;
}

const WORKSPACE_NAV: Array<{ value: WorkspaceView; label: string; icon: typeof Building2 }> = [
  { value: 'overview', label: 'Overview', icon: Building2 },
  { value: 'research', label: 'Research', icon: FileSearch },
  { value: 'audit', label: 'Audit', icon: Radar },
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
  initialView,
  initialChannel,
}: LeadDetailsWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<WorkspaceView>(initialView);
  const [pollingJobId, setPollingJobId] = useState<string | null>(activeResearchJob?.id ?? null);
  const [jobStatus, setJobStatus] = useState<string | null>(activeResearchJob ? activeResearchJob.status : null);
  const [isEnriching, setIsEnriching] = useState(Boolean(activeResearchJob));
  const [jobError, setJobError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUpdatingStage, startTransition] = useTransition();

  const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [editState, editFormAction] = useActionState(updateLeadAction, undefined);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    if (editState && !editState.error && editState.success) {
      setIsEditLeadOpen(false);
      toast.success('Lead updated');
      router.refresh();
    }
  }, [editState, router]);

  useEffect(() => {
    if (!activeResearchJob) return;
    let cancelled = false;
    fetch(`/api/jobs/${activeResearchJob.id}`)
      .then((response) => response.ok ? response.json() as Promise<{ status: string }> : null)
      .then((data) => {
        if (cancelled || !data?.status) return;
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(data.status)) {
          setPollingJobId(null);
          setJobStatus(null);
          setIsEnriching(false);
          router.refresh();
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeResearchJob, router]);

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

  const handleStageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newStage = event.target.value;
    startTransition(async () => {
      const formData = new FormData();
      formData.append('leadId', lead.id);
      formData.append('stage', newStage);
      await updateStageAction(formData);
      toast.success(`Stage updated to ${newStage}`);
    });
  };

  const handleArchiveLead = async () => {
    if (confirm('Are you sure you want to archive this lead? This will hide it from the active lead feed.')) {
      try {
        await archiveLeadAction(lead.id);
        toast.success('Lead archived');
        router.push('/leads');
      } catch (error) {
        toast.error('Failed to archive lead');
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
          <Link href="/leads" className="hover:text-foreground transition-colors">Leads</Link>
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
            <label htmlFor="lead-stage" className="text-label-14 font-medium text-muted-foreground">Change stage:</label>
            <div className="relative">
              <select
                id="lead-stage"
                value={displayStage}
                onChange={handleStageChange}
                disabled={isUpdatingStage}
                className="min-h-10 rounded-md border border-border bg-card py-1.5 pl-3 pr-9 text-label-14 font-semibold text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/30 transition-colors"
              >
                {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
              {isUpdatingStage ? <Loader2 className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </div>
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

      <nav aria-label="Lead workspace" className="-mx-2 overflow-x-auto px-2">
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
              <section className="rounded-xl border border-foreground/10 bg-foreground px-5 py-5 text-background sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-label-12 uppercase text-background/60">Next action</p>
                  {nextTaskDueState && (
                    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-label-12 font-semibold ${nextTaskDueState.isOverdue ? 'bg-destructive/20 text-red-300' : 'bg-background/25 text-background/80'}`}>
                      {nextTaskDueState.text}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-heading-xl">
                  {nextTask?.title || (latestSnapshot ? 'Review evidence and prepare outreach' : 'Start lead research')}
                </h2>
                <p className="mt-2 text-copy-14 leading-6 text-background/65">
                  {nextTask?.description || (latestSnapshot ? 'The lead has research context ready for a human decision.' : 'Build a traceable research snapshot before drafting outreach.')}
                </p>
                <Button 
                  className="mt-5 bg-background text-foreground hover:bg-background/90" 
                  onClick={() => {
                    if (nextTask) {
                      // Stay on overview and focus tasks
                    } else if (latestSnapshot) {
                      navigateTo('outreach');
                    } else {
                      navigateTo('research');
                    }
                  }}
                >
                  {nextTask ? 'Execute Task' : latestSnapshot ? 'Open outreach' : 'Open research'}
                </Button>
              </section>

              {/* 2. Lead Summary */}
              <Section title="Lead Summary" description="High-value business fields in a flat description layout." icon={Building2}>
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
                description="The latest meaningful changes to this lead."
                icon={ClipboardList}
                action={<Button variant="ghost" size="sm" onClick={() => navigateTo('activity')}>View activity</Button>}
              >
                <ClientActivityList activities={activities.slice(0, 3)} />
              </Section>
            </div>

            {/* Supporting Column (4 spans) */}
            <div className="space-y-6 xl:col-span-4">
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
                        Go to Research
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => navigateTo('audit')}>
                        Go to Audit
                      </Button>
                    </div>
                  </div>
                )}
              </Section>

              {/* 3. Lead Controls */}
              <Section title="Lead Controls" description="Infrequent record operations." icon={Sliders}>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" className="w-full justify-start text-label-12 font-semibold" onClick={() => setIsEditLeadOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit lead details
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-label-12 font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void handleArchiveLead()}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive lead
                  </Button>
                </div>
              </Section>
            </div>
          </div>
        ) : null}

        {activeView === 'research' ? (
          <ClientResearchView leadId={lead.id} initialSnapshot={latestSnapshot} saveResearchSnapshotAction={saveResearchSnapshotAction} pollingJobId={pollingJobId} setPollingJobId={setPollingJobId} jobStatus={jobStatus} setJobStatus={setJobStatus} isEnriching={isEnriching} setIsEnriching={setIsEnriching} jobError={jobError} setJobError={setJobError} handleCancelResearch={handleCancelResearch} />
        ) : null}

        {activeView === 'audit' ? (
          <ClientAuditView leadId={lead.id} initialAudit={latestAudit} initialScore={currentScore} manualOverrideScoreAction={manualOverrideScoreAction} />
        ) : null}

        {activeView === 'outreach' ? (
          <OutreachAssistant
            leadId={lead.id}
            initialDrafts={outreachDrafts.map((draft: any) => ({ ...draft, createdAt: draft.createdAt ? new Date(draft.createdAt) : null, updatedAt: draft.updatedAt ? new Date(draft.updatedAt) : null }))}
            researchSnapshot={latestSnapshot}
            auditSnapshot={latestAudit}
            contacts={contactsList}
            initialChannel={initialChannel}
          />
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
              <DialogTitle className="text-heading-xl text-foreground">Edit Lead Details</DialogTitle>
              <DialogDescription className="text-copy-14 text-muted-foreground">
                Update the core profile information for this lead record.
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
                <Label htmlFor="edit-lead-name" className="text-label-12 text-muted-foreground uppercase">Lead Name *</Label>
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
              <Button type="submit">Save Lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-right" />
    </div>
  );
}
