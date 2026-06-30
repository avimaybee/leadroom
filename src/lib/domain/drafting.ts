import type { ExtractedSignal } from './scoring';

export interface Contact {
  fullName: string;
  roleTitle: string | null;
  email: string | null;
}

export interface DraftInput {
  offer: {
    name: string;
    targetPain: string;
    desiredOutcome: string;
    proofPoints: string[];
    forbiddenClaims: string[];
  };
  prospect: {
    companyName: string;
    domain: string;
    signals: ExtractedSignal[];
    contacts: Contact[];
  };
}

export interface CitedEvidence {
  sentence: string;
  evidenceQuote: string;
  sourceUrl: string;
}

export interface DraftOutput {
  subjectLine: string;
  body: string;
  citedEvidence: CitedEvidence[];
  riskFlags: string[];
  confidence: number;
}

export function checkForbiddenClaims(draft: DraftOutput, forbiddenClaims: string[]): string[] {
  const flags: string[] = [];
  for (const claim of forbiddenClaims) {
    if (draft.body.toLowerCase().includes(claim.toLowerCase()) ||
        draft.subjectLine.toLowerCase().includes(claim.toLowerCase())) {
      flags.push(`Forbidden claim detected: "${claim}"`);
    }
  }
  return flags;
}
