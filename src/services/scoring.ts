import { Db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { leads, leadScores, audits, activities } from '../db/schema';

export interface ScoringFactor {
  name: string;
  value: number;
  description: string;
}

export class ScoringService {
  constructor(private db: Db) {}

  /**
   * Recalculates and saves the priority score for a lead based on profile completeness,
   * triage priority, and website audit opportunity.
   */
  async recalculateScore(leadId: string, jobRunId: string | null = null, userId: string | null = null) {
    const [lead] = await this.db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) {
      throw new Error(`Lead not found for scoring: ${leadId}`);
    }

    // Fetch the latest audit for this lead
    const [latestAudit] = await this.db
      .select()
      .from(audits)
      .where(eq(audits.leadId, leadId))
      .orderBy(desc(audits.createdAt))
      .limit(1);

    const factors: ScoringFactor[] = [];
    let scoreValue = 10; // Base baseline priority points
    factors.push({ name: 'Base Priority', value: 10, description: 'Baseline priority weight' });

    // 1. Profile Completeness Factors
    if (lead.website) {
      scoreValue += 15;
      factors.push({ name: 'Profile: Has Website', value: 15, description: 'Website is present, allowing digital audit' });
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

    // 2. Initial Triage Modifier
    if (lead.triagePriority === 'HIGH') {
      scoreValue += 15;
      factors.push({ name: 'Triage: High Priority', value: 15, description: 'Initial triage flagged as high relevance' });
    } else if (lead.triagePriority === 'MEDIUM') {
      scoreValue += 5;
      factors.push({ name: 'Triage: Medium Priority', value: 5, description: 'Initial triage flagged as medium relevance' });
    } else if (lead.triagePriority === 'SKIP') {
      scoreValue -= 20;
      factors.push({ name: 'Triage: Skip Flag', value: -20, description: 'Initial triage recommended skip' });
    }

    // 3. Digital Audit Opportunity Factors (Agency-fit: weak sites are HIGH opportunity)
    if (latestAudit) {
      const wQuality = latestAudit.websiteQualityScore ?? 100;
      const dAesthetic = latestAudit.designAestheticScore ?? 100;
      const mClarity = latestAudit.messagingClarityScore ?? 100;
      const sPresence = latestAudit.socialPresenceScore ?? 100;
      const oBranding = latestAudit.overallBrandingScore ?? 100;

      if (wQuality < 50) {
        scoreValue += 15;
        factors.push({ name: 'Audit: Weak Site Performance', value: 15, description: `Website quality score is low (${wQuality}/100) — high redesign/technical opportunity` });
      }
      if (dAesthetic < 60) {
        scoreValue += 15;
        factors.push({ name: 'Audit: Weak Aesthetic Appeal', value: 15, description: `Design aesthetic score is low (${dAesthetic}/100) — high branding/visual refresh opportunity` });
      }
      if (mClarity < 60) {
        scoreValue += 10;
        factors.push({ name: 'Audit: Vague Messaging', value: 10, description: `Messaging clarity score is low (${mClarity}/100) — high copy/marketing layout opportunity` });
      }
      if (sPresence < 50) {
        scoreValue += 10;
        factors.push({ name: 'Audit: Weak Social Footprint', value: 10, description: `Social presence score is low (${sPresence}/100) — social media collateral opportunity` });
      }
      if (oBranding < 60) {
        scoreValue += 10;
        factors.push({ name: 'Audit: Inconsistent Branding', value: 10, description: `Overall branding consistency score is low (${oBranding}/100) — rebranding bundle opportunity` });
      }
    }

    // Clamp score value between 0 and 100
    scoreValue = Math.max(0, Math.min(100, scoreValue));

    // Determine priority label
    let scoreLabel: 'High' | 'Medium' | 'Low' = 'Low';
    if (scoreValue >= 75) {
      scoreLabel = 'High';
    } else if (scoreValue >= 45) {
      scoreLabel = 'Medium';
    }

    // Construct a written rationale summary
    const positiveFactors = factors.filter(f => f.value > 0);
    const negativeFactors = factors.filter(f => f.value < 0);
    
    let rationaleSummary = `Calculated Priority: ${scoreLabel} (${scoreValue}/100). `;
    if (latestAudit) {
      rationaleSummary += `Enriched by website audit. `;
    } else {
      rationaleSummary += `Based on basic profile data; run audit for deeper prioritization. `;
    }
    
    if (positiveFactors.length > 1) {
      rationaleSummary += `Key drivers: ${positiveFactors.slice(1, 4).map(f => f.name.replace('Profile: ', '').replace('Audit: ', '')).join(', ')}.`;
    }
    if (negativeFactors.length > 0) {
      rationaleSummary += ` Negatives: ${negativeFactors.map(f => f.name).join(', ')}.`;
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
      origin: userId ? 'MANUAL_OVERRIDE' : (jobRunId ? 'AI_SUGGESTED' : 'RULE_BASED'),
      isCurrent: 1,
      createdByUserId: userId,
      jobRunId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(leadScores).values(newScore);

    // Insert activity log
    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId,
      type: 'Score updated',
      summary: `Lead score calculated as ${scoreValue} (${scoreLabel})`,
      timestamp: now,
    });

    return newScore;
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
    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId,
      type: 'Score updated',
      summary: `Score overridden to ${value} (${scoreLabel}) by operator`,
      timestamp: now,
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
