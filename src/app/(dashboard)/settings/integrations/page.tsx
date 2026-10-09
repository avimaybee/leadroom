import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { IntegrationsService } from '@/services/integrations';
import { ProviderConfigForm } from '@/components/settings/ProviderConfigForm';
import { ActiveProviderPicker } from '@/components/settings/ActiveProviderPicker';
import { getLogger } from '@/lib/logger';

const log = getLogger('IntegrationsPage');

export const metadata = {
  title: 'AI Integrations | Leadroom',
};

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const db = getDb();
  const userId = await getUserId();

  // Check if encryption key is configured - required for storing API keys
  let encryptionKey: string | undefined = process.env.DB_ENCRYPTION_KEY;
  if (!encryptionKey) {
    try {
      const cfContext = (globalThis as any)[Symbol.for('__cloudflare-context__')];
      encryptionKey = cfContext?.env?.DB_ENCRYPTION_KEY;
    } catch {}
  }
  const encryptionAvailable = !!encryptionKey;
  if (!encryptionAvailable) {
    return (
      <div className="space-y-8 max-w-4xl">
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
          <h2 className="text-heading-lg text-destructive font-semibold">Configuration Required</h2>
          <p className="text-copy-14 text-muted-foreground mt-2">
            The <code className="text-destructive font-mono">DB_ENCRYPTION_KEY</code> environment variable is not configured.
            This is required to securely store API keys and manage AI provider integrations.
          </p>
          <p className="text-copy-14 text-muted-foreground mt-1">
            Please set it in your Cloudflare Pages environment variables and redeploy.
            You can generate a secure key with: <code className="font-mono">openssl rand -hex 32</code>
          </p>
        </div>
      </div>
    );
  }

  const service = new IntegrationsService(db, encryptionKey);

  let geminiConfig = null;
  let nvidiaConfig = null;
  let openrouterConfig = null;
  let groqConfig = null;
  let aimlConfig = null;
  let openaiConfig = null;
  let anthropicConfig = null;
  try {
    [geminiConfig, nvidiaConfig, openrouterConfig, groqConfig, aimlConfig, openaiConfig, anthropicConfig] = await Promise.all([
      service.getProviderConfig('gemini', userId),
      service.getProviderConfig('nvidia', userId),
      service.getProviderConfig('openrouter', userId),
      service.getProviderConfig('groq', userId),
      service.getProviderConfig('aiml', userId),
      service.getProviderConfig('openai', userId),
      service.getProviderConfig('anthropic', userId),
    ]);
  } catch (err) {
    log.error('Failed to load integration configs', err);
  }

  // Key remounts the picker when server configs change — replaces useEffect prop sync.
  const routingKey = [
    geminiConfig?.isResearchActive ? 'r' : '',
    geminiConfig?.isScoringActive ? 's' : '',
    geminiConfig?.isDraftingActive ? 'd' : '',
    nvidiaConfig?.isResearchActive ? 'R' : '',
    openrouterConfig ? 'o' : '',
    groqConfig ? 'g' : '',
    aimlConfig ? 'a' : '',
    openaiConfig ? 'p' : '',
    anthropicConfig ? 'n' : '',
  ].join('');

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Routing Controller */}
      <ActiveProviderPicker
        key={routingKey}
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
