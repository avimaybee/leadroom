
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const apiKey = searchParams.get('apiKey');

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

    return NextResponse.json({ models });
  } catch (error: unknown) {
    console.error('Settings models error:', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
