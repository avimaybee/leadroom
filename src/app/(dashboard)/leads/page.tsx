export const dynamic = 'force-dynamic';
import { getDb } from '@/db';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { archiveLeadAction } from '@/app/actions/leads';
import { Button, buttonVariants } from '@/components/ui/button';
import { leads, leadScores, candidateLeads, discoveryScopes } from '@/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { LeadsTable } from './LeadsTable';

export default async function LeadsPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const db = getDb();
  
  const searchParams = await props.searchParams;
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'updatedAt';
  const order = typeof searchParams.order === 'string' ? searchParams.order : 'desc';

  const sortFn = order === 'asc' ? asc : desc;

  const activeLeads = await db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      email: leads.email,
      stage: leads.stage,
      status: leads.status,
      stageUpdatedAt: leads.stageUpdatedAt,
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
    .orderBy(sortFn(sort === 'stageUpdatedAt' ? leads.stageUpdatedAt : leads.updatedAt));

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
        <LeadsTable leads={activeLeads} sort={sort} order={order} />
      )}
    </div>
  );
}
