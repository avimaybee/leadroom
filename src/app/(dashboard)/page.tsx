export const dynamic = 'force-dynamic';
import { LeadService } from '@/services/lead';
import { DiscoveryService } from '@/services/discovery';
import { getDb } from '@/db';
import Link from 'next/link';
import { Users, Search, AlertTriangle } from 'lucide-react';
import UnifiedFeedLoader from '@/app/(dashboard)/UnifiedFeedLoader';

export default async function DashboardPage() {
  const db = getDb();
  
  const leadService = new LeadService(db);
  const discoveryService = new DiscoveryService(db);

  const [leads, scopes, dashboardTasks] = await Promise.all([
    leadService.listLeads(),
    discoveryService.listScopes(),
    leadService.getDashboardTasks(),
  ]);

  const totalLeads = leads.length;
  const activeScopesCount = scopes.length;
  const pendingCandidatesCount = await discoveryService.countPendingCandidates();

  const STAGE_MAP: Record<string, string> = {
    'NEW': 'New',
    'Researching': 'In Research',
    'Qualified': 'Audited',
    'Outreach in Progress': 'Outreach Sent',
    'Meeting / Call': 'Meeting',
  };

  const stageCounts = leads.reduce((acc: Record<string, number>, lead: { stage: string }) => {
    const raw = lead.stage || 'New';
    const stage = STAGE_MAP[raw] || raw;
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stages = ['New', 'In Research', 'Auditing', 'Audited', 'Drafting', 'Ready to Send', 'Outreach Sent', 'Meeting', 'Won', 'Lost'];

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Leadroom</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pipeline overview &bull; {totalLeads} active leads &bull; {pendingCandidatesCount} pending candidates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/leads/new" 
            className="px-4 py-2.5 bg-primary hover:bg-primary/80 text-primary-foreground hover:scale-[1.01] rounded-xl font-bold text-xs shadow-md shadow-primary/10 transition duration-150"
          >
            + New Active Lead
          </Link>
          <Link 
            href="/scopes/new" 
            className="px-4 py-2.5 bg-card text-foreground hover:bg-muted border border-border hover:scale-[1.01] rounded-xl font-bold text-xs transition duration-150"
          >
            Configure Scope
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-2xl border border-border/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Pipeline Leads</span>
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-3xl font-extrabold text-foreground mt-2">{totalLeads}</h3>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Leads currently in your pipeline</p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/80">
            <Link href="/leads" className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 py-2.5 pr-4 -my-2.5 -ml-1">
              Manage Leads <span className="font-bold">&rarr;</span>
            </Link>
          </div>
        </div>

        <div className="bg-card p-6 rounded-2xl border border-border/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Discovery Scopes</span>
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <Search className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-3xl font-extrabold text-foreground mt-2">{activeScopesCount}</h3>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Active target discovery filters</p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/80">
            <Link href="/scopes" className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 py-2.5 pr-4 -my-2.5 -ml-1">
              Configure Scopes <span className="font-bold">&rarr;</span>
            </Link>
          </div>
        </div>

        <div className="bg-card p-6 rounded-2xl border border-border/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Candidates</span>
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-3xl font-extrabold text-foreground mt-2">{pendingCandidatesCount}</h3>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Imported targets awaiting review</p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/80">
            <Link href="/scopes" className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 py-2.5 pr-4 -my-2.5 -ml-1">
              Review Candidates <span className="font-bold">&rarr;</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card p-6 rounded-2xl border border-border/80 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-6">Pipeline Distribution</h3>
            <div className="space-y-5">
              {stages.map((stage) => {
                const count = stageCounts[stage] || 0;
                const percent = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={stage} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-foreground/80">{stage}</span>
                      <span className="text-muted-foreground font-bold">{count} {count === 1 ? 'lead' : 'leads'}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div 
                        className="bg-primary h-2.5 rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <UnifiedFeedLoader />
        </div>

        <div className="bg-card p-6 rounded-2xl border border-border/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4">Quick Start Workflows</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Establish systematic habits: qualify new candidates, move leads through the outreach stages, and schedule reminders.
            </p>
            <div className="space-y-3">
              <Link 
                href="/scopes" 
                className="flex items-center justify-between p-3.5 bg-muted/50 hover:bg-primary/5 hover:border-primary/30 rounded-xl transition text-foreground font-semibold text-sm border border-border/60 group"
              >
                <span>Review Pending Candidates</span>
                <span className="text-primary font-bold flex items-center gap-1 text-xs uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">
                  Go <span className="text-sm font-bold">&rarr;</span>
                </span>
              </Link>
              <Link 
                href="/leads" 
                className="flex items-center justify-between p-3.5 bg-muted/50 hover:bg-primary/5 hover:border-primary/30 rounded-xl transition text-foreground font-semibold text-sm border border-border/60 group"
              >
                <span>Manage Active Leads</span>
                <span className="text-primary font-bold flex items-center gap-1 text-xs uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">
                  Go <span className="text-sm font-bold">&rarr;</span>
                </span>
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-border/80 text-xs text-muted-foreground font-medium">
            Leadroom v1.0.0
          </div>
        </div>
      </div>
    </div>
  );
}
