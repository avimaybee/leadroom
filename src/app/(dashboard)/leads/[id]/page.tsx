export const dynamic = 'force-dynamic';
import { LeadService } from '@/services/lead';
import { ResearchService } from '@/services/research';
import { AuditService } from '@/services/audits';
import { ScoringService } from '@/services/scoring';
import { getDb } from '@/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { 
  updateStageAction, 
  addNoteAction 
} from '@/app/actions/leads';
import { 
  createTaskAction, 
  toggleTaskStatusAction 
} from '@/app/actions/tasks';
import { 
  saveResearchSnapshotAction, 
  addContactAction 
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
      <div className="flex items-center gap-3">
        <Link 
          href="/leads" 
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-500 transition"
        >
          &larr; Leads
        </Link>
        <div>
          <div className="flex items-center gap-3 mt-0.5">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{lead.name}</h1>
            {currentScore && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                currentScore.scoreLabel === 'High' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                currentScore.scoreLabel === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-slate-50 text-slate-600 border border-slate-200'
              }`}>
                {currentScore.scoreLabel} Priority ({currentScore.scoreValue})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2/3 width) - Profile Details, Notes & Activity */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Lead Information Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
              Contact & Business Profile
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {lead.company && (
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase">Company</span>
                  <span className="text-sm text-slate-800 font-semibold mt-1 block">{lead.company}</span>
                </div>
              )}
              {lead.email && (
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase">Email Address</span>
                  <a href={`mailto:${lead.email}`} className="text-sm text-indigo-600 hover:underline font-semibold mt-1 block">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase">Phone Number</span>
                  <span className="text-sm text-slate-800 font-semibold mt-1 block">{lead.phone}</span>
                </div>
              )}
              {lead.website && (
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase">Website</span>
                  <a href={lead.website} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline font-semibold mt-1 block">
                    {lead.website}
                  </a>
                </div>
              )}
              {lead.city && (
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase">Location / City</span>
                  <span className="text-sm text-slate-800 font-semibold mt-1 block">{lead.city}</span>
                </div>
              )}
              {lead.industry && (
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase">Industry</span>
                  <span className="text-sm text-slate-800 font-semibold mt-1 block">{lead.industry}</span>
                </div>
              )}
            </div>
          </div>

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

          {/* Pipeline Stage Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Pipeline Stage Status
              </h3>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getStageBadgeClass(lead.stage)}`}>
                {lead.stage}
              </span>
            </div>
            
            <form action={updateStageAction} className="flex flex-col sm:flex-row gap-3 pt-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <select 
                name="stage" 
                defaultValue={lead.stage}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 bg-white"
              >
                {stages.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              <button 
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-3 rounded-xl transition"
              >
                Update Stage
              </button>
            </form>
          </div>

          {/* Notes Appending & Activity Feed */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900">Notes & Activity History</h3>
            
            {/* Notes Addition Form */}
            <ClientNotesForm leadId={lead.id} addNoteAction={addNoteAction} />

            {/* Activities Timeline */}
            <div className="space-y-4">
              {activities.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 font-medium">
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
                        <span className="text-xs text-slate-400 font-medium shrink-0">
                          {new Date(act.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
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
            <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-3">
              Task Checklist
            </h3>
            
            {/* Task Creation Form */}
            <ClientTaskForm leadId={lead.id} createTaskAction={createTaskAction} />

            {/* Tasks list */}
            <div className="space-y-3 pt-2">
              {tasks.length === 0 ? (
                <p className="text-center text-xs font-semibold text-slate-400 py-4">
                  No tasks configured.
                </p>
              ) : (
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
          />

        </div>

      </div>
    </div>
  );
}
