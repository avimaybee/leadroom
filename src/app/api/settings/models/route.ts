import { getLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { isPrivateHost } from '@/lib/network';
import { z } from 'zod';

const log = getLogger('SettingsModelsAPI');

const FetchModelsSchema = z.object({
  provider: z.string().min(1).nullable().optional(),
  apiKey: z.string().nullable().optional(),
});

const FETCH_TIMEOUT_MS = 15000;

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const apiKey = searchParams.get('apiKey');

  return fetchModelsForProvider(provider, apiKey);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = FetchModelsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { provider = null, apiKey = null } = parsed.data;
    return fetchModelsForProvider(provider ?? null, apiKey ?? null);
  } catch (error: unknown) {
    log.error('Settings models POST error', error);
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }
}

async function fetchWithValidation(url: string, init?: RequestInit): Promise<Response> {
  if (isPrivateHost(url)) throw new Error(`Blocked request to private IP: ${url}`);
  return fetch(url, init);
}

async function fetchModelsForProvider(provider: string | null, apiKey: string | null) {
  if (!provider) {
    return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
  }

  try {
    let models: { id: string; name: string }[] = [];

    if (provider === 'openrouter') {
      const headers: HeadersInit = {};
      if (apiKey && apiKey !== 'placeholder' && apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const res = await fetchWithValidation('https://openrouter.ai/api/v1/models', { 
        headers,
        cache: 'no-store',
        // AbortSignal.timeout() requires compatibility_date >= 2023-10-01 (Workers) / Node 16+
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`OpenRouter returned status ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ id: string; name?: string }> };
      models = (data.data || []).map((m) => ({
        id: m.id,
        name: m.name || m.id,
      }));
    } 
    
    else if (provider === 'nvidia') {
      if (!apiKey || apiKey === 'placeholder' || apiKey.trim() === '') {
        return NextResponse.json({ models: [] });
      }
      const res = await fetchWithValidation('https://integrate.api.nvidia.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`NVIDIA returned status ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      models = (data.data || []).map((m) => ({
        id: m.id,
        name: m.id,
      }));
    } 
    
    else if (provider === 'groq') {
      if (!apiKey || apiKey === 'placeholder' || apiKey.trim() === '') {
        return NextResponse.json({ models: [] });
      }
      const res = await fetchWithValidation('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Groq returned status ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      models = (data.data || []).map((m) => ({
        id: m.id,
        name: m.id,
      }));
    } 
    
    else if (provider === 'gemini') {
      if (!apiKey || apiKey === 'placeholder' || apiKey.trim() === '') {
        return NextResponse.json({ models: [] });
      }
      const res = await fetchWithValidation(`https://generativelanguage.googleapis.com/v1beta/models`, {
        headers: { 'x-goog-api-key': apiKey },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Gemini returned status ${res.status}`);
      const data = (await res.json()) as {
        models?: Array<{
          name: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      models = (data.models || [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => ({
          id: m.name.replace(/^models\//, ''),
          name: m.displayName || m.name,
        }));
    }
    
    else if (provider === 'aiml') {
      if (!apiKey || apiKey === 'placeholder' || apiKey.trim() === '') {
        return NextResponse.json({ models: [] });
      }
      const res = await fetchWithValidation('https://api.aimlapi.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`AIML API returned status ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      models = (data.data || []).map((m) => ({
        id: m.id,
        name: m.id,
      }));
    }

    else if (provider === 'openai') {
      if (!apiKey || apiKey === 'placeholder' || apiKey.trim() === '') {
        return NextResponse.json({ models: [] });
      }
      const res = await fetchWithValidation('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`OpenAI returned status ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      models = (data.data || []).map((m) => ({
        id: m.id,
        name: m.id,
      }));
    }

    else if (provider === 'anthropic') {
      if (!apiKey || apiKey === 'placeholder' || apiKey.trim() === '') {
        return NextResponse.json({ models: [] });
      }
      const res = await fetchWithValidation('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Anthropic returned status ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ id: string; display_name?: string }> };
      models = (data.data || []).map((m) => ({
        id: m.id,
        name: m.display_name || m.id,
      }));
    }

    return NextResponse.json({ models });
  } catch (error: unknown) {
    log.error('Settings models error', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
