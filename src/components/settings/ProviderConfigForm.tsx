'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, KeyRound, AlertTriangle } from 'lucide-react';
import { saveIntegrationConfigAction, deleteIntegrationConfigAction, testIntegrationConnectionAction } from '@/app/(dashboard)/settings/integrations/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProviderConfig {
  provider: string;
  apiKey: string;
  modelName: string;
  isResearchActive: boolean | null;
  isScoringActive: boolean | null;
  isDraftingActive: boolean | null;
}

const ONBOARDING_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/keys',
  gemini: 'https://aistudio.google.com/app/apikey',
  nvidia: 'https://build.nvidia.com/',
  groq: 'https://console.groq.com/keys',
  aiml: 'https://aimlapi.com/',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/keys',
};

interface Props {
  provider: string;
  displayName: string;
  defaultModel: string;
  config?: ProviderConfig | null;
}

interface ModelOption {
  id: string;
  name: string;
}

const STATIC_MODELS: Record<string, ModelOption[]> = {
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Default)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  ],
  nvidia: [
    { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct (Default)' },
    { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct' },
    { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron 4 340B Instruct' },
  ],
  openrouter: [
    { id: 'google/gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash (Default)' },
    { id: 'google/gemini-2.5-pro', name: 'Google: Gemini 2.5 Pro' },
    { id: 'anthropic/claude-3-haiku', name: 'Anthropic: Claude 3 Haiku' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic: Claude 3.5 Sonnet' },
    { id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B Instruct (Free)' },
  ],
  groq: [
    { id: 'llama3-70b-8192', name: 'Llama 3 70B (Default)' },
    { id: 'llama3-8b-8192', name: 'Llama 3 8B' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
  ],
  aiml: [
    { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', name: 'Nemotron 3 Nano Omni (Default)' },
    { id: 'meta-llama/Llama-3-8b-chat', name: 'Llama 3 8B Chat' },
    { id: 'meta-llama/Llama-3-70b-chat', name: 'Llama 3 70B Chat' },
    { id: 'mistralai/Mistral-7B-Instruct-v0.2', name: 'Mistral 7B Instruct v0.2' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Default)' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-5.5', name: 'GPT-5.5' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Default)' },
    { id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
  ],
};

function ApiKeySection({
  provider,
  apiKey,
  modelName,
  setApiKey,
  onFetchModels,
  onTestConnection,
  loadingModels,
  testingConnection,
}: {
  provider: string;
  apiKey: string;
  modelName: string;
  setApiKey: (val: string) => void;
  onFetchModels: (key: string) => void;
  onTestConnection: (key: string, model: string) => void;
  loadingModels: boolean;
  testingConnection: boolean;
}) {
  const onboardingUrl = ONBOARDING_URLS[provider];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${provider}-apiKey`} className="text-label-12 uppercase text-muted-foreground flex items-center gap-1.5">
        API Key
        {onboardingUrl && (
          <a href={onboardingUrl} target="_blank" rel="noopener noreferrer"
             className="text-primary hover:text-primary/80 underline underline-offset-2 text-label-12 font-normal">
            Get a key
          </a>
        )}
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          type="password"
          id={`${provider}-apiKey`}
          name="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API key"
          required
          className="text-copy-14 flex-1 min-w-[200px]"
        />
        {apiKey && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => onFetchModels(apiKey)} disabled={loadingModels} className="shrink-0">
              {loadingModels ? 'Fetching...' : 'Fetch Models'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onTestConnection(apiKey, modelName)} disabled={testingConnection || !modelName} className="shrink-0">
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ModelSelectSection({
  provider,
  models,
  selectedModel,
  setSelectedModel,
  isCustomModel,
  setIsCustomModel,
  customModelName,
  setCustomModelName,
}: {
  provider: string;
  models: ModelOption[];
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  isCustomModel: boolean;
  setIsCustomModel: (val: boolean) => void;
  customModelName: string;
  setCustomModelName: (val: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${provider}-modelName`} className="text-label-12 uppercase text-muted-foreground">Model Name</Label>
      <select
        id={`${provider}-modelName`}
        value={isCustomModel ? 'custom' : selectedModel}
        onChange={(e) => {
          if (e.target.value === 'custom') {
            setIsCustomModel(true);
          } else {
            setIsCustomModel(false);
            setSelectedModel(e.target.value);
          }
        }}
        className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-copy-14 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id} className="bg-card text-foreground">
            {model.name} ({model.id})
          </option>
        ))}
        <option value="custom" className="bg-card text-foreground">-- Custom Model Name... --</option>
      </select>

      {isCustomModel && (
        <div className="mt-3 animate-fade-in">
          <Input
            type="text"
            value={customModelName}
            onChange={(e) => setCustomModelName(e.target.value)}
            placeholder="Enter custom model ID (e.g. google/gemini-2.5-pro)"
            required
            className="text-copy-14"
          />
          <p className="mt-1.5 text-label-12 text-muted-foreground font-medium">
            Type the exact ID required by the API provider.
          </p>
        </div>
      )}
    </div>
  );
}

