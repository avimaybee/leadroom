'use client';

import { useState, useEffect } from 'react';
import { setActiveProviderAndModelAction } from '@/app/(dashboard)/settings/integrations/actions';

interface ProviderConfig {
  provider: string;
  apiKey: string;
  modelName: string;
  isActive: boolean | null;
}

interface ActiveProviderPickerProps {
  configs: {
    gemini: ProviderConfig | null;
    nvidia: ProviderConfig | null;
    openrouter: ProviderConfig | null;
    groq: ProviderConfig | null;
    aiml: ProviderConfig | null;
  };
}

const STATIC_MODELS: Record<string, { id: string; name: string }[]> = {
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

const PROVIDER_NAMES: Record<string, string> = {
  gemini: 'Google Gemini',
  nvidia: 'NVIDIA NIM',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  aiml: 'AI/ML API',
};

export function ActiveProviderPicker({ configs }: ActiveProviderPickerProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [customModelName, setCustomModelName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get active provider from DB
  const activeConfig = Object.values(configs).find((c) => c?.isActive);

  // Get list of configured providers (must have an API key saved)
  const configuredProviders = Object.entries(configs)
    .filter(([_, config]) => config && config.apiKey)
    .map(([provider]) => provider);

  // Initialize selected provider and model based on active config
  useEffect(() => {
    if (activeConfig) {
      setSelectedProvider(activeConfig.provider);
      
      const staticList = STATIC_MODELS[activeConfig.provider] || [];
      const isStatic = staticList.some((m) => m.id === activeConfig.modelName);
      if (isStatic) {
        setSelectedModel(activeConfig.modelName);
        setIsCustomModel(false);
      } else {
        setSelectedModel('custom');
        setIsCustomModel(true);
        setCustomModelName(activeConfig.modelName);
      }
    } else if (configuredProviders.length > 0) {
      setSelectedProvider(configuredProviders[0]);
    }
  }, [configs]);

  // When selected provider changes, update model choices
  useEffect(() => {
    if (selectedProvider) {
      const currentConfig = configs[selectedProvider as keyof typeof configs];
      const staticList = STATIC_MODELS[selectedProvider] || [];
      
      if (currentConfig) {
        const isStatic = staticList.some((m) => m.id === currentConfig.modelName);
        if (isStatic) {
          setSelectedModel(currentConfig.modelName);
          setIsCustomModel(false);
        } else {
          setSelectedModel('custom');
          setIsCustomModel(true);
          setCustomModelName(currentConfig.modelName);
        }
      } else {
        setSelectedModel(staticList[0]?.id || '');
        setIsCustomModel(false);
      }
    }
  }, [selectedProvider]);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider) return;

    setLoading(true);
    setMessage(null);

    const finalModel = isCustomModel ? customModelName : selectedModel;
    if (!finalModel) {
      setMessage({ type: 'error', text: 'Please select or type a model name.' });
      setLoading(false);
      return;
    }

    const res = await setActiveProviderAndModelAction(selectedProvider, finalModel);

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: `Successfully activated ${PROVIDER_NAMES[selectedProvider]} with model "${finalModel}".` });
    }
    setLoading(false);
  }

  if (configuredProviders.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 text-sm text-amber-800 space-y-1">
        <div className="font-bold flex items-center gap-1.5 text-amber-900">
          <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          No AI Providers Configured Yet
        </div>
        <p className="leading-relaxed">
          Please add and save an API key for at least one provider below. Once configured, you can use this picker to choose your active routing provider and model.
        </p>
      </div>
    );
  }

  const currentStaticModels = STATIC_MODELS[selectedProvider] || [];

  return (
    <div className="bg-indigo-900/5 border border-indigo-200/50 rounded-2xl p-6 shadow-sm mb-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-indigo-600 text-white rounded-xl">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Active AI Routing Configuration</h2>
          <p className="text-xs text-slate-500 font-medium">Select which configured provider and model to route all lead research and triage tasks to.</p>
        </div>
      </div>

      <form onSubmit={handleActivate} className="space-y-4 max-w-2xl">
        {message && (
          <div className={`p-4 rounded-xl text-xs font-semibold ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Provider Selector */}
          <div>
            <label htmlFor="active-provider-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Active Provider
            </label>
            <select
              id="active-provider-select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 text-sm bg-white font-medium"
            >
              {configuredProviders.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_NAMES[p]} {configs[p as keyof typeof configs]?.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div>
            <label htmlFor="active-model-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Active Model
            </label>
            <select
              id="active-model-select"
              value={selectedModel}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setIsCustomModel(true);
                  setSelectedModel('custom');
                } else {
                  setIsCustomModel(false);
                  setSelectedModel(e.target.value);
                }
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 text-sm bg-white font-medium"
            >
              {currentStaticModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="custom">-- Custom Model Name... --</option>
            </select>
          </div>
        </div>

        {/* Custom Model Input */}
        {isCustomModel && (
          <div className="animate-fade-in max-w-sm">
            <label htmlFor="active-custom-model-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Custom Model ID
            </label>
            <input
              id="active-custom-model-input"
              type="text"
              value={customModelName}
              onChange={(e) => setCustomModelName(e.target.value)}
              placeholder="e.g. google/gemini-2.5-pro"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 text-sm font-medium"
              required
            />
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {loading ? 'Activating...' : 'Activate Config'}
          </button>
        </div>
      </form>
    </div>
  );
}
