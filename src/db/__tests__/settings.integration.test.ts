import { test } from 'node:test';
import assert from 'node:assert';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { providerConfigs, users } from '../schema/core';

// Ensure test environment
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
(process.env as any).NODE_ENV = 'test';


import { saveIntegrationConfigAction, setActiveProviderForTaskAction, testIntegrationConnectionAction } from '../../app/(dashboard)/settings/integrations/actions';
import { MockD1Database } from '@/db/local-mock';

import { setupTestDb as initTestDb } from './test-helpers';

function setupTestDb() {
  const { sqlite } = initTestDb();
  const mockD1 = new MockD1Database(sqlite);
  return { mockD1, sqlite };
}

test('AI Provider Config & Task Routing Integration', async (t) => {
  const { mockD1, sqlite } = setupTestDb();
  
  // Set the DB mock
  process.env = {
    ...process.env,
    DB: mockD1 as any,
  };

  const db = drizzle(sqlite);

  // Create user_123 to satisfy foreign key constraint on providerConfigs
  await db.insert(users).values({
    id: 'user_123',
    name: 'Test User',
    email: 'test@example.com',
    password: 'test-password-hash',
  });

  // Mock global fetch for API key validations
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any) => {
    const urlStr = url.toString();
    if (urlStr.includes('generativelanguage.googleapis.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            { name: 'models/gemini-2.5-flash' },
            { name: 'models/gemini-2.5-pro' }
          ]
        })
      } as any;
    }
    if (urlStr.includes('integrate.api.nvidia.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'meta/llama-3.1-70b-instruct' }
          ]
        })
      } as any;
    }
    if (urlStr.includes('api.aimlapi.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' },
            { id: 'meta-llama/Llama-3-8b-chat' }
          ]
        })
      } as any;
    }
    // Mock chat completions for test connection
    if (urlStr.includes('api.openai.com/v1/chat/completions')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'OK' } }] }),
      } as any;
    }
    if (urlStr.includes('generativelanguage.googleapis.com/v1beta/models/') && urlStr.includes(':generateContent')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }),
      } as any;
    }
    return { ok: true, status: 200, json: async () => ({}) } as any;
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (ORIGINAL_NODE_ENV === undefined) {
      delete (process.env as any).NODE_ENV;
    } else {
      (process.env as any).NODE_ENV = ORIGINAL_NODE_ENV;
    }
  });

  await t.test('saveIntegrationConfigAction saves provider config without routing flags', async () => {
    const geminiFormData = new FormData();
    geminiFormData.append('provider', 'gemini');
    geminiFormData.append('apiKey', 'mock-gemini-key');
    geminiFormData.append('modelName', 'gemini-2.5-flash');

    const res1 = await saveIntegrationConfigAction(geminiFormData);
    assert.strictEqual(res1.success, true);

    const configs1 = await db.select().from(providerConfigs);
    assert.strictEqual(configs1.length, 1);
    assert.strictEqual(configs1[0].provider, 'gemini');

    // Should default to false for all routing flags
    assert.strictEqual(configs1[0].isResearchActive, false);
    assert.strictEqual(configs1[0].isScoringActive, false);
    assert.strictEqual(configs1[0].isDraftingActive, false);
  });

  await t.test('setActiveProviderForTaskAction sets task routing mutually exclusively', async () => {
    // 1. Save Nvidia config
    const nvidiaFormData = new FormData();
    nvidiaFormData.append('provider', 'nvidia');
    nvidiaFormData.append('apiKey', 'mock-nvidia-key');
    nvidiaFormData.append('modelName', 'meta/llama-3.1-70b-instruct');
    await saveIntegrationConfigAction(nvidiaFormData);

    // 2. Route research to Gemini
    const res1 = await setActiveProviderForTaskAction('gemini', 'research');
    assert.strictEqual(res1.success, true);

    const geminiRow = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'gemini')).limit(1);
    const nvidiaRow = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'nvidia')).limit(1);

    assert.strictEqual(geminiRow[0].isResearchActive, true);
    assert.strictEqual(nvidiaRow[0].isResearchActive, false);

    // 3. Route research to Nvidia - should deactivate Gemini for research
    const res2 = await setActiveProviderForTaskAction('nvidia', 'research');
    assert.strictEqual(res2.success, true);

    const geminiRow2 = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'gemini')).limit(1);
    const nvidiaRow2 = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'nvidia')).limit(1);

    assert.strictEqual(geminiRow2[0].isResearchActive, false);
    assert.strictEqual(nvidiaRow2[0].isResearchActive, true);

    // 4. Route scoring and drafting to Gemini (different task types can have different providers)
    const res3 = await setActiveProviderForTaskAction('gemini', 'scoring');
    assert.strictEqual(res3.success, true);
    const res4 = await setActiveProviderForTaskAction('gemini', 'drafting');
    assert.strictEqual(res4.success, true);

    const geminiFinal = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'gemini')).limit(1);
    assert.strictEqual(geminiFinal[0].isResearchActive, false);
    assert.strictEqual(geminiFinal[0].isScoringActive, true);
    assert.strictEqual(geminiFinal[0].isDraftingActive, true);
  });

  await t.test('setActiveProviderForTaskAction fails when target provider is not configured', async () => {
    const res = await setActiveProviderForTaskAction('groq', 'research');
    assert.ok(res.error);
    assert.ok(res.error.includes('no saved configuration'));
  });

  await t.test('testIntegrationConnectionAction works with mocked API', async () => {
    const res = await testIntegrationConnectionAction('openai', 'sk-test-key', 'gpt-4o-mini');
    assert.strictEqual(res.success, true);
  });

  await t.test('testIntegrationConnectionAction fails with unsupported provider', async () => {
    const res = await testIntegrationConnectionAction('unknown', 'key', 'model');
    assert.ok(res.error);
    assert.ok(res.error.includes('Unsupported provider'));
  });

  await t.test('saveIntegrationConfigAction validates model name', async () => {
    // Try to save aiml with invalid model
    const aimlInvalidData = new FormData();
    aimlInvalidData.append('provider', 'aiml');
    aimlInvalidData.append('apiKey', 'mock-aiml-key');
    aimlInvalidData.append('modelName', 'invalid-model-name');

    const resFail = await saveIntegrationConfigAction(aimlInvalidData);
    assert.ok(resFail.error);
    assert.ok(resFail.error.includes('Invalid AIML model name'));

    // Save aiml with valid model name
    const aimlValidData = new FormData();
    aimlValidData.append('provider', 'aiml');
    aimlValidData.append('apiKey', 'mock-aiml-key');
    aimlValidData.append('modelName', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');

    const resSuccess = await saveIntegrationConfigAction(aimlValidData);
    assert.strictEqual(resSuccess.success, true);

    const aimlRow = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'aiml')).limit(1);
    assert.strictEqual(aimlRow[0].modelName, 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
  });
});
