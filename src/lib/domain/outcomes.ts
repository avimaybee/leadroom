import type { ExtractedSignal, IcpProfile } from './scoring';

export interface OutcomeEvent {
  prospectId: string;
  outcomeType: string;
  signals: ExtractedSignal[];
}

export interface LearningSuggestion {
  suggestedChange: {
    type: 'increase_weight' | 'decrease_weight' | 'make_negative' | 'remove_disqualifier' | 'add_disqualifier';
    target: string;
    currentValue?: number;
    suggestedValue?: number;
    reason: string;
  };
  supportingEvidence: {
    totalOutcomes: number;
    positiveOutcomes: number;
    negativeOutcomes: number;
    signalAppearanceRate: number;
    sampleProspectIds: string[];
  };
}

export function generateLearningSuggestions(
  workspaceId: string,
  outcomes: OutcomeEvent[],
  currentIcp: IcpProfile,
): Array<{ workspaceId: string; suggestion: LearningSuggestion }> {
  const suggestions: Array<{ workspaceId: string; suggestion: LearningSuggestion }> = [];

  if (outcomes.length < 3) return suggestions;

  const positiveOutcomes = outcomes.filter((o) =>
    ['REPLIED', 'MEETING_BOOKED', 'WON'].includes(o.outcomeType),
  );
  const negativeOutcomes = outcomes.filter((o) =>
    ['BOUNCED', 'NOT_INTERESTED', 'LOST'].includes(o.outcomeType),
  );

  const totalPositive = positiveOutcomes.length;
  const totalNegative = negativeOutcomes.length;
  const positiveSet = new Set(positiveOutcomes);
  const negativeSet = new Set(negativeOutcomes);

  const signalPositiveCount = new Map<string, number>();
  const signalNegativeCount = new Map<string, number>();
  const signalProspectIds = new Map<string, string[]>();

  for (const outcome of outcomes) {
    const isPositive = positiveSet.has(outcome);
    const isNegative = negativeSet.has(outcome);
    const seen = new Set<string>();
    for (const signal of outcome.signals) {
      const key = signal.matchedIcpRule;
      if (seen.has(key)) continue;
      seen.add(key);

      if (isPositive) {
        signalPositiveCount.set(key, (signalPositiveCount.get(key) || 0) + 1);
      }
      if (isNegative) {
        signalNegativeCount.set(key, (signalNegativeCount.get(key) || 0) + 1);
      }

      const ids = signalProspectIds.get(key) || [];
      if (!ids.includes(outcome.prospectId)) {
        ids.push(outcome.prospectId);
      }
      signalProspectIds.set(key, ids);
    }
  }

  for (const pos of currentIcp.positiveSignals) {
    const matchCount = signalPositiveCount.get(pos.name) || 0;
    const mismatchCount = signalNegativeCount.get(pos.name) || 0;
    const totalAppearances = matchCount + mismatchCount;

    if (totalPositive >= 3 && totalAppearances >= 3) {
      const positiveRate = matchCount / totalAppearances;

      if (positiveRate >= 0.8 && pos.weight < 5) {
        suggestions.push({
          workspaceId,
          suggestion: {
            suggestedChange: {
              type: 'increase_weight',
              target: pos.name,
              currentValue: pos.weight,
              suggestedValue: Math.min(10, pos.weight + 2),
              reason: `Signal "${pos.name}" appears in ${Math.round(positiveRate * 100)}% of positive outcomes. Consider increasing weight to improve scoring accuracy.`,
            },
            supportingEvidence: {
              totalOutcomes: outcomes.length,
              positiveOutcomes: totalPositive,
              negativeOutcomes: totalNegative,
              signalAppearanceRate: Math.round(positiveRate * 100),
              sampleProspectIds: (signalProspectIds.get(pos.name) || []).slice(0, 5),
            },
          },
        });
      }
    }

    if (totalNegative >= 2 && totalAppearances >= 2) {
      const negativeRate = mismatchCount / totalAppearances;

      if (negativeRate >= 0.8 && pos.weight > 0) {
        suggestions.push({
          workspaceId,
          suggestion: {
            suggestedChange: {
              type: 'decrease_weight',
              target: pos.name,
              currentValue: pos.weight,
              suggestedValue: Math.max(0, pos.weight - 2),
              reason: `Signal "${pos.name}" appears in ${Math.round(negativeRate * 100)}% of negative outcomes. Consider decreasing weight.`,
            },
            supportingEvidence: {
              totalOutcomes: outcomes.length,
              positiveOutcomes: totalPositive,
              negativeOutcomes: totalNegative,
              signalAppearanceRate: Math.round(negativeRate * 100),
              sampleProspectIds: (signalProspectIds.get(pos.name) || []).slice(0, 5),
            },
          },
        });
      }

      if (negativeRate >= 0.8) {
        suggestions.push({
          workspaceId,
          suggestion: {
            suggestedChange: {
              type: 'make_negative',
              target: pos.name,
              currentValue: pos.weight,
              reason: `Signal "${pos.name}" correlates with negative outcomes ${Math.round(negativeRate * 100)}% of the time. Consider converting to a negative signal.`,
            },
            supportingEvidence: {
              totalOutcomes: outcomes.length,
              positiveOutcomes: totalPositive,
              negativeOutcomes: totalNegative,
              signalAppearanceRate: Math.round(negativeRate * 100),
              sampleProspectIds: (signalProspectIds.get(pos.name) || []).slice(0, 5),
            },
          },
        });
      }
    }
  }

  for (const disqualifier of currentIcp.disqualifiers) {
    const matchCount = signalPositiveCount.get(disqualifier) || 0;
    const neverInPositive =
      totalPositive >= 3 && matchCount === 0;

    if (neverInPositive) {
      suggestions.push({
        workspaceId,
        suggestion: {
          suggestedChange: {
            type: 'remove_disqualifier',
            target: disqualifier,
            reason: `Disqualifier "${disqualifier}" never fired in ${totalPositive} positive outcomes. Consider removing it.`,
          },
          supportingEvidence: {
            totalOutcomes: outcomes.length,
            positiveOutcomes: totalPositive,
            negativeOutcomes: totalNegative,
            signalAppearanceRate: 0,
            sampleProspectIds: [],
          },
        },
      });
    }
  }

  return suggestions;
}
