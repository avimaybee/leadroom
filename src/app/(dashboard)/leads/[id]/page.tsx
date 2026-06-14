export const dynamic = 'force-dynamic';
import { LeadService } from '@/services/lead';
import { ResearchService } from '@/services/research';
import { AuditService } from '@/services/audits';
import { ScoringService } from '@/services/scoring';
import { getDb } from '@/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDateTimeUTC } from '@/lib/date';
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

  const [notes, tasks, activities, latestSnapshot, contactsList, latestAudit, currentScore] = await Promise.all([
    service.getNotes(id),
    service.getTasks(id),
    service.getActivities(id),
    researchService.getLatestResearch(id),
    researchService.getContacts(id),
    auditService.getLatestAudit(id),
    scoringService.getCurrentScore(id),
  ]);

  const stages = ['New', 'Researching', 'Qualified', 'Outreach in Progress', 'Meeting / Call'];

  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case 'Qualified':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'Researching':
        return 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'Outreach in Progress':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
      case 'Meeting / Call':
        return 'bg-rose-50 text-rose-700 border border-rose-100';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Back and Breadcrumbs */}
      <div className="space-y-1.5 animate-fade-in">
        <Link 
          href="/leads" 
          className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition w-fit py-2.5 pr-4 -my-2.5 -ml-1"
        >
          &larr; Back to Leads
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{lead.name}</h1>
            {currentScore && (
              <span 
                aria-label={`${currentScore.scoreLabel} Priority, score ${currentScore.scoreValue} out of 100`}
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                  currentScore.scoreLabel === 'High' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                  currentScore.scoreLabel === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-slate-50 text-slate-600 border border-slate-200'
                }`}
              >
                <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                  currentScore.scoreLabel === 'High' ? 'bg-rose-600 animate-pulse' :
                  currentScore.scoreLabel === 'Medium' ? 'bg-amber-500' : 'bg-slate-400'
                }`} />
                {currentScore.scoreLabel} Priority ({currentScore.scoreValue})
              </span>
            )}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getStageBadgeClass(lead.stage)}`}>
              {lead.stage}
            </span>
          </div>

          {/* Compact Inline Pipeline Stage Form */}
          <form action={updateStageAction} className="flex items-center gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <select 
              name="stage" 
              aria-label="Change pipeline stage"
              defaultValue={lead.stage}
              className="block rounded-xl border border-slate-200 py-1.5 px-3 text-xs font-bold focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
            >
              {stages.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            <button 
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow shadow-indigo-600/10"
            >
              Update
            </button>
          </form>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2/3 width) - Profile Details, Notes & Activity */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Lead Information Card */}
          <ClientLeadProfile lead={lead} updateLeadAction={updateLeadAction} />

          {/* AI Research & Enrichment Section */}
          <ClientResearchView
            leadId={lead.id}
            initialSnapshot={latestSnapshot}
            saveResearchSnapshotAction={saveResearchSnapshotAction}
          />

          {/* AI Audit & Priority Scoring Section */}
          <ClientAuditView
            leadId={lead.id}
            initialAudit={latestAudit}
            initialScore={currentScore}
            triggerAuditAction={triggerAuditAction}
            manualOverrideScoreAction={manualOverrideScoreAction}
          />

          {/* Notes Appending & Activity Feed */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900">Notes & Activity History</h3>
            
            {/* Notes Addition Form */}
            <ClientNotesForm leadId={lead.id} addNoteAction={addNoteAction} />

            {/* Activities Timeline */}
            <div className="space-y-4">
              {activities.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 font-medium">
                  No activity log found.
                </div>
              ) : (
                activities.map((act: any) => {
                  // If activity is "Note added", try to find the note to show the full body
                  const isNote = act.type === 'Note added';
                  
                  return (
                    <div 
                      key={act.id} 
                      className={`p-5 rounded-2xl border transition duration-150 bg-white border-slate-200/80 ${
                        isNote ? 'ring-1 ring-slate-100/50 shadow-sm' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                            isNote 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/60' 
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {act.type}
                          </span>
                          <p className="text-sm font-semibold text-slate-800 mt-2 leading-relaxed">
                            {act.summary}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 font-semibold shrink-0">
                          {formatDateTimeUTC(act.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1/3 width) - Tasks Management */}
        <div className="space-y-8">
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-950">
                Task Checklist
              </h3>
            </div>
            
            {/* Task Creation Form */}
            <ClientTaskForm leadId={lead.id} createTaskAction={createTaskAction} tasksCount={tasks.length} />

            {/* Tasks list */}
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

          {/* Contacts & Stakeholders */}
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
