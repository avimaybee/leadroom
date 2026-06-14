'use client';

import { useState, useEffect } from 'react';
import { saveIntegrationConfigAction, deleteIntegrationConfigAction } from '@/app/(dashboard)/settings/integrations/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface ProviderConfig {
  provider: string;
  apiKey: string;
  modelName: string;
  isActive: boolean | null;
}

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
  ]
};

function ApiKeySection({
  provider,
  apiKey,
  setApiKey,
  onFetchModels,
  loadingModels,
}: {
  provider: string;
  apiKey: string;
  setApiKey: (val: string) => void;
  onFetchModels: (key: string) => void;
  loadingModels: boolean;
}) {
  return (
    <div>
      <Label htmlFor={`${provider}-apiKey`}>API Key</Label>
      <div className="flex gap-2">
        <Input
          type="password"
          id={`${provider}-apiKey`}
          name="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          required
        />
        {apiKey && (
          <Button type="button" variant="outline" size="sm" onClick={() => onFetchModels(apiKey)} disabled={loadingModels}>
            {loadingModels ? 'Fetching...' : 'Fetch Models'}
          </Button>
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
    <div>
      <Label htmlFor={`${provider}-modelName`}>Model Name</Label>
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
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name} ({model.id})
          </option>
        ))}
        <option value="custom">-- Custom Model Name... --</option>
      </select>

      {isCustomModel && (
        <div className="mt-3">
          <Input
            type="text"
            value={customModelName}
            onChange={(e) => setCustomModelName(e.target.value)}
            placeholder="Enter custom model ID (e.g. google/gemini-2.5-pro)"
            required
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
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
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [models, setModels] = useState<ModelOption[]>(STATIC_MODELS[provider] || []);
  const [selectedModel, setSelectedModel] = useState(config?.modelName || defaultModel);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelName, setCustomModelName] = useState('');

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
      setMessage({ type: 'success', text: 'Configuration saved successfully.' });
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

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-muted/30">
        <h3 className="text-lg font-semibold text-foreground">{displayName}</h3>
        {config?.isActive && (
          <Badge variant="secondary" className="bg-chart-2/10 text-chart-2">Active</Badge>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-chart-2/10 text-chart-2 border border-chart-2/20'}`}>
            {message.text}
          </div>
        )}

        <ApiKeySection 
          provider={provider} 
          apiKey={apiKey} 
          setApiKey={setApiKey} 
          onFetchModels={loadLiveModels} 
          loadingModels={loadingModels} 
        />

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

        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id={`${provider}-isActive`}
            name="isActive"
            defaultChecked={config ? (config.isActive ?? true) : true}
            className="w-4 h-4 text-primary border-input rounded focus:ring-primary"
          />
          <Label htmlFor={`${provider}-isActive`}>
            Set as active provider for AI tasks
          </Label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
          
          {config && (
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
              Remove
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
