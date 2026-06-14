'use client';

import { useState, useEffect } from 'react';
import { setActiveProviderAndModelAction } from '@/app/(dashboard)/settings/integrations/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings2, AlertTriangle } from 'lucide-react';

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

  const activeConfig = Object.values(configs).find((c) => c?.isActive);

  const configuredProviders = Object.entries(configs)
    .filter(([_, config]) => config && config.apiKey)
    .map(([provider]) => provider);

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
      <div className="bg-chart-5/10 border border-chart-5/20 rounded-2xl p-5 mb-8 text-sm text-chart-5 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-5 h-5 shrink-0" />
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
    <div className="bg-muted/30 border border-border/50 rounded-2xl p-6 shadow-sm mb-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-primary text-primary-foreground rounded-xl">
          <Settings2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">Active AI Routing Configuration</h2>
          <p className="text-xs text-muted-foreground font-medium">Select which configured provider and model to route all lead research and triage tasks to.</p>
        </div>
      </div>

      <form onSubmit={handleActivate} className="space-y-4 max-w-2xl">
        {message && (
          <div className={`p-4 rounded-xl text-xs font-semibold ${message.type === 'error' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-chart-2/10 text-chart-2 border border-chart-2/20'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="active-provider-select" className="text-xs uppercase tracking-wider">Active Provider</Label>
            <select
              id="active-provider-select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground font-medium"
            >
              {configuredProviders.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_NAMES[p]} {configs[p as keyof typeof configs]?.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="active-model-select" className="text-xs uppercase tracking-wider">Active Model</Label>
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
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground font-medium"
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

        {isCustomModel && (
          <div className="animate-fade-in max-w-sm">
            <Label htmlFor="active-custom-model-input" className="text-xs uppercase tracking-wider">Custom Model ID</Label>
            <Input
              id="active-custom-model-input"
              type="text"
              value={customModelName}
              onChange={(e) => setCustomModelName(e.target.value)}
              placeholder="e.g. google/gemini-2.5-pro"
              required
            />
          </div>
        )}

        <div className="pt-2">
          <Button type="submit" disabled={loading} size="sm">
            {loading ? 'Activating...' : 'Activate Config'}
          </Button>
        </div>
      </form>
    </div>
  );
}
