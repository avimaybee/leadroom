import { type Db } from '../db';
import { eq, sql, and } from 'drizzle-orm';
import { discoveryScopes, candidateLeads } from '../db/schema/discovery';

export class MarketOptimizationService {
  constructor(private db: Db) {}

  async getMarketMetrics(niche: string, location: string) {
    const minLeadsThreshold = 50;
    
    // Total leads for this niche and location
    const statsQuery = await this.db.select({
      total: sql<number>`count(${candidateLeads.id})`,
      promoted: sql<number>`sum(case when ${candidateLeads.status} = 'PROMOTED' then 1 else 0 end)`
    }).from(candidateLeads)
      .innerJoin(discoveryScopes, eq(candidateLeads.discoveryScopeId, discoveryScopes.id))
      .where(and(
        sql`LOWER(${discoveryScopes.industryFilter}) = LOWER(${niche})`,
        sql`LOWER(${discoveryScopes.geographyFilter}) = LOWER(${location})`
      ));

    const stats = statsQuery[0];
    const total = Number(stats?.total || 0);
    const promoted = Number(stats?.promoted || 0);

    let conversionRate = null;
    if (total >= minLeadsThreshold) {
      conversionRate = (promoted / total) * 100;
    }

    // Now get alternative niches for the same location
    const alternativesQuery = await this.db.select({
      niche: discoveryScopes.industryFilter,
      total: sql<number>`count(${candidateLeads.id})`,
      promoted: sql<number>`sum(case when ${candidateLeads.status} = 'PROMOTED' then 1 else 0 end)`
    }).from(candidateLeads)
      .innerJoin(discoveryScopes, eq(candidateLeads.discoveryScopeId, discoveryScopes.id))
      .where(and(
        sql`LOWER(${discoveryScopes.geographyFilter}) = LOWER(${location})`,
        sql`LOWER(${discoveryScopes.industryFilter}) != LOWER(${niche})`,
        sql`${discoveryScopes.industryFilter} IS NOT NULL`
      ))
      .groupBy(discoveryScopes.industryFilter);

    const recommendations = alternativesQuery
      .map(alt => {
        const altTotal = Number(alt.total || 0);
        const altPromoted = Number(alt.promoted || 0);
        return {
          niche: alt.niche,
          conversionRate: altTotal >= minLeadsThreshold ? (altPromoted / altTotal) * 100 : null,
          total: altTotal
        };
      })
      .filter(alt => alt.conversionRate !== null)
      .sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0))
      .slice(0, 5); // top 5

    return {
      total,
      promoted,
      conversionRate,
      recommendations
    };
  }
}
