import { test, describe } from 'node:test';
import assert from 'node:assert';
import { calculateScore, applyManualOverride } from '../scoring';
import { generateDraft, checkForbiddenClaims, pickBestContact } from '../drafting';
import { generateLearningSuggestions } from '../outcomes';
import type { ScoringInput, IcpProfile, ExtractedSignal } from '../scoring';
import type { DraftInput } from '../drafting';
import type { OutcomeEvent } from '../outcomes';

// ── Shared test fixtures ──

const TEST_ICP: IcpProfile = {
  positiveSignals: [
    { name: 'Has Website', weight: 30, description: 'Company has a website' },
    { name: 'B2B SaaS', weight: 25, description: 'Is a B2B SaaS company' },
    { name: 'Tech Team', weight: 15, description: 'Has an in-house tech team' },
    { name: 'Recent Funding', weight: 10, description: 'Raised funding recently' },
  ],
  negativeSignals: [
    { name: 'No Engineering', weight: 20, description: 'No visible engineering team' },
    { name: 'Competitor Tool', weight: 15, description: 'Uses competing software' },
  ],
  disqualifiers: ['Enterprise Only', 'Agency', 'Non-Profit'],
};

const TEST_OFFER = {
  name: 'Lead Scoring Pro',
  targetPain: 'manual lead qualification',
  desiredOutcome: 'automated prospect scoring with evidence',
  proofPoints: ['Increased pipeline velocity by 40% for a B2B SaaS client'],
  forbiddenClaims: ['guaranteed results', 'instant', 'magic'],
};

const TEST_SIGNALS: ExtractedSignal[] = [
  {
    signalName: 'Has Website',
    matchedIcpRule: 'Has Website',
    matchStrength: 'strong',
    evidenceQuote: 'Company website at example.com with detailed product pages',
    sourceUrl: 'https://example.com',
  },
  {
    signalName: 'B2B SaaS',
    matchedIcpRule: 'B2B SaaS',
    matchStrength: 'strong',
    evidenceQuote: 'Sells a SaaS analytics platform on monthly subscription',
    sourceUrl: 'https://example.com/pricing',
  },
  {
    signalName: 'Tech Team',
    matchedIcpRule: 'Tech Team',
    matchStrength: 'partial',
    evidenceQuote: 'Hiring for senior backend engineer on LinkedIn',
    sourceUrl: 'https://linkedin.com/company/example/jobs',
  },
];

