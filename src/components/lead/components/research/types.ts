export interface ResearchSnapshot {
  id: string;
  leadId: string;
  origin: string;
  snapshotTitle: string | null;
  companySummary: string | null;
  productsServicesSummary: string | null;
  digitalPresenceNotes: string | null;
  websiteNotes: string | null;
  brandingNotes: string | null;
  painPointsHypotheses: string | null;
  opportunityHypotheses: string | null;
  sources: string | null; // JSON stringified array
  confidenceLevel: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}
