import { getDb } from '@/db';
import { IntegrationsService } from '@/services/integrations';
import { ProviderConfigForm } from '@/components/settings/ProviderConfigForm';
import { ActiveProviderPicker } from '@/components/settings/ActiveProviderPicker';

export const metadata = {
  title: 'AI Integrations | Leadroom',
};

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const db = getDb();
  const service = new IntegrationsService(db);

  const geminiConfig = await service.getProviderConfig('gemini');
  const nvidiaConfig = await service.getProviderConfig('nvidia');
  const openrouterConfig = await service.getProviderConfig('openrouter');
  const groqConfig = await service.getProviderConfig('groq');
  const aimlConfig = await service.getProviderConfig('aiml');
  const openaiConfig = await service.getProviderConfig('openai');
  const anthropicConfig = await service.getProviderConfig('anthropic');

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Routing Controller */}
      <ActiveProviderPicker
        configs={{
          gemini: geminiConfig,
          nvidia: nvidiaConfig,
          openrouter: openrouterConfig,
          groq: groqConfig,
          aiml: aimlConfig,
          openai: openaiConfig,
          anthropic: anthropicConfig,
        }}
      />

      {/* Provider Details Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-heading-xl text-foreground">AI Providers</h2>
          <p className="text-muted-foreground mt-1 text-copy-14">
            Manage credentials, models, and options for each integrated provider below.
          </p>
        </div>

        <div className="space-y-3">
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

          <ProviderConfigForm
            provider="aiml"
            displayName="AI/ML API (OpenAI Compatible)"
            defaultModel="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
            config={aimlConfig}
          />

          <ProviderConfigForm
            provider="openai"
            displayName="OpenAI"
            defaultModel="gpt-4o"
            config={openaiConfig}
          />

          <ProviderConfigForm
            provider="anthropic"
            displayName="Anthropic Claude"
            defaultModel="claude-sonnet-4-6"
            config={anthropicConfig}
          />
        </div>
      </div>
    </div>
  );
}