describe('SDR Pipeline — Scoring', () => {
  test('calculateScore returns correct fit for strong match', () => {
    const input: ScoringInput = {
      icpProfile: TEST_ICP,
      extractedSignals: TEST_SIGNALS,
      researchConfidence: 85,
    };
    const output = calculateScore(input);

    // 30*1.0 + 25*1.0 + 15*0.5 = 62.5, round to 63 (but Math.round is called per contribution)
    // 30 + 25 + 8 = 63
    assert.strictEqual(output.fitScore, 63);
    assert.strictEqual(output.priorityTier, 'tier2');
    assert.strictEqual(output.priorityTier, 'tier2');
    assert.ok(output.fitReasoning.includes('Moderate fit'));
    assert.ok(output.breakdown.length > 0);
    output.breakdown.forEach(b => {
      assert.ok(b.factor);
      assert.ok(b.evidenceQuote);
    });
  });

  test('calculateScore returns tier1 when fitScore >= 70', () => {
    const input: ScoringInput = {
      icpProfile: TEST_ICP,
      extractedSignals: [
        ...TEST_SIGNALS,
        {
          signalName: 'Recent Funding',
          matchedIcpRule: 'Recent Funding',
          matchStrength: 'strong',
          evidenceQuote: 'Announced $5M series A',
          sourceUrl: 'https://example.com/funding',
        },
      ],
      researchConfidence: 90,
    };
    const output = calculateScore(input);
    // 30 + 25 + 8 + 10 = 73
    assert.strictEqual(output.fitScore, 73);
    assert.strictEqual(output.priorityTier, 'tier1');
    assert.ok(output.fitReasoning.includes('Strong fit'));
  });

  test('calculateScore disqualifies when disqualified matchStrength triggers', () => {
    const input: ScoringInput = {
      icpProfile: TEST_ICP,
      extractedSignals: [
        {
          signalName: 'Agency',
          matchedIcpRule: 'Agency',
          matchStrength: 'strong',
          evidenceQuote: 'Describes itself as a creative agency',
          sourceUrl: 'https://example.com/about',
        },
      ],
      researchConfidence: 80,
    };
    const output = calculateScore(input);
    assert.strictEqual(output.fitScore, 0);
    assert.strictEqual(output.priorityTier, 'disqualified');
    assert.ok(output.fitReasoning.includes('Disqualified'));
  });

  test('calculateScore decouples fit from confidence', () => {
    const lowConf = calculateScore({ icpProfile: TEST_ICP, extractedSignals: TEST_SIGNALS, researchConfidence: 20 });
    const highConf = calculateScore({ icpProfile: TEST_ICP, extractedSignals: TEST_SIGNALS, researchConfidence: 95 });
    assert.strictEqual(lowConf.fitScore, highConf.fitScore);
    assert.ok(lowConf.confidenceScore < highConf.confidenceScore);
  });

  test('applyManualOverride sets isOverridden flag and reason', () => {
    const current = calculateScore({ icpProfile: TEST_ICP, extractedSignals: TEST_SIGNALS, researchConfidence: 85 });
    const overridden = applyManualOverride(current, {
      fitScore: 90,
      reason: 'Found strong founder-market fit during call',
      userId: 'user-1',
    });
    assert.strictEqual(overridden.isOverridden, true);
    assert.strictEqual(overridden.overrideReason, 'Found strong founder-market fit during call');
    assert.strictEqual(overridden.overriddenBy, 'user-1');
    assert.strictEqual(overridden.fitScore, 90);
  });

  test('applyManualOverride clamps score to 0-100', () => {
    const current = calculateScore({ icpProfile: TEST_ICP, extractedSignals: TEST_SIGNALS, researchConfidence: 85 });
    const overridden = applyManualOverride(current, {
      fitScore: 150,
      reason: 'Test clamping',
      userId: 'user-1',
    });
    assert.strictEqual(overridden.fitScore, 100);
  });

  test('calculateScore handles empty extractedSignals gracefully', () => {
    const output = calculateScore({
      icpProfile: TEST_ICP,
      extractedSignals: [],
      researchConfidence: 0,
    });
    assert.strictEqual(output.fitScore, 0);
    assert.strictEqual(output.priorityTier, 'tier3');
    assert.strictEqual(output.fitReasoning, 'Insufficient data to determine fit');
  });

  test('calculateScore includes negative signal contributions', () => {
    const input: ScoringInput = {
      icpProfile: TEST_ICP,
      extractedSignals: [
        ...TEST_SIGNALS,
        {
          signalName: 'No Engineering',
          matchedIcpRule: 'No Engineering',
          matchStrength: 'strong',
          evidenceQuote: 'No engineering job postings found',
          sourceUrl: 'https://example.com/careers',
        },
      ],
      researchConfidence: 80,
    };
    const output = calculateScore(input);
    // 30 + 25 + 8 - 20 = 43
    assert.strictEqual(output.fitScore, 43);
    assert.strictEqual(output.priorityTier, 'tier2');
    const negBreakdown = output.breakdown.find(b => b.factor.startsWith('Negative:'));
    assert.ok(negBreakdown);
    assert.ok(negBreakdown!.contribution < 0);
  });
});

