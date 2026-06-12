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
  // Get all candidates for all scopes to count pending ones
  let pendingCandidatesCount = 0;
  for (const scope of scopes) {
    const candidates = await discoveryService.listCandidatesByScope(scope.id);
    pendingCandidatesCount += candidates.filter((c: { status: string }) => c.status === 'NEW').length;
  }

  // Group leads by stage for pipeline summary
  const stageCounts = leads.reduce((acc: Record<string, number>, lead: { stage: string }) => {
    acc[lead.stage] = (acc[lead.stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stages = ['New', 'Researching', 'Qualified', 'Outreach in Progress', 'Meeting / Call'];

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Welcome & Heading Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 md:p-10 shadow-xl border border-slate-800">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Draftroom
          </h1>
          <p className="mt-3 text-lg text-slate-300">
            Welcome back. Here is the status of your agency's growth pipeline and active client discovery.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link 
              href="/leads/new" 
              className="px-5 py-2.5 bg-white text-slate-950 hover:bg-slate-100 rounded-xl font-semibold text-sm transition-all duration-200 shadow-md hover:scale-[1.02]"
            >
              + New Active Lead
            </Link>
            <Link 
              href="/scopes/new" 
              className="px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700/85 text-slate-100 rounded-xl font-semibold text-sm border border-slate-700/70 transition-all duration-200 hover:scale-[1.02]"
            >
              Configure Scope
            </Link>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-[radial-gradient(circle_at_bottom_right,var(--color-indigo-500),transparent_70%)] opacity-30 pointer-events-none" />
      </div>

      {/* Grid Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Pipeline Leads</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{totalLeads}</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-slate-500">
            <span className="text-emerald-600">Stable</span> &bull; Updated just now
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Discovery Scopes</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{activeScopesCount}</h3>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-slate-500">
            <span className="text-indigo-600">Target segments</span> &bull; Active filters
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Pending Candidates</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{pendingCandidatesCount}</h3>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-slate-500">
            <span className="text-amber-600">{pendingCandidatesCount} awaiting review</span> &bull; Requires approval
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
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4">
              Pending Tasks Checklist
            </h3>
            <DashboardTaskList tasks={dashboardTasks} toggleTaskStatusAction={toggleTaskStatusAction} />
          </div>
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
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-slate-800 font-semibold text-sm border border-slate-200/60"
              >
                <span>Review Pending Candidates</span>
                <span className="text-indigo-600 font-bold">&rarr;</span>
              </Link>
              <Link 
                href="/leads" 
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-slate-800 font-semibold text-sm border border-slate-200/60"
              >
                <span>Manage Active Leads</span>
                <span className="text-indigo-600 font-bold">&rarr;</span>
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
