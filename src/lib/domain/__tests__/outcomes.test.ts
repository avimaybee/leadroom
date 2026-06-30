import { test } from 'node:test';
import assert from 'node:assert';
import { generateLearningSuggestions } from '../outcomes';
import type { OutcomeEvent } from '../outcomes';
import type { IcpProfile, ExtractedSignal } from '../scoring';

function makeIcp(overrides?: Partial<IcpProfile>): IcpProfile {
  return {
    positiveSignals: [
      { name: 'B2B SaaS', weight: 25, description: 'Is a B2B SaaS company' },
      { name: 'Has Website', weight: 20, description: 'Company has a website' },
      { name: 'Tech Team', weight: 15, description: 'Has an in-house tech team' },
    ],
    negativeSignals: [
      { name: 'No Engineering', weight: 20, description: 'No engineering team' },
    ],
    disqualifiers: ['Competitor', 'Agency'],
    ...overrides,
  };
}

function makeSignal(matchedIcpRule: string): ExtractedSignal {
  return {
    signalName: matchedIcpRule,
    matchedIcpRule,
    matchStrength: 'strong',
    evidenceQuote: `Found ${matchedIcpRule}`,
    sourceUrl: 'https://example.com',
  };
}

function makeOutcome(prospectId: string, outcomeType: string, signals: ExtractedSignal[] = []): OutcomeEvent {
  return { prospectId, outcomeType, signals };
}

test('generateLearningSuggestions', async (t) => {
  await t.test('returns empty when fewer than 3 outcomes', () => {
    const outcomes = [
      makeOutcome('p1', 'REPLIED', [makeSignal('B2B SaaS')]),
      makeOutcome('p2', 'NOT_INTERESTED', [makeSignal('B2B SaaS')]),
    ];
    const result = generateLearningSuggestions('ws-1', outcomes, makeIcp());
    assert.strictEqual(result.length, 0);
  });

  await t.test('suggests increase_weight when signal correlates with positive outcomes', () => {
    const icp = makeIcp({ positiveSignals: [{ name: 'B2B SaaS', weight: 3, description: 'Is a B2B SaaS company' }] });
    const signalA = makeSignal('B2B SaaS');
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 5; i++) {
      outcomes.push(makeOutcome(`p${i}`, 'REPLIED', [signalA]));
    }
    const result = generateLearningSuggestions('ws-1', outcomes, icp);
    const incSuggestions = result.filter((r) => r.suggestion.suggestedChange.type === 'increase_weight');
    assert.ok(incSuggestions.length > 0);
    const b2bInc = incSuggestions.find((r) => r.suggestion.suggestedChange.target === 'B2B SaaS');
    assert.ok(b2bInc);
    assert.strictEqual(b2bInc.suggestion.suggestedChange.currentValue, 3);
    assert.strictEqual(b2bInc.suggestion.suggestedChange.suggestedValue, 5);
  });

  await t.test('does not increase_weight if weight is already at max', () => {
    const icp = makeIcp({ positiveSignals: [{ name: 'B2B SaaS', weight: 10, description: 'Test' }] });
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 5; i++) {
      outcomes.push(makeOutcome(`p${i}`, 'REPLIED', [makeSignal('B2B SaaS')]));
    }
    const result = generateLearningSuggestions('ws-1', outcomes, icp);
    const incSuggestions = result.filter((r) => r.suggestion.suggestedChange.type === 'increase_weight');
    assert.strictEqual(incSuggestions.length, 0);
  });

  await t.test('suggests decrease_weight when signal correlates with negative outcomes', () => {
    const signalA = makeSignal('B2B SaaS');
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(makeOutcome(`p${i}`, 'NOT_INTERESTED', [signalA]));
    }
    const result = generateLearningSuggestions('ws-1', outcomes, makeIcp());
    const dec = result.filter((r) => r.suggestion.suggestedChange.type === 'decrease_weight');
    assert.ok(dec.length > 0);
  });

  await t.test('suggests make_negative when signal strongly correlates with negative outcomes', () => {
    const signalA = makeSignal('B2B SaaS');
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(makeOutcome(`p${i}`, 'NOT_INTERESTED', [signalA]));
    }
    const result = generateLearningSuggestions('ws-1', outcomes, makeIcp());
    const makeNeg = result.filter((r) => r.suggestion.suggestedChange.type === 'make_negative');
    assert.ok(makeNeg.length > 0);
  });

  await t.test('suggests remove_disqualifier when disqualifier never fires in positive outcomes', () => {
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(makeOutcome(`p${i}`, 'REPLIED', [makeSignal('B2B SaaS')]));
    }
    const result = generateLearningSuggestions('ws-1', outcomes, makeIcp({ disqualifiers: ['Competitor', 'Agency'] }));
    const removeAction = result.filter((r) => r.suggestion.suggestedChange.type === 'remove_disqualifier');
    assert.ok(removeAction.length > 0);
    removeAction.forEach((r) => {
      assert.ok(['Competitor', 'Agency'].includes(r.suggestion.suggestedChange.target));
    });
  });

  await t.test('suggestion carries workspaceId', () => {
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(makeOutcome(`p${i}`, 'REPLIED', [makeSignal('B2B SaaS')]));
    }
    const result = generateLearningSuggestions('ws-42', outcomes, makeIcp());
    result.forEach((r) => assert.strictEqual(r.workspaceId, 'ws-42'));
  });

  await t.test('supportingEvidence includes sample prospect IDs', () => {
    const icp = makeIcp({ positiveSignals: [{ name: 'B2B SaaS', weight: 3, description: 'Is a B2B SaaS company' }] });
    const signal = makeSignal('B2B SaaS');
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 5; i++) {
      outcomes.push(makeOutcome(`sample-prospect-${i}`, 'REPLIED', [signal]));
    }
    const result = generateLearningSuggestions('ws-1', outcomes, icp);
    const inc = result.filter((r) => r.suggestion.suggestedChange.type === 'increase_weight');
    assert.ok(inc.length > 0);
    assert.ok(inc[0].suggestion.supportingEvidence.sampleProspectIds.length > 0);
  });
});
