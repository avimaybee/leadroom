export const dynamic = 'force-dynamic';

import { listMarketsAction } from '@/app/actions/strategy';
import { getUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MarketsListClient } from '@/components/markets/MarketsListClient';

export const metadata = {
  title: 'Markets | Leadroom',
};

export default async function MarketsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/login');

  const result = await listMarketsAction();
  const markets = result.success ? result.markets : [];

  return <MarketsListClient initialMarkets={markets as any} />;
}
