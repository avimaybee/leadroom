export interface IcpSignalDef {
  name: string;
  weight: number;
  description: string;
}

export interface IcpProfile {
  positiveSignals: IcpSignalDef[];
  negativeSignals: IcpSignalDef[];
  disqualifiers: string[];
}

export interface ExtractedSignal {
  signalName: string;
  matchedIcpRule: string;
  matchStrength: 'strong' | 'partial' | 'weak';
  evidenceQuote: string;
  sourceUrl: string;
}

export interface ScoringInput {
  icpProfile: IcpProfile;
  extractedSignals: ExtractedSignal[];
  researchConfidence: number;
}

export interface ScoringBreakdown {
  factor: string;
  contribution: number;
  evidenceQuote: string;
  sourceUrl: string;
}

export interface ScoringOutput {
  fitScore: number;
  confidenceScore: number;
  priorityTier: 'tier1' | 'tier2' | 'tier3' | 'disqualified';
  breakdown: ScoringBreakdown[];
  fitReasoning: string;
}

const STRENGTH_MULTIPLIERS: Record<ExtractedSignal['matchStrength'], number> = {
  strong: 1.0,
  partial: 0.5,
  weak: 0.25,
};

export function calculateScore(input: ScoringInput): ScoringOutput {
  const breakdown: ScoringBreakdown[] = [];

  const allTriggeredDisqualifiers = input.icpProfile.disqualifiers.filter((d) =>
    input.extractedSignals.some((s) => s.matchedIcpRule === d),
  );

  if (allTriggeredDisqualifiers.length > 0) {
    for (const rule of allTriggeredDisqualifiers) {
      const evidence = input.extractedSignals.find((s) => s.matchedIcpRule === rule);
      breakdown.push({
        factor: `Disqualified: ${rule}`,
        contribution: 0,
        evidenceQuote: evidence?.evidenceQuote ?? 'No evidence captured',
        sourceUrl: evidence?.sourceUrl ?? '',
      });
    }
    const output: ScoringOutput = {
      fitScore: 0,
      confidenceScore: input.researchConfidence,
      priorityTier: 'disqualified',
      breakdown,
      fitReasoning: '',
    };
    output.fitReasoning = generateFitReasoning(input, output);
    return output;
  }

  let fitScore = 0;
  const matchedSignals = new Map<string, ExtractedSignal>();
  for (const signal of input.extractedSignals) {
    matchedSignals.set(signal.signalName, signal);
  }

  for (const pos of input.icpProfile.positiveSignals) {
    const match = matchedSignals.get(pos.name);
    if (match) {
      const contribution = Math.round(pos.weight * STRENGTH_MULTIPLIERS[match.matchStrength]);
      fitScore += contribution;
      breakdown.push({
        factor: `Positive: ${pos.name}`,
        contribution,
        evidenceQuote: match.evidenceQuote,
        sourceUrl: match.sourceUrl,
      });
    }
  }

  for (const neg of input.icpProfile.negativeSignals) {
    const match = matchedSignals.get(neg.name);
    if (match) {
      const contribution = -Math.round(neg.weight * STRENGTH_MULTIPLIERS[match.matchStrength]);
      fitScore += contribution;
      breakdown.push({
        factor: `Negative: ${neg.name}`,
        contribution,
        evidenceQuote: match.evidenceQuote,
        sourceUrl: match.sourceUrl,
      });
    }
  }

  fitScore = Math.max(0, Math.min(100, fitScore));

  const totalPossibleSignals =
    input.icpProfile.positiveSignals.length + input.icpProfile.negativeSignals.length;
  const signalsWithEvidence = input.extractedSignals.length;
  const completenessRatio =
    totalPossibleSignals > 0
      ? Math.min(1, signalsWithEvidence / totalPossibleSignals)
      : signalsWithEvidence > 0 ? 1 : 0;

  const confidenceScore = Math.round(
    input.researchConfidence * (0.6 + 0.4 * completenessRatio),
  );

  let priorityTier: ScoringOutput['priorityTier'] = 'tier3';
  if (fitScore >= 70) {
    priorityTier = 'tier1';
  } else if (fitScore >= 40) {
    priorityTier = 'tier2';
  }

  const output: ScoringOutput = { fitScore, confidenceScore, priorityTier, breakdown, fitReasoning: '' };
  output.fitReasoning = generateFitReasoning(input, output);
  return output;
}

export function generateFitReasoning(input: ScoringInput, output: ScoringOutput): string {
  if (output.priorityTier === 'disqualified') {
    const dq = output.breakdown.find(b => b.factor.startsWith('Disqualified:'));
    return `Disqualified: ${dq?.factor.replace('Disqualified: ', '') || 'disqualifier triggered'}`;
  }

  const positiveNames = new Set(input.icpProfile.positiveSignals.map(p => p.name));
  const negativeNames = new Set(input.icpProfile.negativeSignals.map(n => n.name));
  const positiveWeights = new Map(input.icpProfile.positiveSignals.map(p => [p.name, p.weight]));

  const matchedPositive = input.extractedSignals.filter(s => positiveNames.has(s.signalName));
  const matchedNegative = input.extractedSignals.filter(s => negativeNames.has(s.signalName));

  if (matchedPositive.length === 0 && matchedNegative.length === 0) {
    return 'Insufficient data to determine fit';
  }

  const topPositive = matchedPositive
    .map(s => ({ ...s, weight: positiveWeights.get(s.signalName) || 0 }))
    .sort((a, b) => b.weight - a.weight)[0];

  if (output.priorityTier === 'tier1') {
    const top = topPositive?.signalName || matchedPositive[0]?.signalName || 'key signals';
    const plural = matchedPositive.length !== 1 ? 's' : '';
    return `Strong fit: ${matchedPositive.length} positive signal${plural} match, including "${top}"`;
  }

  if (output.priorityTier === 'tier2') {
    const posPlural = matchedPositive.length !== 1 ? 's' : '';
    const negPlural = matchedNegative.length !== 1 ? 's' : '';
    return `Moderate fit: ${matchedPositive.length} positive signal${posPlural} match but ${matchedNegative.length} concern${negPlural} noted`;
  }

  const totalPos = input.icpProfile.positiveSignals.length;
  const plural = totalPos !== 1 ? 's' : '';
  return `Low fit: only ${matchedPositive.length} of ${totalPos} positive signal${plural} matched`;
}

export interface OverrideInput {
  fitScore?: number;
  reason: string;
  userId: string;
}

export interface OverrideResult extends ScoringOutput {
  isOverridden: boolean;
  overrideReason: string;
  overriddenBy: string;
}

export function applyManualOverride(
  currentScore: ScoringOutput,
  override: OverrideInput,
): OverrideResult {
  const clamped = Math.max(0, Math.min(100, override.fitScore ?? currentScore.fitScore));
  return {
    fitScore: clamped,
    confidenceScore: currentScore.confidenceScore,
    priorityTier: clamped >= 70 ? 'tier1' : clamped >= 40 ? 'tier2' : 'tier3',
    breakdown: [
      {
        factor: `Manual override by ${override.userId}`,
        contribution: clamped,
        evidenceQuote: override.reason,
        sourceUrl: '',
      },
    ],
    fitReasoning: `Score manually overridden to ${clamped}: ${override.reason}`,
    isOverridden: true,
    overrideReason: override.reason,
    overriddenBy: override.userId,
  };
}
