export const dynamic = 'force-dynamic';
import { getDb } from '@/db';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { archiveLeadAction } from '@/app/actions/leads';
import { Button, buttonVariants } from '@/components/ui/button';
import { leads, leadScores, candidateLeads, discoveryScopes } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export default async function LeadsPage() {
  const db = getDb();
  
  const activeLeads = await db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      email: leads.email,
      stage: leads.stage,
      status: leads.status,
      scoreValue: leadScores.scoreValue,
      scoreLabel: leadScores.scoreLabel,
      campaignId: discoveryScopes.id,
      campaignName: discoveryScopes.name,
    })
    .from(leads)
    .leftJoin(leadScores, and(eq(leads.id, leadScores.leadId), eq(leadScores.isCurrent, 1)))
    .leftJoin(candidateLeads, eq(leads.id, candidateLeads.promotedLeadId))
    .leftJoin(discoveryScopes, eq(candidateLeads.discoveryScopeId, discoveryScopes.id))
    .where(eq(leads.status, 'Active'))
    .orderBy(desc(leadScores.scoreValue));

  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case 'Qualified':
        return 'bg-chart-2/10 text-chart-2 border border-chart-2/20';
      case 'Researching':
        return 'bg-chart-5/10 text-chart-5 border border-chart-5/20';
      case 'Outreach in Progress':
        return 'bg-primary/10 text-primary border border-primary/20';
      case 'Meeting / Call':
        return 'bg-destructive/10 text-destructive border border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-card-foreground tracking-tight">Active Leads</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage your active sales and consulting pipeline leads.
          </p>
        </div>
        <Link href="/leads/new" className={buttonVariants({ variant: "default" })}>
          + New Lead
        </Link>
      </div>

      {activeLeads.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center max-w-xl mx-auto mt-8 space-y-6 shadow-sm animate-fade-in">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-card-foreground">No active leads found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Start building your consulting and branding outreach pipeline by adding leads manually or running discovery scans on local markets.
            </p>
          </div>
          <div className="flex justify-center items-center gap-3 pt-2">
            <Link href="/leads/new" className={buttonVariants({ variant: "default" })}>
              + Add New Lead
            </Link>
            <Link href="/scopes" className={buttonVariants({ variant: "outline" })}>
              Launch Campaign
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Prospect Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Priority</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Pipeline Stage</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {activeLeads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-muted/50 transition duration-150">
                    <td className="px-6 py-4 min-w-[200px]">
                      <Link href={`/leads/${lead.id}`} className="hover:underline group block">
                        <div className="font-bold text-card-foreground text-sm leading-snug group-hover:text-primary transition-colors truncate max-w-[240px] md:max-w-[320px]">{lead.name}</div>
                      </Link>                      <div className="flex flex-col gap-0.5 mt-1">
                        {lead.company && (
                          <div className="text-xs text-foreground/85 font-semibold truncate max-w-[240px] md:max-w-[320px]">{lead.company}</div>
                        )}
                        {lead.email && (
                          <div className="text-xs text-muted-foreground font-medium truncate max-w-[240px] md:max-w-[320px]">{lead.email}</div>
                        )}
                        {lead.campaignName && (
                          <div className="mt-1 flex">
                            <Link 
                              href={`/scopes/${lead.campaignId}`}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted/65 text-muted-foreground border border-border/50 uppercase tracking-wide hover:bg-muted hover:text-foreground transition-colors"
                            >
                              Campaign: {lead.campaignName}
                            </Link>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {lead.scoreValue !== null && lead.scoreValue !== undefined ? (
                        <span 
                          aria-label={`${lead.scoreLabel} Priority, score ${lead.scoreValue} out of 100`}
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${
                            lead.scoreLabel === 'High' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            lead.scoreLabel === 'Medium' ? 'bg-chart-3/15 text-chart-3 border-chart-3/30' :
                            'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                            lead.scoreLabel === 'High' ? 'bg-destructive animate-pulse' :
                            lead.scoreLabel === 'Medium' ? 'bg-chart-3' : 'bg-muted-foreground'
                          }`} />
                          {lead.scoreLabel} ({lead.scoreValue})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border bg-muted/50 text-muted-foreground border-border/60">
                          Unassessed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getStageBadgeClass(lead.stage)}`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <form action={archiveLeadAction.bind(null, lead.id)}>
                        <Button type="submit" variant="destructive" size="xs">Archive</Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
