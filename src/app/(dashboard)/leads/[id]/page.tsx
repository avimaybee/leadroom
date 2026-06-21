export const dynamic = 'force-dynamic';
import { LeadService } from '@/services/lead';
import { ResearchService } from '@/services/research';
import { AuditService } from '@/services/audits';
import { ScoringService } from '@/services/scoring';
import { getDb } from '@/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDateTimeUTC } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { 
  updateStageAction, 
  addNoteAction,
  updateLeadAction
} from '@/app/actions/leads';
import { 
  createTaskAction, 
  toggleTaskStatusAction 
} from '@/app/actions/tasks';
import { 
  saveResearchSnapshotAction, 
  addContactAction,
  updateContactAction,
  deleteContactAction
} from '@/app/actions/research';
import { 
  manualOverrideScoreAction 
} from '@/app/actions/audits';
import { jobRuns } from '@/db/schema/research';
import { and, eq, or } from 'drizzle-orm';
import ClientActivityList from "./ClientActivityList";
import ClientNotesForm from './ClientNotesForm';
import ClientTaskForm from './ClientTaskForm';
import ClientTaskItem from './ClientTaskItem';
import ClientResearchView from './ClientResearchView';
import ClientAuditView from './ClientAuditView';
import ClientContactsList from './ClientContactsList';
import ClientLeadProfile from './ClientLeadProfile';
import OutreachAssistant from './OutreachAssistant';
import { ClientScoreDrivers } from './ClientScoreDrivers';
import { OutreachService } from '@/services/outreach';



export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ autoEnrich?: string }> }) {
  const { id } = await params;
  const { autoEnrich } = await searchParams;
  const env = (process as any).env;
  const db = getDb();
  const service = new LeadService(db);
  const researchService = new ResearchService(db);

  const lead = await service.getLead(id);
  if (!lead) notFound();

  const auditService = new AuditService(db);
  const scoringService = new ScoringService(db);
  const outreachService = new OutreachService(db);

  const [notes, tasks, activities, latestSnapshot, contactsList, latestAudit, currentScore, outreachDrafts, activeResearchJob] = await Promise.all([
    service.getNotes(id),
    service.getTasks(id),
    service.getActivities(id),
    researchService.getLatestResearch(id),
    researchService.getContacts(id),
    auditService.getLatestAudit(id),
    scoringService.getCurrentScore(id),
    outreachService.getDraftsForLead(id),
    db
      .select({ id: jobRuns.id, status: jobRuns.status })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.targetLeadId, id),
          eq(jobRuns.jobType, 'RESEARCH_GENERATION'),
          or(
            eq(jobRuns.status, 'QUEUED'),
            eq(jobRuns.status, 'RUNNING')
          )
        )
      )
      .limit(1)
      .then(rows => rows[0] || null),
  ]);

  const STAGE_MAP: Record<string, string> = {
    'Researching': 'In Research',
    'Qualified': 'Audited',
    'Outreach in Progress': 'Outreach Sent',
    'Meeting / Call': 'Meeting',
  };
  const displayStage = STAGE_MAP[lead.stage] || lead.stage || 'New';
  const stages = ['New', 'In Research', 'Auditing', 'Audited', 'Drafting', 'Ready to Send', 'Outreach Sent', 'Meeting', 'Won', 'Lost'];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-1.5 animate-fade-in">
        <Link 
          href="/leads" 
          className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 transition w-fit py-2.5 pr-4 -my-2.5 -ml-1"
        >
          &larr; Back to Leads
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
            )}            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-muted/50 text-muted-foreground border border-border">
              {displayStage}
            </span>
            {(lead as any).campaignName && (
              <Link 
                href={`/scopes/${(lead as any).campaignId}`}
                className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-muted/65 text-muted-foreground border border-border/50 uppercase tracking-wide hover:bg-muted hover:text-foreground transition-colors"
              >
                Campaign: {(lead as any).campaignName}
              </Link>
            )}
          </div>

          <form action={updateStageAction} className="flex items-center gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <select 
              name="stage" 
              aria-label="Change pipeline stage"
              defaultValue={displayStage}
              className="block rounded-xl border border-input py-1.5 px-3 text-xs font-bold focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground bg-transparent"
            >
              {stages.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            <Button type="submit" size="sm">Update</Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-8">
          
          <ClientLeadProfile lead={lead} updateLeadAction={updateLeadAction} />

          <ClientResearchView
            leadId={lead.id}
            initialSnapshot={latestSnapshot}
            saveResearchSnapshotAction={saveResearchSnapshotAction}
            autoEnrich={autoEnrich === 'true'}
            activeJobId={activeResearchJob?.id ?? null}
          />

          <ClientAuditView
            leadId={lead.id}
            initialAudit={latestAudit}
            initialScore={currentScore}
            manualOverrideScoreAction={manualOverrideScoreAction}
          />

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

          <ClientScoreDrivers
            factors={currentScore?.factors ?? null}
            scoreValue={currentScore?.scoreValue ?? null}
            scoreLabel={currentScore?.scoreLabel ?? null}
          />

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-foreground">Notes & Activity History</h3>
            
            <ClientNotesForm leadId={lead.id} addNoteAction={addNoteAction} />

            <ClientActivityList activities={activities} />
          </div>
        </div>

        <div className="space-y-8">
          
          <div className="bg-card p-6 rounded-2xl border border-border/80 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">
                Task Checklist
              </h3>
            </div>
            
            <ClientTaskForm leadId={lead.id} createTaskAction={createTaskAction} tasksCount={tasks.length} />

            <div className="space-y-3 pt-2">
              {tasks.length > 0 && (
                tasks.map((task: any) => (
                  <ClientTaskItem 
                    key={task.id} 
                    leadId={lead.id}
                    task={task} 
                    toggleTaskStatusAction={toggleTaskStatusAction} 
                  />
                ))
              )}
            </div>
          </div>

          <ClientContactsList
            leadId={lead.id}
            initialContacts={contactsList}
            addContactAction={addContactAction}
            updateContactAction={updateContactAction}
            deleteContactAction={deleteContactAction}
          />

        </div>

      </div>
    </div>
  );
}
