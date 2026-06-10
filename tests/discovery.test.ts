import { test } from 'node:test';
import assert from 'node:assert';
import { CreateDiscoveryScopeSchema, CreateCandidateLeadSchema } from '../src/db/models/discovery';

test('CreateDiscoveryScopeSchema validates valid inputs', () => {
  const validInput = {
    name: 'Local Bakeries',
    description: 'Targeting local bakeries with poor websites',
    industryFilter: 'Bakery',
    geographyFilter: 'New York',
    createdByUserId: 'user_123',
  };

  const result = CreateDiscoveryScopeSchema.safeParse(validInput);
  assert.strictEqual(result.success, true);
});

test('CreateDiscoveryScopeSchema fails on missing name', () => {
  const invalidInput = {
    description: 'No name provided',
    createdByUserId: 'user_123',
  };

  const result = CreateDiscoveryScopeSchema.safeParse(invalidInput);
  assert.strictEqual(result.success, false);
});

test('CreateCandidateLeadSchema validates valid inputs', () => {
  const validInput = {
    rawName: 'Sweet Treats Bakery',
    rawWebsiteUrl: 'https://sweettreats.com',
    status: 'NEW' as const,
  };

  const result = CreateCandidateLeadSchema.safeParse(validInput);
  assert.strictEqual(result.success, true);
});

test('CreateCandidateLeadSchema fails on invalid website URL', () => {
  const invalidInput = {
    rawName: 'Sweet Treats Bakery',
    rawWebsiteUrl: 'not-a-url',
  };

  const result = CreateCandidateLeadSchema.safeParse(invalidInput);
  assert.strictEqual(result.success, false);
});
