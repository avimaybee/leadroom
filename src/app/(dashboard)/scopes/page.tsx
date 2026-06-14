export const dynamic = 'force-dynamic';
import { DiscoveryService } from '@/services/discovery';
import { getDb } from '@/db';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { formatUTC } from '@/lib/date';
import { Badge } from '@/components/ui/badge';


export default async function ScopesPage() {
  const db = getDb();
  const service = new DiscoveryService(db);

  const scopes = await service.listScopes();

  const scopesWithStats = await Promise.all(
    scopes.map(async (scope: any) => {
      const candidates = await service.listCandidatesByScope(scope.id);
      const pendingCount = candidates.filter((c: any) => c.status === 'NEW').length;
      const totalCount = candidates.length;
      return {
        ...scope,
        pendingCount,
        totalCount,
      };
    })
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Outreach Campaigns</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Define target segments and manage prospects for your outreach campaigns.
          </p>
        </div>
        <Link
          href="/scopes/new"
          className="bg-primary hover:bg-primary/80 text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-primary/10 hover:scale-[1.01]"
        >
          + New Campaign
        </Link>
      </div>

      {scopesWithStats.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center max-w-xl mx-auto mt-8">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mx-auto mb-4">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1.5">No outreach campaigns yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Create your first outreach campaign to start finding and qualifying business leads.
          </p>
          <Link
            href="/scopes/new"
            className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/80 text-primary-foreground font-semibold rounded-xl text-sm transition"
          >
            Create your first Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scopesWithStats.map((scope) => (
            <div
              key={scope.id}
              className="group relative bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between min-h-[220px]"
            >
              <Link href={`/scopes/${scope.id}`} className="absolute inset-0 z-0" aria-label={`View campaign ${scope.name}`} />

              <div className="relative z-10 pointer-events-none space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="max-w-[70%]">
                    <h3 className="font-extrabold text-foreground text-lg group-hover:text-primary transition capitalize truncate">
                      {scope.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {scope.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {scope.totalCount === 0 ? (
                      <Badge variant="outline">No Candidates</Badge>
                    ) : scope.pendingCount > 0 ? (
                      <Badge variant="secondary" className="bg-chart-5/10 text-chart-5 border-chart-5/20">{scope.pendingCount} pending</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted/50">All Reviewed</Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {scope.industryFilter && (
                    <Badge variant="secondary" className="text-xs font-medium">{scope.industryFilter}</Badge>
                  )}
                  {scope.geographyFilter && (
                    <Badge variant="secondary" className="text-xs font-medium">{scope.geographyFilter}</Badge>
                  )}
                  {scope.companySizeFilter && (
                    <Badge variant="secondary" className="text-xs font-medium">{scope.companySizeFilter}</Badge>
                  )}
                </div>
              </div>

              <div className="relative z-10 mt-6 pt-4 border-t border-border space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                  <span>Total prospects: {scope.totalCount}</span>
                  <span>Created {formatUTC(scope.createdAt)}</span>
                </div>

                {scope.totalCount === 0 ? (
                  <div className="bg-muted/50 p-3 rounded-xl border border-border/60 flex items-center justify-between gap-3 mt-2 pointer-events-auto">
                    <span className="text-xs font-semibold text-muted-foreground leading-snug">
                      0 prospects &mdash; start a Discovery scan to populate.
                    </span>
                    <Link
                      href={`/scopes/${scope.id}`}
                      className="text-xs font-bold text-primary hover:text-primary/80 hover:underline shrink-0"
                    >
                      Scan Now &rarr;
                    </Link>
                  </div>
                ) : (
                  <div className="flex justify-end pt-1">
                    <span className="text-xs font-bold text-primary group-hover:text-primary/80 transition flex items-center gap-0.5">
                      View Campaign &rarr;
                    </span>
                  </div>
                )}
              </div>

              <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-primary transition-all duration-200" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
