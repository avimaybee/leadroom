import { getLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';

const log = getLogger('SettingsModelsAPI');

export const dynamic = 'force-dynamic';

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
    const body = await request.json() as { provider?: string | null; apiKey?: string | null };
    const { provider = null, apiKey = null } = body;
    return fetchModelsForProvider(provider ?? null, apiKey ?? null);
  } catch (error: unknown) {
    log.error('Settings models POST error', error);
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }
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
      const res = await fetch('https://openrouter.ai/api/v1/models', { 
        headers,
        cache: 'no-store'
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
      const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        cache: 'no-store'
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
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        cache: 'no-store'
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
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        cache: 'no-store'
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
      const res = await fetch('https://api.aimlapi.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        cache: 'no-store'
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
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        cache: 'no-store'
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
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        cache: 'no-store'
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