describe('SDR Pipeline — Drafting', () => {
  test('generateDraft produces cited evidence for every sentence', () => {
    const input: DraftInput = {
      offer: TEST_OFFER,
      prospect: {
        companyName: 'Acme Corp',
        domain: 'acme.com',
        signals: TEST_SIGNALS,
        contacts: [
          { fullName: 'Jane Smith', roleTitle: 'CEO', email: 'jane@acme.com' },
        ],
      },
    };
    const output = generateDraft(input);
    assert.ok(output.subjectLine);
    assert.ok(output.body);
    assert.ok(output.citedEvidence.length >= 1);
    assert.ok(typeof output.confidence === 'number' && output.confidence >= 0 && output.confidence <= 100);
    output.citedEvidence.forEach(ce => {
      assert.ok(ce.sentence, 'Every cited evidence must have a sentence');
      assert.ok(ce.evidenceQuote, 'Every cited evidence must have a quote');
    });
  });

  test('generateDraft greets the best contact by name', () => {
    const input: DraftInput = {
      offer: TEST_OFFER,
      prospect: {
        companyName: 'Acme Corp',
        domain: 'acme.com',
        signals: TEST_SIGNALS,
        contacts: [
          { fullName: 'Bob Engineer', roleTitle: 'Engineer', email: 'bob@acme.com' },
          { fullName: 'Jane Smith', roleTitle: 'CEO', email: 'jane@acme.com' },
        ],
      },
    };
    const output = generateDraft(input);
    assert.ok(output.body.includes('Hi Jane'), 'Should greet the CEO');
  });

  test('generateDraft greets generically when no contacts', () => {
    const input: DraftInput = {
      offer: TEST_OFFER,
      prospect: {
        companyName: 'Acme Corp',
        domain: 'acme.com',
        signals: TEST_SIGNALS,
        contacts: [],
      },
    };
    const output = generateDraft(input);
    assert.ok(output.body.includes('Hi there'), 'Should greet generically');
  });

  test('generateDraft flags weak evidence as risk', () => {
    const input: DraftInput = {
      offer: TEST_OFFER,
      prospect: {
        companyName: 'Acme Corp',
        domain: 'acme.com',
        signals: [
          {
            signalName: 'Has Website',
            matchedIcpRule: 'Has Website',
            matchStrength: 'weak',
            evidenceQuote: 'Might have a website',
            sourceUrl: 'https://acme.com',
          },
        ],
        contacts: [],
      },
    };
    const output = generateDraft(input);
    assert.ok(output.riskFlags.length > 0, 'Should have risk flags for weak evidence');
  });

  test('checkForbiddenClaims detects forbidden phrases', () => {
    const draft = {
      subjectLine: 'Test',
      body: 'We guarantee guaranteed results with our magic solution',
      citedEvidence: [],
      riskFlags: [],
      confidence: 50,
    };
    const flags = checkForbiddenClaims(draft, ['guaranteed results', 'magic']);
    assert.strictEqual(flags.length, 2);
  });

  test('checkForbiddenClaims returns empty when clean', () => {
    const draft = {
      subjectLine: 'Test',
      body: 'We help teams improve their workflow',
      citedEvidence: [],
      riskFlags: [],
      confidence: 50,
    };
    const flags = checkForbiddenClaims(draft, ['guaranteed results']);
    assert.strictEqual(flags.length, 0);
  });

  test('pickBestContact prefers founder/CEO over other roles', () => {
    const contacts = [
      { fullName: 'Alice', roleTitle: 'Intern', email: 'a@co.com' },
      { fullName: 'Bob', roleTitle: 'Founder', email: 'b@co.com' },
      { fullName: 'Charlie', roleTitle: 'VP Sales', email: 'c@co.com' },
    ];
    assert.strictEqual(pickBestContact(contacts)?.fullName, 'Bob');
  });

  test('pickBestContact returns null for empty list', () => {
    assert.strictEqual(pickBestContact([]), null);
  });
});

