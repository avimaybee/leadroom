'use client';

import { useState, useEffect } from 'react';
import { setActiveProviderAndModelAction } from '@/app/(dashboard)/settings/integrations/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Settings2, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

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
      setMessage({ type: 'success', text: `Activated ${PROVIDER_NAMES[selectedProvider]} routing with "${finalModel}".` });
    }
    setLoading(false);
  }

  if (configuredProviders.length === 0) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 text-destructive p-5 flex flex-col gap-3 rounded-xl shadow-sm">
        <div className="font-semibold flex items-center gap-2 text-label-14">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          No AI Routing Configured
        </div>
        <p className="text-label-12 leading-relaxed font-semibold text-destructive/90">
          You must configure at least one AI provider credentials below before you can select an active routing provider. Set up OpenRouter or Google Gemini below to get started.
        </p>
      </Card>
    );
  }

  const currentStaticModels = STATIC_MODELS[selectedProvider] || [];

  return (
    <Card className="border border-border shadow-sm overflow-hidden bg-card">
      <CardHeader className="border-b border-border bg-muted/20 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="heading-xl font-semibold">AI Routing Controller</CardTitle>
            <CardDescription className="text-label-12 font-semibold">
              Select which configured AI service and model to route research, auditing, and outreach tasks to.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        <form onSubmit={handleActivate} className="space-y-4">
          {message && (
            <div className={`p-4 rounded-xl text-label-12 font-semibold flex items-center gap-2 border ${
              message.type === 'error' 
                ? 'bg-destructive/10 text-destructive border-destructive/20' 
                : 'bg-chart-2/10 text-chart-2 border-chart-2/20'
            }`}>
              {message.type === 'success' && <ShieldCheck className="h-4 w-4 shrink-0" />}
              {message.type === 'error' && <AlertTriangle className="h-4 w-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="active-provider-select" className="text-label-12 uppercase text-muted-foreground">Active Provider</Label>
              <select
                id="active-provider-select"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-copy-14 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground"
              >
                {configuredProviders.map((p) => (
                  <option key={p} value={p} className="bg-card text-foreground">
                    {PROVIDER_NAMES[p]} {configs[p as keyof typeof configs]?.isActive ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="active-model-select" className="text-label-12 uppercase text-muted-foreground">Active Model</Label>
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
                className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-copy-14 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground"
              >
                {currentStaticModels.map((m) => (
                  <option key={m.id} value={m.id} className="bg-card text-foreground">
                    {m.name}
                  </option>
                ))}
                <option value="custom" className="bg-card text-foreground">-- Custom Model Name... --</option>
              </select>
            </div>
          </div>

          {isCustomModel && (
            <div className="animate-fade-in max-w-md space-y-1.5">
              <Label htmlFor="active-custom-model-input" className="text-label-12 uppercase text-muted-foreground">Custom Model ID</Label>
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

          <div className="pt-2 flex items-center justify-between border-t border-border/80 mt-2 gap-4">
            <div className="flex items-center gap-1.5 text-label-12 font-semibold text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Inactive credentials are hidden from active routing</span>
            </div>
            
            <Button type="submit" disabled={loading} size="sm">
              {loading ? 'Activating...' : 'Activate Router'}
            </Button>
          </div>
        </form>

        {/* Fallback / Safeguard Trust Semantics */}
        <div className="bg-muted/40 p-3.5 rounded-md flex gap-2.5">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-label-12 font-semibold text-foreground">Reliable Failover Policy</h4>
            <p className="text-label-12 leading-relaxed text-muted-foreground font-medium">
              If calls to <span className="font-semibold text-foreground">{PROVIDER_NAMES[selectedProvider] || 'Active Provider'}</span> fail, the system logs an audit trail error and halts background research execution. 
              No automatic failover routes credentials or executes queries to alternate providers to guarantee predictable API costs and secure audit-trails.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
