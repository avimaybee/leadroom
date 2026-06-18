import { LoggingService } from './logging';
import { Db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { leads, leadScores, audits, activities, researchSnapshots } from '../db/schema';
import { generateLeadScore, getActiveProviderConfig } from '../lib/ai';

export interface ScoringFactor {
  name: string;
  value: number;
  description: string;
}

export class ScoringService {
  constructor(private db: Db) {}

  /**
   * Recalculates and saves the priority score for a lead.
   * If research and audit snapshots are available, calls the AI lead scoring generator.
   * Otherwise, calculates a baseline score based on profile completeness.
   */
  async recalculateScore(leadId: string, jobRunId: string | null = null, userId: string | null = null) {
    const [lead] = await this.db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) {
      throw new Error(`Lead not found for scoring: ${leadId}`);
    }

    // Fetch the latest research snapshot for this lead
    const [latestResearch] = await this.db
      .select()
      .from(researchSnapshots)
      .where(eq(researchSnapshots.leadId, leadId))
      .orderBy(desc(researchSnapshots.createdAt))
      .limit(1);

    // Fetch the latest audit for this lead
    const [latestAudit] = await this.db
      .select()
      .from(audits)
      .where(eq(audits.leadId, leadId))
      .orderBy(desc(audits.createdAt))
      .limit(1);

    let scoreValue = 10;
    let scoreLabel: 'High' | 'Medium' | 'Low' = 'Low';
    let rationaleSummary = '';
    let factors: string[] = [];
    let origin: 'RULE_BASED' | 'AI_SUGGESTED' | 'MANUAL_OVERRIDE' = 'RULE_BASED';

    let hasActiveConfig = false;
    try {
      const config = await getActiveProviderConfig(this.db);
      // If we are in tests, we can fall back to environment variable if configured,
      // but otherwise verify api_key is present.
      const apiKey = config?.apiKey || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined);
      if (apiKey && apiKey !== 'placeholder' && apiKey !== '') {
        hasActiveConfig = true;
      }
    } catch (e) {}

    if ((latestResearch || latestAudit) && hasActiveConfig) {
      try {
        const aiScore = await generateLeadScore(this.db, lead.name, latestResearch, latestAudit);
        scoreValue = aiScore.score;
        rationaleSummary = aiScore.rationaleSummary;
        factors = aiScore.factors;
        origin = 'AI_SUGGESTED';
      } catch (err) {
        console.error('[ScoringService] AI scoring failed, using baseline:', err);
        // Fallback to completeness
        const fallback = this.calculateCompletenessScore(lead, latestAudit);
        scoreValue = fallback.scoreValue;
        rationaleSummary = 'Fallback baseline score (AI generation failed).';
        factors = fallback.factors.map(f => `${f.name}: ${f.description}`);
      }
    } else {
      const fallback = this.calculateCompletenessScore(lead, latestAudit);
      scoreValue = fallback.scoreValue;
      rationaleSummary = `Calculated baseline priority based on profile completeness.`;
      factors = fallback.factors.map(f => `${f.name}: ${f.description}`);
    }

    // Clamp score value between 0 and 100
    scoreValue = Math.max(0, Math.min(100, scoreValue));

    // Determine priority label
    if (scoreValue >= 80) {
      scoreLabel = 'High';
    } else if (scoreValue >= 50) {
      scoreLabel = 'Medium';
    } else {
      scoreLabel = 'Low';
    }

    const scoreId = crypto.randomUUID();
    const now = new Date();

    // De-activate old current score
    await this.db
      .update(leadScores)
      .set({ isCurrent: 0, updatedAt: now })
      .where(and(eq(leadScores.leadId, leadId), eq(leadScores.isCurrent, 1)));

    // Insert new current score
    const newScore = {
      id: scoreId,
      leadId,
      scoreValue,
      scoreLabel,
      rationaleSummary,
      factors: JSON.stringify(factors),
      origin: userId ? ('MANUAL_OVERRIDE' as const) : (jobRunId ? ('AI_SUGGESTED' as const) : origin),
      isCurrent: 1,
      createdByUserId: userId,
      jobRunId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(leadScores).values(newScore);

    // Insert activity log
    await new LoggingService(this.db).log({
leadId,
      type: 'Score updated',
      summary: `Lead score updated to ${scoreValue} (${scoreLabel})`,
      
});

    return newScore;
  }

  private calculateCompletenessScore(lead: any, latestAudit: any) {
    const factors: ScoringFactor[] = [];
    let scoreValue = 10; // Base baseline priority points
    factors.push({ name: 'Base Priority', value: 10, description: 'Baseline priority weight' });

    // 1. Profile Completeness Factors
    if (lead.website) {
      scoreValue += 15;
      factors.push({ name: 'Profile: Has Website', value: 15, description: 'Website is present' });
    }
    if (lead.email) {
      scoreValue += 10;
      factors.push({ name: 'Profile: Has Email', value: 10, description: 'Direct email contact is available' });
    }
    if (lead.phone) {
      scoreValue += 10;
      factors.push({ name: 'Profile: Has Phone', value: 10, description: 'Direct phone contact is available' });
    }
    if (lead.city || lead.region) {
      scoreValue += 5;
      factors.push({ name: 'Profile: Has Location', value: 5, description: 'Geographic region context is present' });
    }
    if (lead.industry) {
      scoreValue += 10;
      factors.push({ name: 'Profile: Has Industry', value: 10, description: 'Industry classification is identified' });
    }

    // 2. Audit Presence Factor
    if (latestAudit) {
      scoreValue += 30;
      factors.push({ name: 'Audit: Completed', value: 30, description: 'Digital presence audit has been performed' });
    }

    return { scoreValue, factors };
  }

  /**
   * Allows operator to manually override a score with a specific value and custom justification.
   */
  async manualOverride(leadId: string, value: number, rationale: string, userId: string) {
    if (value < 0 || value > 100) {
      throw new Error('Override score must be between 0 and 100');
    }

    const now = new Date();
    const scoreId = crypto.randomUUID();

    // De-activate old current score
    await this.db
      .update(leadScores)
      .set({ isCurrent: 0, updatedAt: now })
      .where(and(eq(leadScores.leadId, leadId), eq(leadScores.isCurrent, 1)));

    // Determine label
    let scoreLabel: 'High' | 'Medium' | 'Low' = 'Low';
    if (value >= 75) {
      scoreLabel = 'High';
    } else if (value >= 45) {
      scoreLabel = 'Medium';
    }

    const factors = [
      { name: 'Manual Override', value, description: `Overridden by operator with justification: "${rationale}"` }
    ];

    const overrideScore = {
      id: scoreId,
      leadId,
      scoreValue: value,
      scoreLabel,
      rationaleSummary: rationale,
      factors: JSON.stringify(factors),
      origin: 'MANUAL_OVERRIDE' as const,
      isCurrent: 1,
      createdByUserId: userId,
      jobRunId: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(leadScores).values(overrideScore);

    // Log Activity
    await new LoggingService(this.db).log({
leadId,
      type: 'Score updated',
      summary: `Score overridden to ${value} (${scoreLabel}) by operator`,
      
});

    return overrideScore;
  }

  /**
   * Retrieves current score for a lead.
   */
  async getCurrentScore(leadId: string) {
    const [score] = await this.db
      .select()
      .from(leadScores)
      .where(and(eq(leadScores.leadId, leadId), eq(leadScores.isCurrent, 1)))
      .limit(1);
    return score || null;
  }
}
