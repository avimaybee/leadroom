import { getDb } from '@/db';
import { IntegrationsService } from '@/services/integrations';
import { ProviderConfigForm } from '@/components/settings/ProviderConfigForm';

export const runtime = 'edge';

export const metadata = {
  title: 'Integrations | Agency OS',
};

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const db = getDb();
  const service = new IntegrationsService(db);

  const geminiConfig = await service.getProviderConfig('gemini');
  const nvidiaConfig = await service.getProviderConfig('nvidia');
  const openrouterConfig = await service.getProviderConfig('openrouter');
  const groqConfig = await service.getProviderConfig('groq');

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Integrations</h1>
        <p className="text-slate-500 mt-2 text-sm max-w-2xl">
          Configure your AI providers for lead research and enrichment. Setting an active provider will automatically route all AI requests to that service.
        </p>
      </div>

      <div className="space-y-6">
        <ProviderConfigForm
          provider="openrouter"
          displayName="OpenRouter"
          defaultModel="google/gemini-2.5-flash"
          config={openrouterConfig}
        />

        <ProviderConfigForm
          provider="gemini"
          displayName="Google Gemini"
          defaultModel="gemini-2.5-flash"
          config={geminiConfig}
        />

        <ProviderConfigForm
          provider="nvidia"
          displayName="NVIDIA NIM (OpenAI Compatible)"
          defaultModel="meta/llama-3.1-70b-instruct"
          config={nvidiaConfig}
        />

        <ProviderConfigForm
          provider="groq"
          displayName="Groq (OpenAI Compatible)"
          defaultModel="llama3-70b-8192"
          config={groqConfig}
        />
      </div>
    </div>
  );
}
