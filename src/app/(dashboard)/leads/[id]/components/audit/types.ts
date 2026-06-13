export interface AuditSnapshot {
  id: string;
  leadId: string;
  createdByUserId: string | null;
  origin: string;
  websiteQualityScore: number | null;
  designAestheticScore: number | null;
  messagingClarityScore: number | null;
  socialPresenceScore: number | null;
  overallBrandingScore: number | null;
  keyStrengths: string | null;
  keyWeaknesses: string | null;
  recommendedImprovements: string | null;
  opportunityNotes: string | null;
  sources: string | null; // JSON stringified array
  jobRunId: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}

export interface LeadScore {
  id: string;
  leadId: string;
  scoreValue: number;
  scoreLabel: string | null;
  rationaleSummary: string | null;
  factors: string | null; // JSON stringified array
  origin: string;
  isCurrent: number;
  createdByUserId: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}
