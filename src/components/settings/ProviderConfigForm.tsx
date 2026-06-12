'use client';

import { useState, useEffect } from 'react';
import { saveIntegrationConfigAction, deleteIntegrationConfigAction } from '@/app/(dashboard)/settings/integrations/actions';

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
      <label htmlFor={`${provider}-apiKey`} className="block text-sm font-semibold text-slate-700 mb-1.5">
        API Key
      </label>
      <div className="flex gap-2">
        <input
          type="password"
          id={`${provider}-apiKey`}
          name="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 text-sm"
          required
        />
        {apiKey && (
          <button
            type="button"
            onClick={() => onFetchModels(apiKey)}
            disabled={loadingModels}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-200"
          >
            {loadingModels ? 'Fetching...' : 'Fetch Models'}
          </button>
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
      <label htmlFor={`${provider}-modelName`} className="block text-sm font-semibold text-slate-700 mb-1.5">
        Model Name
      </label>
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
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 text-sm bg-white"
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
          <input
            type="text"
            value={customModelName}
            onChange={(e) => setCustomModelName(e.target.value)}
            placeholder="Enter custom model ID (e.g. google/gemini-2.5-pro)"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 text-sm"
            required
          />
          <p className="mt-1.5 text-xs text-slate-500">
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

  // 1. Fetch live models from API
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
          
          // Verify if currently selected model exists in the live list, otherwise set isCustomModel
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

  // Auto load models if API key exists on mount
  useEffect(() => {
    if (config?.apiKey) {
      loadLiveModels(config.apiKey);
      
      // Determine if custom model
      const staticList = STATIC_MODELS[provider] || [];
      const isStatic = staticList.some(m => m.id === config.modelName);
      if (!isStatic && config.modelName !== defaultModel) {
        setIsCustomModel(true);
        setCustomModelName(config.modelName);
      }
    }
  }, [config?.apiKey]);

  // Handle API key change (debounced fetch)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (apiKey && apiKey !== config?.apiKey) {
        loadLiveModels(apiKey);
      }
    }, 1000); // 1s debounce

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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="text-lg font-semibold text-slate-800">{displayName}</h3>
        {config?.isActive && (
          <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
            Active
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
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
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor={`${provider}-isActive`} className="text-sm font-medium text-slate-700">
            Set as active provider for AI tasks
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
          
          {config && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
