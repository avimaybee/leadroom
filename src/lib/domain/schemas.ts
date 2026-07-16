import { z } from 'zod';

// TODO(21.10): Prefer direct imports from this file for tree-shaking (e.g. `import { PainSignalSchema } from './schemas'`)
// instead of barrel re-exports from a parent index.ts.

export const PainSignalSchema = z.object({
  signal: z.string().min(1),
  evidenceQuote: z.string().min(1),
  sourceUrl: z.string().url(),
});

export const WebsiteAnalysisSchema = z.object({
  companyName: z.string().min(1),
  websiteSummary: z.string().min(1).max(500),
  productsServices: z.array(z.string().min(1)).min(1),
  targetAudience: z.string().min(1),
  painSignalsFound: z.array(PainSignalSchema),
  confidence: z.number().int().min(0).max(100),
});

export const SignalMatchSchema = z.object({
  signalName: z.string().min(1),
  evidenceQuote: z.string().min(1),
  sourceUrl: z.string().url(),
  matchStrength: z.enum(['strong', 'partial', 'weak']),
});

export const ICPFitSchema = z.object({
  matchedPositiveSignals: z.array(SignalMatchSchema),
  matchedNegativeSignals: z.array(SignalMatchSchema),
  disqualifiersTriggered: z.array(z.string()),
  overallAssessment: z.string().min(1).max(1000),
  confidence: z.number().int().min(0).max(100),
});

export const DisqualifierSchema = z.object({
  disqualified: z.boolean(),
  reason: z.string().nullable(),
  triggeredRules: z.array(z.string()),
  evidenceQuote: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
  confidence: z.number().int().min(0).max(100),
});

export const DraftOutputSchema = z.object({
  subjectLine: z.string().min(1),
  body: z.string().min(1),
  citedEvidence: z.array(z.object({
    sentence: z.string().min(1),
    evidenceQuote: z.string().min(1),
    sourceUrl: z.string().url(),
  })).min(1),
  riskFlags: z.array(z.string()),
  confidence: z.number().int().min(0).max(100),
});

export const OutcomeSchema = z.object({
  prospectId: z.string().min(1),
  outreachDraftId: z.string().nullable(),
  outcomeType: z.enum(['REPLIED', 'MEETING_BOOKED', 'BOUNCED', 'NOT_INTERESTED', 'WON', 'LOST']),
  notes: z.string().nullable(),
  loggedByUserId: z.string().nullable(),
});

export type WebsiteAnalysis = z.infer<typeof WebsiteAnalysisSchema>;
export type ICPFit = z.infer<typeof ICPFitSchema>;
export type DisqualifierResult = z.infer<typeof DisqualifierSchema>;
export type PainSignal = z.infer<typeof PainSignalSchema>;
export type SignalMatch = z.infer<typeof SignalMatchSchema>;
export type DraftOutput = z.infer<typeof DraftOutputSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
