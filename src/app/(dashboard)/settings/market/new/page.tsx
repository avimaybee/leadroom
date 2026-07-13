export const dynamic = 'force-dynamic';

import { MarketForm } from '@/components/settings/MarketForm';

export const metadata = {
  title: 'New Market | Leadroom',
};

export default function NewMarketPage() {
  return (
    <div>
      <h2 className="text-heading-lg mb-1">New Market</h2>
      <p className="text-copy-14 text-muted-foreground mb-6 max-w-2xl">
        A market links an Offer and Ideal Client together, defining a target segment to pursue.
      </p>
      <MarketForm />
    </div>
  );
}