export function ProviderConfigForm({ provider, displayName, defaultModel, config }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [models, setModels] = useState<ModelOption[]>(STATIC_MODELS[provider] || []);
  const [selectedModel, setSelectedModel] = useState(config?.modelName || defaultModel);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  
  const [isExpanded, setIsExpanded] = useState(!config?.apiKey);

  async function loadLiveModels(keyToUse: string) {
    if (!keyToUse || keyToUse === 'placeholder' || keyToUse.trim() === '') {
      return;
    }
    
    setLoadingModels(true);
    try {
      const res = await fetch(`/api/settings/models?provider=${provider}&apiKey=${encodeURIComponent(keyToUse)}`);
      if (res.ok) {
        const data = (await res.json()) as { models?: ModelOption[] };
        if (data.models && data.models.length > 0) {
          setModels(data.models);
          const modelExists = data.models.some((m) => m.id === selectedModel);
          if (!modelExists && selectedModel !== defaultModel) {
            setIsCustomModel(true);
            setCustomModelName(selectedModel);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch live models:', err);
    } finally {
      setLoadingModels(false);
    }
  }

  useEffect(() => {
    if (config?.apiKey) {
      loadLiveModels(config.apiKey);
      const staticList = STATIC_MODELS[provider] || [];
      const isStatic = staticList.some(m => m.id === config.modelName);
      if (!isStatic && config.modelName !== defaultModel) {
        setIsCustomModel(true);
        setCustomModelName(config.modelName);
      }
    }
  }, [config?.apiKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (apiKey && apiKey !== config?.apiKey) {
        loadLiveModels(apiKey);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [apiKey]);

  async function handleTestConnection(keyToTest: string, modelToTest: string) {
    setTestingConnection(true);
    setConnectionResult(null);

    const res = await testIntegrationConnectionAction(provider, keyToTest, modelToTest);
    
    if (res.error) {
      setConnectionResult({ type: 'error', text: res.error });
    } else {
      setConnectionResult({ type: 'success', text: 'Connection successful — API key is valid and model is accessible.' });
    }
    setTestingConnection(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.append('provider', provider);
    
    const finalModel = isCustomModel ? customModelName : selectedModel;
    formData.set('modelName', finalModel);

    const res = await saveIntegrationConfigAction(formData);
    
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Configuration saved.' });
    }
    
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to remove this configuration?')) return;
    
    setLoading(true);
    setMessage(null);
    
    const res = await deleteIntegrationConfigAction(provider);
    
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Configuration removed.' });
      setApiKey('');
      setSelectedModel(defaultModel);
      setIsCustomModel(false);
      setCustomModelName('');
      setModels(STATIC_MODELS[provider] || []);
    }
    
    setLoading(false);
  }

  const isConfigured = !!config?.apiKey;
  const routingRoles: string[] = [];
  if (config?.isResearchActive) routingRoles.push('Research');
  if (config?.isScoringActive) routingRoles.push('Scoring');
  if (config?.isDraftingActive) routingRoles.push('Drafting');

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-200">
      {/* Collapsed view toggle header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer hover:bg-muted/20 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-xl text-muted-foreground shrink-0">
            <KeyRound className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-label-14 font-semibold text-foreground leading-none">{displayName}</h3>
            {isConfigured ? (
              <span className="text-label-12 text-muted-foreground mt-1.5 font-medium block">
                Model: <code className="bg-muted px-1.5 py-0.5 rounded text-mono-12 text-foreground font-semibold">{selectedModel}</code>
              </span>
            ) : (
              <span className="text-label-12 text-muted-foreground mt-1.5 font-medium block">
                Not configured
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
          {routingRoles.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-label-12 font-semibold text-chart-2 bg-chart-2/10 border border-chart-2/20 px-2.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-chart-2 animate-pulse" />
              {routingRoles.join(', ')}
            </span>
          ) : isConfigured ? (
            <span className="inline-flex items-center gap-1.5 text-label-12 font-semibold text-muted-foreground bg-muted border border-border px-2.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              Configured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-label-12 font-semibold text-destructive/80 bg-destructive/10 border border-destructive/20 px-2.5 py-0.5 rounded-full">
              Not Configured
            </span>
          )}
          
          <Button 
            type="button" 
            variant="ghost" 
            size="icon-sm"
            className="text-muted-foreground hover:bg-muted"
            aria-label={isExpanded ? "Collapse settings" : "Expand settings"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded config form */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-3 border-t border-border space-y-5 animate-fade-in bg-muted/5">
          {message && (
            <div className={`p-4 rounded-xl text-label-12 font-semibold flex items-start gap-2 ${message.type === 'error' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-chart-2/10 text-chart-2 border border-chart-2/20'}`}>
              {message.type === 'error' && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{message.text}</span>
            </div>
          )}

          <ApiKeySection 
            provider={provider} 
            apiKey={apiKey} 
            modelName={isCustomModel ? customModelName : selectedModel}
            setApiKey={setApiKey} 
            onFetchModels={loadLiveModels} 
            onTestConnection={handleTestConnection}
            loadingModels={loadingModels} 
            testingConnection={testingConnection}
          />

          {connectionResult && (
            <div className={`p-3 rounded-xl text-label-12 font-semibold flex items-start gap-2 ${
              connectionResult.type === 'error'
                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                : 'bg-chart-2/10 text-chart-2 border border-chart-2/20'
            }`}>
              {connectionResult.type === 'error' && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span className="break-all">{connectionResult.text}</span>
            </div>
          )}

          <ModelSelectSection 
            provider={provider} 
            models={models} 
            selectedModel={selectedModel} 
            setSelectedModel={setSelectedModel} 
            isCustomModel={isCustomModel} 
            setIsCustomModel={setIsCustomModel} 
            customModelName={customModelName} 
            setCustomModelName={setCustomModelName} 
          />

          <div className="flex gap-2.5 pt-4 border-t border-border">
            <Button type="submit" disabled={loading} size="sm">
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
            
            {config && (
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
                Remove Configuration
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
