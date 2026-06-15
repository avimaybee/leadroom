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
  triggerAuditAction, 
  manualOverrideScoreAction 
} from '@/app/actions/audits';
import ClientNotesForm from './ClientNotesForm';
import ClientTaskForm from './ClientTaskForm';
import ClientTaskItem from './ClientTaskItem';
import ClientResearchView from './ClientResearchView';
import ClientAuditView from './ClientAuditView';
import ClientContactsList from './ClientContactsList';
import ClientLeadProfile from './ClientLeadProfile';
import OutreachAssistant from './OutreachAssistant';
import SidePanel from './SidePanel';
import { ClientScoreDrivers } from './ClientScoreDrivers';
import { OutreachService } from '@/services/outreach';



export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const env = (process as any).env;
  const db = getDb();
  const service = new LeadService(db);
  const researchService = new ResearchService(db);

  const lead = await service.getLead(id);
  if (!lead) notFound();

  const auditService = new AuditService(db);
  const scoringService = new ScoringService(db);
  const outreachService = new OutreachService(db);

  const [notes, tasks, activities, latestSnapshot, contactsList, latestAudit, currentScore, outreachDrafts] = await Promise.all([
    service.getNotes(id),
    service.getTasks(id),
    service.getActivities(id),
    researchService.getLatestResearch(id),
    researchService.getContacts(id),
    auditService.getLatestAudit(id),
    scoringService.getCurrentScore(id),
    outreachService.getDraftsForLead(id),
  ]);

  const stages = ['New', 'Researching', 'Qualified', 'Outreach in Progress', 'Meeting / Call'];

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
              {lead.stage}
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
              defaultValue={lead.stage}
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

      <div className="flex gap-8 items-start">
        
        <div className="flex-1 min-w-0 space-y-8">
          
          <ClientLeadProfile lead={lead} updateLeadAction={updateLeadAction} />

          <ClientResearchView
            leadId={lead.id}
            initialSnapshot={latestSnapshot}
            saveResearchSnapshotAction={saveResearchSnapshotAction}
          />

          <ClientAuditView
            leadId={lead.id}
            initialAudit={latestAudit}
            initialScore={currentScore}
            triagePriority={lead.triagePriority || 'UNASSESSED'}
            triageReason={lead.triageReason || null}
            triggerAuditAction={triggerAuditAction}
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

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-foreground">Notes & Activity History</h3>
            
            <ClientNotesForm leadId={lead.id} addNoteAction={addNoteAction} />

            <div className="space-y-4">
              {activities.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground font-medium">
                  No activity log found.
                </div>
              ) : (
                activities.map((act: any) => {
                  const isNote = act.type === 'Note added';
                  
                  return isNote ? (
                    <div 
                      key={act.id} 
                      className="p-5 rounded-2xl border transition duration-150 bg-card border-border/80 ring-1 ring-border/50 shadow-sm"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase bg-chart-5/10 text-chart-5 border border-chart-5/20">
                            {act.type}
                          </span>
                          <p className="text-sm font-semibold text-foreground mt-2 leading-relaxed">
                            {act.summary}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground font-semibold shrink-0">
                          {formatDateTimeUTC(act.timestamp)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <details key={act.id} className="group p-5 rounded-2xl border transition duration-150 bg-card border-border/80 cursor-pointer">
                      <summary className="flex justify-between items-start gap-4 list-none marker:content-none">
                        <div className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase bg-muted text-muted-foreground border border-border">
                            {act.type}
                          </span>
                          <span className="text-xs text-muted-foreground font-semibold">
                            {formatDateTimeUTC(act.timestamp)}
                          </span>
                        </div>
                      </summary>
                      <p className="text-sm font-semibold text-foreground mt-3 leading-relaxed pl-7">
                        {act.summary}
                      </p>
                    </details>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <SidePanel>
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
        </SidePanel>

      </div>

      <ClientScoreDrivers
        factors={currentScore?.factors ?? null}
        scoreValue={currentScore?.scoreValue ?? null}
        scoreLabel={currentScore?.scoreLabel ?? null}
      />
    </div>
  );
}
