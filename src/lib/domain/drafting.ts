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

const STRENGTH_LABEL: Record<ExtractedSignal['matchStrength'], string> = {
  strong: 'strong evidence',
  partial: 'partial evidence',
  weak: 'limited evidence',
};

export function pickBestContact(contacts: Contact[]): Contact | null {
  if (contacts.length === 0) return null;
  const rolePriority = ['ceo', 'founder', 'president', 'director', 'vp', 'head', 'manager'];
  const scored = contacts.map((c) => {
    const title = (c.roleTitle || '').toLowerCase();
    let score = 0;
    for (const [i, keyword] of rolePriority.entries()) {
      if (title.includes(keyword)) score = rolePriority.length - i;
    }
    return { contact: c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  return scored[0].contact;
}

export function buildSubjectLine(
  companyName: string,
  contactName: string | null,
  signals: ExtractedSignal[],
  targetPain: string,
): { subjectLine: string; evidence: CitedEvidence | null } {
  const strongSignals = signals.filter((s) => s.matchStrength === 'strong');
  if (strongSignals.length > 0) {
    const signal = strongSignals[0];
    return {
      subjectLine: `Saw ${companyName}'s approach to ${signal.signalName.toLowerCase().replace(/_/g, ' ')}`,
      evidence: {
        sentence: `Saw ${companyName}'s approach to ${signal.signalName.toLowerCase().replace(/_/g, ' ')}`,
        evidenceQuote: signal.evidenceQuote,
        sourceUrl: signal.sourceUrl,
      },
    };
  }
  const greeting = contactName ? `Quick question for you, ${contactName.split(' ')[0]}` : `Quick question`;
  return {
    subjectLine: `${greeting} — ${targetPain}`,
    evidence: null,
  };
}

export function generateDraft(input: DraftInput): DraftOutput {
  const { offer, prospect } = input;
  const { companyName, signals, contacts } = prospect;
  const { targetPain, desiredOutcome, proofPoints } = offer;

  const contact = pickBestContact(contacts);
  const contactName = contact?.fullName || null;

  const { subjectLine, evidence: subjectEvidence } = buildSubjectLine(companyName, contactName, signals, targetPain);

  const citedEvidence: CitedEvidence[] = [];
  const riskFlags: string[] = [];
  const bodyParts: string[] = [];

  if (subjectEvidence) {
    citedEvidence.push(subjectEvidence);
  }

  const greeting = contactName ? `Hi ${contactName.split(' ')[0]},` : `Hi there,`;
  bodyParts.push(greeting);

  const strongSignals: typeof signals = [];
  const partialSignals: typeof signals = [];
  const weakSignals: typeof signals = [];
  for (const s of signals) {
    if (s.matchStrength === 'strong') strongSignals.push(s);
    else if (s.matchStrength === 'partial') partialSignals.push(s);
    else if (s.matchStrength === 'weak') weakSignals.push(s);
  }

  // Opening — reference a strong signal about the company
  if (strongSignals.length > 0) {
    const s = strongSignals[0];
    const sentence = `I was looking at ${companyName} and noticed ${s.evidenceQuote.toLowerCase()}`;
    bodyParts.push(sentence);
    citedEvidence.push({
      sentence,
      evidenceQuote: s.evidenceQuote,
      sourceUrl: s.sourceUrl,
    });
  } else if (partialSignals.length > 0) {
    const s = partialSignals[0];
    const sentence = `I came across ${companyName} and it looks like ${s.evidenceQuote.toLowerCase()}`;
    bodyParts.push(sentence);
    citedEvidence.push({
      sentence,
      evidenceQuote: s.evidenceQuote,
      sourceUrl: s.sourceUrl,
    });
    riskFlags.push(`Opening claim uses partial evidence from ${s.sourceUrl}`);
  } else {
    const sentence = `I've been looking at ${companyName} and think there might be a fit.`;
    bodyParts.push(sentence);
    riskFlags.push('Opening claim has no direct evidence from prospect signals');
  }

  // Pain paragraph — reference remaining signals
  if (strongSignals.length > 1 || partialSignals.length > 0) {
    const allRelevant = [...strongSignals.slice(1), ...partialSignals];
    const painItems = allRelevant.slice(0, 2);
    for (const signal of painItems) {
      const sentence = `Many teams dealing with ${targetPain.toLowerCase()} find that ${signal.evidenceQuote.toLowerCase()}`;
      bodyParts.push(sentence);
      citedEvidence.push({
        sentence,
        evidenceQuote: signal.evidenceQuote,
        sourceUrl: signal.sourceUrl,
      });
    }
  } else if (signals.length > 0) {
    const s = signals[0];
    const sentence = `Many companies like ${companyName} dealing with ${targetPain.toLowerCase()} benefit from better solutions.`;
    bodyParts.push(sentence);
    if (s.matchStrength !== 'strong') {
      riskFlags.push(`Pain point inferred without strong evidence from ${companyName}`);
    }
  }

  // Value proposition
  const valueSentence = `We help teams move from ${targetPain.toLowerCase()} to ${desiredOutcome.toLowerCase()}.`;
  bodyParts.push(valueSentence);
  if (proofPoints.length > 0) {
    const pp = proofPoints[0];
    const proofSentence = `For example, ${pp}`;
    bodyParts.push(proofSentence);
    citedEvidence.push({
      sentence: proofSentence,
      evidenceQuote: pp,
      sourceUrl: '',
    });
  }

  // Call to action
  const ctaSentence = contactName
    ? `Would you be open to a brief chat this week about ${companyName}'s priorities?`
    : `Would you be open to a brief chat this week?`;
  bodyParts.push(ctaSentence);

  const body = bodyParts.join('\n\n');

  // Check for forbidden claims
  const forbiddenFlags = checkForbiddenClaims(
    { subjectLine, body, citedEvidence, riskFlags: [], confidence: 0 },
    offer.forbiddenClaims,
  );
  riskFlags.push(...forbiddenFlags);

  // Compute confidence
  const signalRatio = signals.length / Math.max(1, signals.length + 1);
  const strongRatio = strongSignals.length / Math.max(1, signals.length);
  const hasEvidence = citedEvidence.filter((e) => e.sourceUrl).length;
  const evidenceRatio = citedEvidence.length > 0 ? hasEvidence / citedEvidence.length : 0;
  const confidence = Math.round(
    signalRatio * 30 + strongRatio * 30 + evidenceRatio * 40,
  );

  return {
    subjectLine,
    body,
    citedEvidence,
    riskFlags,
    confidence,
  };
}

export function checkForbiddenClaims(draft: DraftOutput, forbiddenClaims: string[]): string[] {
  const flags: string[] = [];
  const bodyLower = draft.body.toLowerCase();
  const subjectLower = draft.subjectLine.toLowerCase();
  for (const claim of forbiddenClaims) {
    const claimLower = claim.toLowerCase();
    if (bodyLower.includes(claimLower) || subjectLower.includes(claimLower)) {
      flags.push(`Forbidden claim detected: "${claim}"`);
    }
  }
  return flags;
}
