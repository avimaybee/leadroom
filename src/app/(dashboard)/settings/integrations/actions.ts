'use server';

import { getDb } from '@/db';
import { IntegrationsService } from '@/services/integrations';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';

export async function saveIntegrationConfigAction(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Authentication required' };
  const provider = formData.get('provider') as string;
  const apiKey = formData.get('apiKey') as string;
  const modelName = formData.get('modelName') as string;
  const isActive = formData.get('isActive') === 'on';

  if (!provider || !apiKey || !modelName) {
    return { error: 'Missing required fields' };
  }

  // Validate API key and model name against provider endpoints
  try {
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        const models = data.data || [];
        const exists = models.some((m) => m.id === modelName);
        if (!exists) {
          return { error: `Invalid OpenRouter model name "${modelName}". Make sure it matches OpenRouter's model list (e.g., "google/gemini-2.5-flash").` };
        }
      }
    } else if (provider === 'nvidia') {
      const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      if (res.status === 401) {
        return { error: 'Invalid NVIDIA API key.' };
      }
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        const models = data.data || [];
        const exists = models.some((m) => m.id === modelName);
        if (!exists) {
          return { error: `Invalid NVIDIA model name "${modelName}". Make sure it matches NVIDIA NIM's model list (e.g., "meta/llama-3.1-70b-instruct").` };
        }
      }
    } else if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (res.status === 400 || res.status === 403) {
        return { error: 'Invalid Gemini API key.' };
      }
      if (res.ok) {
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        const models = data.models || [];
        const exists = models.some((m) => m.name === `models/${modelName}` || m.name === modelName);
        if (!exists) {
          return { error: `Invalid Gemini model name "${modelName}". Standard name is "gemini-2.5-flash".` };
        }
      }
    } else if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      if (res.status === 401) {
        return { error: 'Invalid Groq API key.' };
      }
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        const models = data.data || [];
        const exists = models.some((m) => m.id === modelName);
        if (!exists) {
          return { error: `Invalid Groq model name "${modelName}". Make sure it matches Groq's model list (e.g., "llama3-70b-8192").` };
        }
      }
    } else if (provider === 'aiml') {
      const res = await fetch('https://api.aimlapi.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      if (res.status === 401) {
        return { error: 'Invalid AIML API key.' };
      }
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        const models = data.data || [];
        const exists = models.some((m) => m.id === modelName);
        if (!exists) {
          return { error: `Invalid AIML model name "${modelName}". Make sure it matches AIML API's model list (e.g., "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning").` };
        }
      }
    } else if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (res.status === 401) {
        return { error: 'Invalid OpenAI API key.' };
      }
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        const models = data.data || [];
        const exists = models.some((m) => m.id === modelName);
        if (!exists) {
          return { error: `Invalid OpenAI model name "${modelName}". Make sure it matches OpenAI's model list (e.g., "gpt-4o").` };
        }
      }
    } else if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      if (res.status === 401 || res.status === 403) {
        return { error: 'Invalid Anthropic API key.' };
      }
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string; display_name?: string }> };
        const models = data.data || [];
        const exists = models.some((m) => m.id === modelName);
        if (!exists) {
          return { error: `Invalid Anthropic model name "${modelName}". Make sure it matches Claude's model list (e.g., "claude-sonnet-4-6").` };
        }
      }
    }
  } catch (err: unknown) {
    console.error(`Validation check failed for ${provider}:`, err);
    // If the validation check fails due to network issues, we allow saving rather than blocking the user.
  }

  const db = getDb();
  const service = new IntegrationsService(db);

  try {
    if (isActive) {
      const { providerConfigs } = await import('@/db/schema/core');
      await db.update(providerConfigs).set({ isActive: false });
    }
    await service.saveProviderConfig(provider, apiKey, modelName, isActive);
    try {
      revalidatePath('/settings/integrations');
    } catch (e) {}
    return { success: true };
  } catch (e: unknown) {
    console.error(e);
    const errMsg = e instanceof Error ? e.message : 'Failed to save configuration';
    return { error: errMsg };
  }
}

export async function deleteIntegrationConfigAction(provider: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Authentication required' };
  if (!provider) return { error: 'Provider is required' };

  const db = getDb();
  const service = new IntegrationsService(db);

  try {
    await service.deleteProviderConfig(provider);
    try {
      revalidatePath('/settings/integrations');
    } catch (e) {}
    return { success: true };
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : 'Failed to delete configuration';
    return { error: errMsg };
  }
}

export async function setActiveProviderAndModelAction(provider: string, modelName: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Authentication required' };
  if (!provider || !modelName) {
    return { error: 'Provider and model name are required' };
  }

  const db = getDb();
  const service = new IntegrationsService(db);

  try {
    const config = await service.getProviderConfig(provider);
    if (!config || !config.apiKey) {
      return { error: `Provider "${provider}" has no saved configuration. Please configure it first.` };
    }

    const { providerConfigs } = await import('@/db/schema/core');
    await db.update(providerConfigs).set({ isActive: false });
    await service.saveProviderConfig(provider, config.apiKey, modelName, true);

    try {
      revalidatePath('/settings/integrations');
    } catch (e) {}
    return { success: true };
  } catch (error: any) {
    console.error('Failed to set active provider and model:', error);
    return { error: error.message || 'Failed to set active provider and model' };
  }
}
