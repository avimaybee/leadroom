export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Plus, Target, ArrowRight, Settings } from 'lucide-react';
import { listMarketsAction } from '@/app/actions/strategy';
import { getUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Markets | Leadroom',
};

export default async function MarketsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/login');

  const result = await listMarketsAction();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-heading-2xl">Markets</h1>
          <p className="text-copy-14 text-muted-foreground mt-1">
            Target market segments — each links an Offer and ICP Profile together.
          </p>
        </div>
        <Link
          href="/settings/market/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Market
        </Link>
      </div>

      {!result.success || result.markets.length === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
            <Target className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-heading-lg text-foreground">No markets yet</h2>
          <p className="text-copy-14 text-muted-foreground mt-2 max-w-md mx-auto">
            Create a market to link your Offer and ICP Profile, add prospects, and run research.
          </p>
          <Link
            href="/settings/market/new"
            className="inline-flex items-center gap-2 mt-6 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Market
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.markets.map((market) => (
            <Link
              key={market.id}
              href={`/markets/${market.id}/prospects`}
              className="block rounded-xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-heading-sm text-card-foreground">{market.name}</h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-label-12 font-semibold mt-1 ${
                        market.status === 'active'
                          ? 'bg-chart-2/10 text-chart-2'
                          : 'bg-chart-5/10 text-chart-5'
                      }`}
                    >
                      {market.status || 'active'}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="space-y-1 text-copy-13 text-muted-foreground">
                <p>Offer: {(market as any).offerName || <span className="italic">None linked</span>}</p>
                <p>ICP: {(market as any).icpName || <span className="italic">None linked</span>}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex justify-end">
                <Link
                  href={`/settings/market/${market.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-label-12 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  Settings
                </Link>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
