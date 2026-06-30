import { test } from 'node:test';
import assert from 'node:assert';
import { calculateScore, generateFitReasoning } from '../scoring';
import type { ScoringInput } from '../scoring';

function makeInput(overrides?: Partial<ScoringInput>): ScoringInput {
  return {
    icpProfile: {
      positiveSignals: [
        { name: 'Has Website', weight: 30, description: 'Company has a website' },
        { name: 'B2B SaaS', weight: 25, description: 'Is a B2B SaaS company' },
        { name: 'Tech Team', weight: 15, description: 'Has an in-house tech team' },
      ],
      negativeSignals: [
        { name: 'No Engineering', weight: 20, description: 'No engineering team' },
      ],
      disqualifiers: ['Competitor', 'Agency'],
    },
    extractedSignals: [],
    researchConfidence: 80,
    ...overrides,
  };
}

test('generateFitReasoning', async (t) => {
  await t.test('disqualified prospect', () => {
    const input = makeInput({
      extractedSignals: [
        {
          signalName: 'Competitor',
          matchedIcpRule: 'Competitor',
          matchStrength: 'strong',
          evidenceQuote: 'Direct competitor in same space',
          sourceUrl: 'https://example.com',
        },
      ],
    });
    const output = calculateScore(input);
    assert.strictEqual(output.priorityTier, 'disqualified');
    assert.strictEqual(output.fitReasoning, 'Disqualified: Competitor');
  });

  await t.test('tier1 — strong fit', () => {
    const input = makeInput({
      extractedSignals: [
        {
          signalName: 'Has Website',
          matchedIcpRule: 'Has Website',
          matchStrength: 'strong',
          evidenceQuote: 'Company website found',
          sourceUrl: 'https://example.com',
        },
        {
          signalName: 'B2B SaaS',
          matchedIcpRule: 'B2B SaaS',
          matchStrength: 'strong',
          evidenceQuote: 'Sells SaaS product',
          sourceUrl: 'https://example.com/about',
        },
        {
          signalName: 'Tech Team',
          matchedIcpRule: 'Tech Team',
          matchStrength: 'strong',
          evidenceQuote: 'Has engineering team',
          sourceUrl: 'https://example.com/team',
        },
      ],
    });
    const output = calculateScore(input);
    assert.strictEqual(output.priorityTier, 'tier1');
    assert.match(output.fitReasoning, /Strong fit/);
    assert.match(output.fitReasoning, /3 positive signals/);
    assert.match(output.fitReasoning, /Has Website/);
  });

  await t.test('tier2 — moderate fit with concerns', () => {
    const input = makeInput({
      extractedSignals: [
        {
          signalName: 'Has Website',
          matchedIcpRule: 'Has Website',
          matchStrength: 'strong',
          evidenceQuote: 'Company website found',
          sourceUrl: 'https://example.com',
        },
        {
          signalName: 'B2B SaaS',
          matchedIcpRule: 'B2B SaaS',
          matchStrength: 'strong',
          evidenceQuote: 'Sells SaaS product',
          sourceUrl: 'https://example.com/about',
        },
        {
          signalName: 'No Engineering',
          matchedIcpRule: 'No Engineering',
          matchStrength: 'weak',
          evidenceQuote: 'Small team',
          sourceUrl: 'https://example.com/team',
        },
      ],
    });
    const output = calculateScore(input);
    assert.strictEqual(output.priorityTier, 'tier2');
    assert.match(output.fitReasoning, /Moderate fit/);
    assert.match(output.fitReasoning, /1 concern/);
  });

  await t.test('tier3 — low fit', () => {
    const input = makeInput({
      extractedSignals: [
        {
          signalName: 'Has Website',
          matchedIcpRule: 'Has Website',
          matchStrength: 'weak',
          evidenceQuote: 'Minimal website',
          sourceUrl: 'https://example.com',
        },
      ],
    });
    const output = calculateScore(input);
    assert.strictEqual(output.priorityTier, 'tier3');
    assert.match(output.fitReasoning, /Low fit/);
    assert.match(output.fitReasoning, /only 1 of 3/);
  });

  await t.test('no matched signals — insufficient data', () => {
    const input = makeInput({ extractedSignals: [] });
    const output = calculateScore(input);
    assert.strictEqual(output.priorityTier, 'tier3');
    assert.strictEqual(output.fitReasoning, 'Insufficient data to determine fit');
  });
});

test('calculateScore includes fitReasoning in output', async (t) => {
  await t.test('disqualified output has fitReasoning', () => {
    const input = makeInput({
      extractedSignals: [
        {
          signalName: 'Agency',
          matchedIcpRule: 'Agency',
          matchStrength: 'strong',
          evidenceQuote: 'Is a design agency',
          sourceUrl: 'https://example.com',
        },
      ],
    });
    const output = calculateScore(input);
    assert.ok(output.fitReasoning);
    assert.strictEqual(typeof output.fitReasoning, 'string');
  });

  await t.test('scored output has fitReasoning', () => {
    const input = makeInput({
      extractedSignals: [
        {
          signalName: 'Has Website',
          matchedIcpRule: 'Has Website',
          matchStrength: 'strong',
          evidenceQuote: 'Website found',
          sourceUrl: 'https://example.com',
        },
      ],
    });
    const output = calculateScore(input);
    assert.ok(output.fitReasoning);
    assert.strictEqual(typeof output.fitReasoning, 'string');
  });
});
