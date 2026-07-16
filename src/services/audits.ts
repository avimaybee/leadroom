import { LoggingService } from './logging';
import { type Db } from '../db';
import { eq, desc } from 'drizzle-orm';
import { audits, activities, leads } from '../db/schema';
import { ScoringService } from './scoring';
import { LeadService } from './lead';

export interface CreateAuditInput {
  leadId: string;
  createdByUserId?: string | null;
  origin?: 'MANUAL' | 'AI_GENERATED';
  keyStrengths: string | null;
  keyWeaknesses: string | null;
  recommendedImprovements: string | null;
  opportunityNotes?: string | null;
  sources?: string[] | null;
  jobRunId?: string | null;
}

export class AuditService {
  private scoringService: ScoringService;

  constructor(private db: Db) {
    this.scoringService = new ScoringService(db);
  }

  /**
   * Retrieves the current active or latest audit snapshot for a lead.
   */
  async getLatestAudit(leadId: string) {
    const [audit] = await this.db
      .select()
      .from(audits)
      .where(eq(audits.leadId, leadId))
      .orderBy(desc(audits.createdAt))
      .limit(1);
    return audit || null;
  }

  /**
   * Creates a new website audit record and triggers lead score recalculation.
   */
  async createAudit(input: CreateAuditInput) {
    const id = crypto.randomUUID();
    const now = new Date();

    const newAudit = {
      id,
      leadId: input.leadId,
      createdByUserId: input.createdByUserId || null,
      origin: input.origin || 'AI_GENERATED',
      keyStrengths: input.keyStrengths,
      keyWeaknesses: input.keyWeaknesses,
      recommendedImprovements: input.recommendedImprovements,
      opportunityNotes: input.opportunityNotes || null,
      sources: input.sources ? JSON.stringify(input.sources) : null,
      jobRunId: input.jobRunId || null,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(audits).values(newAudit);

    // Log Activity
    await new LoggingService(this.db).log({
leadId: input.leadId,
      type: 'Audit generated',
      summary: `Website audit completed.`,
      
});

    // Re-score the lead
    await this.scoringService.recalculateScore(input.leadId, input.jobRunId, input.createdByUserId);

    // Advance pipeline if audit is now the latest milestone
    const leadService = new LeadService(this.db);
    await leadService.advanceStageIfEarlier(input.leadId, 'Researched');

    return newAudit;
  }
}
