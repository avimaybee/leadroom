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

          <ClientScoreDrivers
            factors={currentScore?.factors ?? null}
            scoreValue={currentScore?.scoreValue ?? null}
            scoreLabel={currentScore?.scoreLabel ?? null}
          />

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-foreground">Notes & Activity History</h3>
            
            <ClientNotesForm leadId={lead.id} addNoteAction={addNoteAction} />

            {activities.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground font-medium">
                No activity log found.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto border border-border/60 rounded-xl bg-card">
                <div className="divide-y divide-border/40">
                  {activities.map((act: any) => {
                    const isNote = act.type === 'Note added';
                    return (
                      <div key={act.id} className={`${isNote ? 'bg-chart-5/[0.02]' : ''}`}>
                        {isNote ? (
                          <div className="px-4 py-3">
                            <div className="flex justify-between items-start gap-3">
                              <div className="min-w-0">
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-chart-5/10 text-chart-5">
                                  {act.type}
                                </span>
                                <p className="text-sm font-semibold text-foreground mt-1.5 leading-relaxed">
                                  {act.summary}
                                </p>
                              </div>
                              <span className="text-[11px] text-muted-foreground font-semibold shrink-0 mt-0.5">
                                {formatDateTimeUTC(act.timestamp)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <details className="group">
                            <summary className="flex justify-between items-center gap-3 px-4 py-2.5 list-none marker:content-none cursor-pointer hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <svg className="w-3 h-3 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground leading-tight shrink-0">
                                  {act.type}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium truncate">
                                  {act.summary}
                                </span>
                              </div>
                              <span className="text-[11px] text-muted-foreground font-semibold shrink-0">
                                {formatDateTimeUTC(act.timestamp)}
                              </span>
                            </summary>
                            <div className="px-4 pb-3 pl-[37px]">
                              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                                {act.summary}
                              </p>
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
