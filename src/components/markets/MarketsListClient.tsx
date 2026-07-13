'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Target, ArrowRight, Settings } from 'lucide-react';
import { CreateMarketWizard } from './CreateMarketWizard';
import { Button } from '@/components/ui/button';

interface Market {
  id: string;
  name: string;
  status: string | null;
  offerName?: string | null;
  icpName?: string | null;
}

interface MarketsListClientProps {
  initialMarkets: Market[];
}

export function MarketsListClient({ initialMarkets }: MarketsListClientProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-heading-2xl">Markets</h1>
          <p className="text-copy-14 text-muted-foreground mt-1">
            Target market segments — each links an Offer and Ideal Client together.
          </p>
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors font-semibold"
        >
          <Plus className="w-4 h-4" />
          Create Market
        </Button>
      </div>

      {initialMarkets.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-border rounded-2xl bg-card/50">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
            <Target className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-heading-lg text-foreground">No markets yet</h2>
          <p className="text-copy-14 text-muted-foreground mt-2 max-w-md mx-auto">
            Create a market to link your Offer and Ideal Client, add prospects, and run research.
          </p>
          <Button
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-2 mt-6 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors font-semibold"
          >
            <Plus className="w-4 h-4" />
            Create Market
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {initialMarkets.map((market) => (
            <div
              key={market.id}
              className="block rounded-xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-sm transition-all group relative"
            >
              <Link href={`/markets/${market.id}/prospects`} className="absolute inset-0 z-0" />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-heading-sm text-card-foreground font-semibold">{market.name}</h3>
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
                <div className="space-y-1 text-copy-13 text-muted-foreground mt-4">
                  <p>Offer: {market.offerName || <span className="italic">None linked</span>}</p>
                  <p>ICP: {market.icpName || <span className="italic">None linked</span>}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-border flex justify-end">
                  <Link
                    href={`/settings/market/${market.id}`}
                    className="inline-flex items-center gap-1.5 text-label-12 text-muted-foreground hover:text-foreground transition-colors relative z-20"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateMarketWizard isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
