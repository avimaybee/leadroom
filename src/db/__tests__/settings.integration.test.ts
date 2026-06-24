import { test } from 'node:test';
import assert from 'node:assert';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { providerConfigs } from '../schema/core';

// Ensure test environment
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
(process.env as any).NODE_ENV = 'test';


import { saveIntegrationConfigAction, setActiveProviderAndModelAction } from '../../app/(dashboard)/settings/integrations/actions';
import { MockD1Database } from '@/db/local-mock';

import { setupTestDb as initTestDb } from './test-helpers';

function setupTestDb() {
  const { sqlite } = initTestDb();
  const mockD1 = new MockD1Database(sqlite);
  return { mockD1, sqlite };
}

test('AI Provider Config & Active Picker Integration', async (t) => {
  const { mockD1, sqlite } = setupTestDb();
  
  // Set the DB mock
  process.env = {
    ...process.env,
    DB: mockD1 as any,
  };

  const db = drizzle(sqlite);

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

  await t.test('saveIntegrationConfigAction sets isActive mutually exclusively', async () => {
    // 1. Save Gemini as active
    const geminiFormData = new FormData();
    geminiFormData.append('provider', 'gemini');
    geminiFormData.append('apiKey', 'mock-gemini-key');
    geminiFormData.append('modelName', 'gemini-2.5-flash');
    geminiFormData.append('isActive', 'on');

    const res1 = await saveIntegrationConfigAction(geminiFormData);
    assert.strictEqual(res1.success, true);

    const configs1 = await db.select().from(providerConfigs);
    assert.strictEqual(configs1.length, 1);
    assert.strictEqual(configs1[0].provider, 'gemini');
    assert.strictEqual(configs1[0].isActive, true);

    // 2. Save Nvidia as active - should automatically deactivate Gemini
    const nvidiaFormData = new FormData();
    nvidiaFormData.append('provider', 'nvidia');
    nvidiaFormData.append('apiKey', 'mock-nvidia-key');
    nvidiaFormData.append('modelName', 'meta/llama-3.1-70b-instruct');
    nvidiaFormData.append('isActive', 'on');

    const res2 = await saveIntegrationConfigAction(nvidiaFormData);
    assert.strictEqual(res2.success, true);

    const geminiRow = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'gemini')).limit(1);
    const nvidiaRow = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'nvidia')).limit(1);

    assert.strictEqual(geminiRow[0].isActive, false); // Automatically deactivated
    assert.strictEqual(nvidiaRow[0].isActive, true);  // Newly active
  });

  await t.test('setActiveProviderAndModelAction updates the chosen active provider and deactivates others', async () => {
    // 1. Activate Gemini via the active picker action
    const res = await setActiveProviderAndModelAction('gemini', 'gemini-2.5-pro');
    assert.strictEqual(res.success, true);

    const geminiRow = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'gemini')).limit(1);
    const nvidiaRow = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'nvidia')).limit(1);

    assert.strictEqual(geminiRow[0].isActive, true);
    assert.strictEqual(geminiRow[0].modelName, 'gemini-2.5-pro'); // Model name updated
    assert.strictEqual(nvidiaRow[0].isActive, false); // Deactivated
  });

  await t.test('setActiveProviderAndModelAction fails when target provider is not configured (missing key)', async () => {
    // groq is not configured in the db yet
    const res = await setActiveProviderAndModelAction('groq', 'llama3-70b-8192');
    assert.ok(res.error);
    assert.ok(res.error.includes('no saved configuration'));
  });

  await t.test('saveIntegrationConfigAction works with aiml provider and validates model', async () => {
    // 1. Try to save aiml with invalid model
    const aimlInvalidData = new FormData();
    aimlInvalidData.append('provider', 'aiml');
    aimlInvalidData.append('apiKey', 'mock-aiml-key');
    aimlInvalidData.append('modelName', 'invalid-model-name');
    aimlInvalidData.append('isActive', 'on');

    const resFail = await saveIntegrationConfigAction(aimlInvalidData);
    assert.ok(resFail.error);
    assert.ok(resFail.error.includes('Invalid AIML model name'));

    // 2. Save aiml with valid model name
    const aimlValidData = new FormData();
    aimlValidData.append('provider', 'aiml');
    aimlValidData.append('apiKey', 'mock-aiml-key');
    aimlValidData.append('modelName', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
    aimlValidData.append('isActive', 'on');

    const resSuccess = await saveIntegrationConfigAction(aimlValidData);
    assert.strictEqual(resSuccess.success, true);

    const aimlRow = await db.select().from(providerConfigs).where(eq(providerConfigs.provider, 'aiml')).limit(1);
    assert.strictEqual(aimlRow[0].isActive, true);
    assert.strictEqual(aimlRow[0].modelName, 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
  });
});
