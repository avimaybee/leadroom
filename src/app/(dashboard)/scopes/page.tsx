export const dynamic = 'force-dynamic';
import { DiscoveryService } from '@/services/discovery';
import { getDb } from '@/db';
import Link from 'next/link';
import { formatUTC } from '@/lib/date';


export default async function ScopesPage() {
  const db = getDb();
  const service = new DiscoveryService(db);

  const scopes = await service.listScopes();

  // Enhance scopes with candidate counts
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
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Outreach Campaigns</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Define target segments and manage prospects for your outreach campaigns.
          </p>
        </div>
        <Link
          href="/scopes/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-indigo-600/10 hover:scale-[1.01]"
        >
          + New Campaign
        </Link>
      </div>

      {scopesWithStats.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto mt-8">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1.5">No outreach campaigns yet</h3>
          <p className="text-sm text-slate-500 mb-6">
            Create your first outreach campaign to start finding and qualifying business leads.
          </p>
          <Link
            href="/scopes/new"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition"
          >
            Create your first Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scopesWithStats.map((scope) => (
            <div
              key={scope.id}
              className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-500/50 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between min-h-[220px]"
            >
              {/* Stretched Link Overlay */}
              <Link href={`/scopes/${scope.id}`} className="absolute inset-0 z-0" aria-label={`View campaign ${scope.name}`} />

              {/* Card Header & Content */}
              <div className="relative z-10 pointer-events-none space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="max-w-[70%]">
                    <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-indigo-600 transition capitalize truncate">
                      {scope.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {scope.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {scope.totalCount === 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        No Candidates
                      </span>
                    ) : scope.pendingCount > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {scope.pendingCount} pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200">
                        All Reviewed
                      </span>
                    )}
                  </div>
                </div>

                {/* Filters list */}
                <div className="flex flex-wrap gap-1.5">
                  {scope.industryFilter && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                      {scope.industryFilter}
                    </span>
                  )}
                  {scope.geographyFilter && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                      {scope.geographyFilter}
                    </span>
                  )}
                  {scope.companySizeFilter && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                      {scope.companySizeFilter}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="relative z-10 mt-6 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                  <span>Total prospects: {scope.totalCount}</span>
                  <span>Created {formatUTC(scope.createdAt)}</span>
                </div>

                {scope.totalCount === 0 ? (
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3 mt-2 pointer-events-auto">
                    <span className="text-[11px] font-semibold text-slate-500 leading-snug">
                      0 prospects &mdash; start a Discovery scan to populate.
                    </span>
                    <Link
                      href={`/scopes/${scope.id}`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline shrink-0"
                    >
                      Scan Now &rarr;
                    </Link>
                  </div>
                ) : (
                  <div className="flex justify-end pt-1">
                    <span className="text-xs font-bold text-indigo-600 group-hover:text-indigo-700 transition flex items-center gap-0.5">
                      View Campaign &rarr;
                    </span>
                  </div>
                )}
              </div>

              {/* Highlight accent on hover */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-indigo-600 transition-all duration-200" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
