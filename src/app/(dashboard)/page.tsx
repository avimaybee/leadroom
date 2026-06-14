export const dynamic = 'force-dynamic';
import { LeadService } from '@/services/lead';
import { DiscoveryService } from '@/services/discovery';
import { getDb } from '@/db';
import Link from 'next/link';
import DashboardTaskList from '@/components/dashboard/DashboardTaskList';
import { toggleTaskStatusAction } from '@/app/actions/tasks';


export default async function DashboardPage() {
  const db = getDb();
  
  const leadService = new LeadService(db);
  const discoveryService = new DiscoveryService(db);

  const [leads, scopes, dashboardTasks] = await Promise.all([
    leadService.listLeads(),
    discoveryService.listScopes(),
    leadService.getDashboardTasks(),
  ]);

  // Calculate some stats
  const totalLeads = leads.length;
  const activeScopesCount = scopes.length;
  // Get all candidates count awaiting review
  const pendingCandidatesCount = await discoveryService.countPendingCandidates();

  // Group leads by stage for pipeline summary with defensive sanitization
  const stageCounts = leads.reduce((acc: Record<string, number>, lead: { stage: string }) => {
    let stage = lead.stage || 'New';
    if (stage === 'NEW') stage = 'New';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stages = ['New', 'Researching', 'Qualified', 'Outreach in Progress', 'Meeting / Call'];

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Dashboard Header - Replacing large hero banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Draftroom</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pipeline overview &bull; {totalLeads} active leads &bull; {pendingCandidatesCount} pending candidates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/leads/new" 
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-[1.01] rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 transition duration-150"
          >
            + New Active Lead
          </Link>
          <Link 
            href="/scopes/new" 
            className="px-4 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 hover:scale-[1.01] rounded-xl font-bold text-xs transition duration-150"
          >
            Configure Scope
          </Link>
        </div>
      </div>

      {/* Grid Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Pipeline Leads</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{totalLeads}</h3>
            <p className="text-xs text-slate-600 mt-2 font-medium">Leads currently in your pipeline</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link href="/leads" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 py-2.5 pr-4 -my-2.5 -ml-1">
              Manage Leads <span className="font-bold">&rarr;</span>
            </Link>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Discovery Scopes</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{activeScopesCount}</h3>
            <p className="text-xs text-slate-600 mt-2 font-medium">Active target discovery filters</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link href="/scopes" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 py-2.5 pr-4 -my-2.5 -ml-1">
              Configure Scopes <span className="font-bold">&rarr;</span>
            </Link>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Candidates</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{pendingCandidatesCount}</h3>
            <p className="text-xs text-slate-600 mt-2 font-medium">Imported targets awaiting review</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link href="/scopes" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 py-2.5 pr-4 -my-2.5 -ml-1">
              Review Candidates <span className="font-bold">&rarr;</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Pipeline & Recent Activity Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Area (2 columns wide) - Pipeline & Tasks */}
        <div className="lg:col-span-2 space-y-8">
          {/* Pipeline Distribution */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Pipeline Distribution</h3>
            <div className="space-y-5">
              {stages.map((stage) => {
                const count = stageCounts[stage] || 0;
                const percent = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={stage} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-700">{stage}</span>
                      <span className="text-slate-500 font-bold">{count} {count === 1 ? 'lead' : 'leads'}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div 
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Tasks */}
          {dashboardTasks.length > 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
              <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4">
                Pending Tasks Checklist
              </h3>
              <DashboardTaskList tasks={dashboardTasks} toggleTaskStatusAction={toggleTaskStatusAction} />
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl flex items-center justify-between text-xs text-slate-500 font-semibold shadow-sm animate-fade-in">
              <span>All caught up! No pending tasks checklist for today.</span>
              <Link href="/leads" className="text-indigo-600 hover:underline">
                Go to Active Leads to configure tasks &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Start Workflows</h3>
            <p className="text-sm text-slate-500 mb-6">
              Establish systematic habits: qualify new candidates, move leads through the outreach stages, and schedule reminders.
            </p>
            <div className="space-y-3">
              <Link 
                href="/scopes" 
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-indigo-50/10 hover:border-indigo-200 rounded-xl transition text-slate-800 font-semibold text-sm border border-slate-200/60 group"
              >
                <span>Review Pending Candidates</span>
                <span className="text-indigo-600 font-bold flex items-center gap-1 text-xs uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">
                  Go <span className="text-sm font-bold">&rarr;</span>
                </span>
              </Link>
              <Link 
                href="/leads" 
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-indigo-50/10 hover:border-indigo-200 rounded-xl transition text-slate-800 font-semibold text-sm border border-slate-200/60 group"
              >
                <span>Manage Active Leads</span>
                <span className="text-indigo-600 font-bold flex items-center gap-1 text-xs uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">
                  Go <span className="text-sm font-bold">&rarr;</span>
                </span>
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-400 font-medium">
            Draftroom v1.0.0
          </div>
        </div>
      </div>
    </div>
  );
}
