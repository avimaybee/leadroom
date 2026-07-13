import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { IntegrationsService } from '@/services/integrations';
import { CalendarService } from '@/services/calendar';
import { ProviderConfigForm } from '@/components/settings/ProviderConfigForm';
import { ActiveProviderPicker } from '@/components/settings/ActiveProviderPicker';
import { CalendarIntegration } from '@/components/settings/CalendarIntegration';
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
  const encryptionAvailable = !!process.env.DB_ENCRYPTION_KEY;
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

  const service = new IntegrationsService(db);
  const calendarService = new CalendarService(db);

  let geminiConfig = null;
  let nvidiaConfig = null;
  let openrouterConfig = null;
  let groqConfig = null;
  let aimlConfig = null;
  let openaiConfig = null;
  let anthropicConfig = null;
  let calendarStatus = { connected: false };
  let clientId = null;
  let clientSecret = null;
  let storedCreds = null;

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

    calendarStatus = userId ? await calendarService.getStatus(userId) : { connected: false };
    clientId = userId ? await calendarService.getClientId(userId) : null;
    clientSecret = userId ? await calendarService.getClientSecret(userId) : null;
    storedCreds = userId ? await calendarService.getStoredCredentials(userId) : null;
  } catch (err) {
    log.error('Failed to load integration configs', err);
  }

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

      {/* Calendar Integration */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-heading-lg text-foreground">Calendar Sync</h2>
          <p className="text-copy-14 text-muted-foreground mt-0.5">Sync tasks to your Google Calendar for external visibility.</p>
        </div>
        <div className="p-6">
          <CalendarIntegration
            initialConnected={calendarStatus.connected}
            isConfigured={!!(clientId && clientSecret)}
            hasStoredCredentials={!!(storedCreds?.googleClientId && storedCreds?.googleClientSecret)}
          />
        </div>
      </div>
    </div>
  );
}