describe('SDR Pipeline — Learning Loop', () => {
  function makeSignal(matchedIcpRule: string): ExtractedSignal {
    return {
      signalName: matchedIcpRule,
      matchedIcpRule,
      matchStrength: 'strong' as const,
      evidenceQuote: `Found ${matchedIcpRule}`,
      sourceUrl: 'https://example.com',
    };
  }

  function makeOutcome(prospectId: string, outcomeType: string, signals: ExtractedSignal[] = []): OutcomeEvent {
    return { prospectId, outcomeType, signals };
  }

  test('empty outcomes returns no suggestions', () => {
    const suggestions = generateLearningSuggestions('ws-1', [], TEST_ICP);
    assert.strictEqual(suggestions.length, 0);
  });

  test('fewer than 3 outcomes returns no suggestions', () => {
    const outcomes = [
      makeOutcome('p1', 'REPLIED', [makeSignal('Has Website')]),
      makeOutcome('p2', 'NOT_INTERESTED', [makeSignal('Has Website')]),
    ];
    const suggestions = generateLearningSuggestions('ws-1', outcomes, TEST_ICP);
    assert.strictEqual(suggestions.length, 0);
  });

  test('suggests increase_weight when signal strongly correlates with positive outcomes', () => {
    const icp: IcpProfile = {
      positiveSignals: [{ name: 'Has Website', weight: 3, description: 'Has website' }],
      negativeSignals: [],
      disqualifiers: [],
    };
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 5; i++) {
      outcomes.push(makeOutcome(`p${i}`, 'REPLIED', [makeSignal('Has Website')]));
    }
    const suggestions = generateLearningSuggestions('ws-1', outcomes, icp);
    const inc = suggestions.filter(s => s.suggestion.suggestedChange.type === 'increase_weight');
    assert.ok(inc.length > 0);
    assert.strictEqual(inc[0].suggestion.suggestedChange.target, 'Has Website');
    assert.strictEqual(inc[0].suggestion.suggestedChange.currentValue, 3);
    assert.strictEqual(inc[0].suggestion.suggestedChange.suggestedValue, 5);
  });

  test('suggests decrease_weight when signal correlates with negative outcomes', () => {
    const icp: IcpProfile = {
      positiveSignals: [{ name: 'B2B SaaS', weight: 5, description: 'B2B SaaS' }],
      negativeSignals: [],
      disqualifiers: [],
    };
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(makeOutcome(`p${i}`, 'NOT_INTERESTED', [makeSignal('B2B SaaS')]));
    }
    const suggestions = generateLearningSuggestions('ws-1', outcomes, icp);
    const dec = suggestions.filter(s => s.suggestion.suggestedChange.type === 'decrease_weight');
    assert.ok(dec.length > 0);
  });

  test('suggests remove_disqualifier when never triggered in positive outcomes', () => {
    const icp: IcpProfile = {
      positiveSignals: [{ name: 'B2B SaaS', weight: 5, description: 'B2B SaaS' }],
      negativeSignals: [],
      disqualifiers: ['Enterprise Only', 'Agency'],
    };
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(makeOutcome(`p${i}`, 'REPLIED', [makeSignal('B2B SaaS')]));
    }
    const suggestions = generateLearningSuggestions('ws-1', outcomes, icp);
    const remove = suggestions.filter(s => s.suggestion.suggestedChange.type === 'remove_disqualifier');
    assert.ok(remove.length > 0);
  });

  test('all suggestions carry workspaceId', () => {
    const icp: IcpProfile = {
      positiveSignals: [{ name: 'B2B SaaS', weight: 3, description: 'B2B SaaS' }],
      negativeSignals: [],
      disqualifiers: [],
    };
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 5; i++) {
      outcomes.push(makeOutcome(`p${i}`, 'REPLIED', [makeSignal('B2B SaaS')]));
    }
    const suggestions = generateLearningSuggestions('ws-42', outcomes, icp);
    suggestions.forEach(s => assert.strictEqual(s.workspaceId, 'ws-42'));
  });

  test('supportingEvidence includes sample prospect IDs', () => {
    const icp: IcpProfile = {
      positiveSignals: [{ name: 'B2B SaaS', weight: 3, description: 'B2B SaaS' }],
      negativeSignals: [],
      disqualifiers: [],
    };
    const outcomes: OutcomeEvent[] = [];
    for (let i = 0; i < 5; i++) {
      outcomes.push(makeOutcome(`sample-${i}`, 'REPLIED', [makeSignal('B2B SaaS')]));
    }
    const suggestions = generateLearningSuggestions('ws-1', outcomes, icp);
    const inc = suggestions.filter(s => s.suggestion.suggestedChange.type === 'increase_weight');
    assert.ok(inc.length > 0);
    assert.ok(inc[0].suggestion.supportingEvidence.sampleProspectIds.length > 0);
    assert.ok(inc[0].suggestion.supportingEvidence.sampleProspectIds[0].startsWith('sample-'));
  });
});
