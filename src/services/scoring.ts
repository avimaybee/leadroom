import { LoggingService } from './logging';
import { Db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { leads, leadScores, audits, researchSnapshots, researchTasks } from '../db/schema';
import { markets, icpProfiles } from '../db/schema/strategy';
import { calculateScore } from '../lib/domain/scoring';

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

    let isIcpScored = false;
    let scoreValue = 0;
    let scoreLabel: 'High' | 'Medium' | 'Low' = 'Low';
    let rationaleSummary = '';
    let factors: string[] = [];
    let fitReasoning = '';

    // Check for Market and ICP Profile
    if (lead.marketId) {
      const [marketRow] = await this.db.select().from(markets).where(eq(markets.id, lead.marketId)).limit(1);
      if (marketRow?.icpProfileId) {
        const [icpRow] = await this.db.select().from(icpProfiles).where(eq(icpProfiles.id, marketRow.icpProfileId)).limit(1);
        if (icpRow) {
          const positiveSignals = icpRow.positiveSignals ? JSON.parse(icpRow.positiveSignals) : [];
          const negativeSignals = icpRow.negativeSignals ? JSON.parse(icpRow.negativeSignals) : [];
          const disqualifiers = icpRow.disqualifiers ? JSON.parse(icpRow.disqualifiers) : [];

          // Load completed tasks
          const taskRows = await this.db
            .select()
            .from(researchTasks)
            .where(eq(researchTasks.prospectId, leadId));
          
          const extractedSignals: any[] = [];
          for (const task of taskRows) {
            if (task.status === 'COMPLETED' && task.extractedSignals) {
              try {
                const signals = JSON.parse(task.extractedSignals);
                if (Array.isArray(signals)) {
                  extractedSignals.push(...signals);
                }
              } catch {}
            }
          }

          // Fetch confidence
          const webTask = taskRows.find(t => t.taskType === 'WEBSITE_ANALYST');
          const confidenceScore = webTask?.confidence ?? 80;

          // Compute ICP score
          const icpResult = calculateScore({
            icpProfile: { positiveSignals, negativeSignals, disqualifiers },
            extractedSignals,
            researchConfidence: confidenceScore,
          });

          isIcpScored = true;
          scoreValue = icpResult.fitScore;
          
          if (icpResult.priorityTier === 'disqualified') {
            scoreLabel = 'Low';
          } else if (icpResult.priorityTier === 'tier1') {
            scoreLabel = 'High';
          } else if (icpResult.priorityTier === 'tier2') {
            scoreLabel = 'Medium';
          } else {
            scoreLabel = 'Low';
          }

          rationaleSummary = icpResult.fitReasoning;
          fitReasoning = icpResult.fitReasoning;
          factors = icpResult.breakdown.map(b => `${b.factor}: ${b.evidenceQuote} (${b.contribution >= 0 ? '+' : ''}${b.contribution})`);

          // Update prospects priority tier & disqualified reason & confidence score
          await this.db.update(leads).set({
            fitScore: icpResult.fitScore,
            confidenceScore: icpResult.confidenceScore,
            priorityTier: icpResult.priorityTier,
            disqualifiedReason: icpResult.priorityTier === 'disqualified'
              ? (icpResult.breakdown.find(b => b.factor.startsWith('Disqualified'))?.factor.replace('Disqualified: ', '') || 'Matches disqualifier')
              : null,
          }).where(eq(leads.id, leadId));
        }
      }
    }

    if (!isIcpScored) {
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

      // Pure deterministic completeness & quality score
      const calculation = this.calculateCompletenessScore(lead, latestAudit, latestResearch);
      scoreValue = calculation.scoreValue;
      factors = calculation.factors.map(f => `${f.name}: ${f.description} (+${f.value})`);
      
      scoreLabel = 'Low';
      if (scoreValue >= 80) {
        scoreLabel = 'High';
      } else if (scoreValue >= 50) {
        scoreLabel = 'Medium';
      }

      if (latestResearch && latestAudit) {
        rationaleSummary = `Priority score calculated from profile completeness, high-confidence research, and design audit findings.`;
      } else if (latestResearch || latestAudit) {
        rationaleSummary = `Priority score calculated from profile completeness and partial AI snapshots.`;
      } else {
        rationaleSummary = `Calculated baseline priority based on profile completeness.`;
      }

      fitReasoning = this.generateFitReasoning(scoreValue, scoreLabel, lead, latestResearch, latestAudit, factors);

      const pTier = scoreLabel === 'High' ? 'tier1' : scoreLabel === 'Medium' ? 'tier2' : 'tier3';
      await this.db.update(leads).set({
        fitScore: scoreValue,
        confidenceScore: latestResearch?.confidenceLevel === 'HIGH' ? 90 : latestResearch?.confidenceLevel === 'MEDIUM' ? 60 : 30,
        priorityTier: pTier,
      }).where(eq(leads.id, leadId));
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
      origin: userId ? ('MANUAL_OVERRIDE' as const) : (jobRunId ? ('AI_SUGGESTED' as const) : ('RULE_BASED' as const)),
      isCurrent: 1,
      createdByUserId: userId,
      jobRunId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(leadScores).values(newScore);

    // Clear score dirty flag and update fit reasoning
    await this.db.update(leads).set({ scoreDirty: false, fitReasoning }).where(eq(leads.id, leadId));

    // Insert activity log
    await new LoggingService(this.db).log({
      leadId,
      type: 'Score updated',
      summary: `Lead score updated to ${scoreValue} (${scoreLabel})`,
    });

    return newScore;
  }

  private calculateCompletenessScore(lead: any, latestAudit: any, latestResearch?: any) {
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

    // 2. Audit Presence & Findings Factors
    if (latestAudit) {
      scoreValue += 30;
      factors.push({ name: 'Audit: Performed', value: 30, description: 'Digital presence audit has been completed' });

      const weaknesses = latestAudit.keyWeaknesses || '';
      if (weaknesses.includes('-') || weaknesses.length > 20) {
        scoreValue += 5;
        factors.push({ name: 'Audit: Weaknesses Identified', value: 5, description: 'Specific UX/branding weaknesses discovered' });
      }

      const improvements = latestAudit.recommendedImprovements || '';
      if (improvements.includes('-') || improvements.length > 20) {
        scoreValue += 5;
        factors.push({ name: 'Audit: Recommendations Logged', value: 5, description: 'Actionable improvements recommended' });
      }
    }

    // 3. Research Presence & Findings Factors
    if (latestResearch) {
      scoreValue += 10;
      factors.push({ name: 'Research: Snapshot Created', value: 10, description: 'AI research snapshot has been generated' });

      if (latestResearch.confidenceLevel === 'HIGH') {
        scoreValue += 5;
        factors.push({ name: 'Research: High Confidence Data', value: 5, description: 'Scraped data is rich and verified' });
      } else if (latestResearch.confidenceLevel === 'MEDIUM') {
        scoreValue += 2;
        factors.push({ name: 'Research: Medium Confidence Data', value: 2, description: 'Scraped data is partially verified' });
      }

      const painPoints = latestResearch.painPointsHypotheses || '';
      if (painPoints.includes('-') || painPoints.length > 20) {
        scoreValue += 5;
        factors.push({ name: 'Research: Pain Points Defined', value: 5, description: 'Pain points and business implications mapped' });
      }

      const opps = latestResearch.opportunityHypotheses || '';
      if (opps.includes('-') || opps.length > 20) {
        scoreValue += 5;
        factors.push({ name: 'Research: Opportunities Proposed', value: 5, description: 'Specific pitch angles and project opportunities identified' });
      }
    }

    return { scoreValue: Math.min(100, scoreValue), factors };
  }

  private generateFitReasoning(
    scoreValue: number,
    scoreLabel: string,
    lead: any,
    latestResearch: any,
    latestAudit: any,
    factors: string[],
  ): string {
    if (scoreValue >= 80) {
      const hasResearch = !!latestResearch;
      const hasAudit = !!latestAudit;
      if (hasResearch && hasAudit) {
        return `Strong profile: complete research and audit data, score ${scoreValue}/100`;
      }
      return `Strong profile: score ${scoreValue}/100 based on complete data`;
    }
    if (scoreValue >= 50) {
      const missingFields: string[] = [];
      if (!lead.website) missingFields.push('website');
      if (!lead.email) missingFields.push('email');
      if (!lead.phone) missingFields.push('phone');
      if (!latestResearch) missingFields.push('research');
      if (!latestAudit) missingFields.push('audit');
      const detail = missingFields.length > 0 ? ` — missing ${missingFields.join(', ')}` : '';
      return `Moderate profile: score ${scoreValue}/100${detail}`;
    }
    const filled = [lead.website, lead.email, lead.phone].filter(Boolean).length;
    return `Minimal profile: only ${filled}/3 key contact fields filled, score ${scoreValue}/100`;
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

    // Persist fit reasoning on prospect
    const fitReasoning = `Score manually overridden to ${value}: ${rationale}`;
    await this.db.update(leads).set({ fitReasoning }).where(eq(leads.id, leadId));

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
