import { getLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { MarketOptimizationService } from '@/services/market-optimization';
import { getUserId } from '@/lib/auth';

const log = getLogger('MarketMetricsAPI');

export const revalidate = 300; // Cache for 5 minutes

export async function GET(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche');
    const location = searchParams.get('location');

    if (!niche || !location) {
      return NextResponse.json(
        { error: 'niche and location are required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const service = new MarketOptimizationService(db);
    const metrics = await service.getMarketMetrics(niche, location);

    return NextResponse.json({ data: metrics });
  } catch (err: unknown) {
    log.error('Failed to get market metrics', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
