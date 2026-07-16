'use client';

import { useState, useEffect } from 'react';
import { setActiveProviderForTaskAction } from '@/app/(dashboard)/settings/integrations/actions';
import type { TaskType } from '@/services/integrations';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Settings2, AlertTriangle, ShieldCheck, Brain, Target, PenLine } from 'lucide-react';

interface ProviderConfig {
  provider: string;
  apiKey: string;
  modelName: string;
  isResearchActive: boolean | null;
  isScoringActive: boolean | null;
  isDraftingActive: boolean | null;
}

interface ActiveProviderPickerProps {
  configs: {
    gemini: ProviderConfig | null;
    nvidia: ProviderConfig | null;
    openrouter: ProviderConfig | null;
    groq: ProviderConfig | null;
    aiml: ProviderConfig | null;
    openai: ProviderConfig | null;
    anthropic: ProviderConfig | null;
  };
}

const PROVIDER_NAMES: Record<string, string> = {
  gemini: 'Google Gemini',
  nvidia: 'NVIDIA NIM',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  aiml: 'AI/ML API',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

const TASK_LABELS: Record<TaskType, { label: string; icon: React.ReactNode; description: string }> = {
  research: {
    label: 'Research Engine',
    icon: <Brain className="w-4 h-4" />,
    description: 'Website analysis, company research, pain signal extraction',
  },
  scoring: {
    label: 'Scoring Engine',
    icon: <Target className="w-4 h-4" />,
    description: 'ICP fit scoring, lead prioritization, disqualifier checks',
  },
  drafting: {
    label: 'Drafting Engine',
    icon: <PenLine className="w-4 h-4" />,
    description: 'Outreach draft generation, personalized messaging',
  },
};

function TaskRouterSelector({
  taskType,
  providersWithModels,
  activeProvider,
  onSelect,
  loading,
}: {
  taskType: TaskType;
  providersWithModels: Array<{ key: string; modelName: string }>;
  activeProvider: string | null;
  onSelect: (provider: string) => void;
  loading: boolean;
}) {
  const info = TASK_LABELS[taskType];

  return (
    <div className="space-y-1.5">
      <Label className="text-label-12 uppercase text-muted-foreground flex items-center gap-1.5">
        {info.icon}
        {info.label}
      </Label>
      <select
        value={activeProvider || ''}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
        className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-copy-14 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground disabled:opacity-50"
      >
        <option value="" className="bg-card text-muted-foreground">-- None (disabled) --</option>
        {providersWithModels.map((p) => (
          <option key={p.key} value={p.key} className="bg-card text-foreground">
            {PROVIDER_NAMES[p.key]} ({p.modelName})
          </option>
        ))}
      </select>
      <p className="text-label-12 text-muted-foreground font-medium">{info.description}</p>
    </div>
  );
}

function getActiveProviderForTask(
  configs: ActiveProviderPickerProps['configs'],
  field: 'isResearchActive' | 'isScoringActive' | 'isDraftingActive'
): string | null {
  for (const [key, config] of Object.entries(configs)) {
    if (config && config[field]) return key;
  }
  return null;
}

export function ActiveProviderPicker({ configs }: ActiveProviderPickerProps) {
  const [researchProvider, setResearchProvider] = useState<string>('');
  const [scoringProvider, setScoringProvider] = useState<string>('');
  const [draftingProvider, setDraftingProvider] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const configuredProviders = Object.entries(configs)
    .filter(([_, config]) => config && config.apiKey)
    .map(([provider]) => provider);

  useEffect(() => {
    setResearchProvider(getActiveProviderForTask(configs, 'isResearchActive') || '');
    setScoringProvider(getActiveProviderForTask(configs, 'isScoringActive') || '');
    setDraftingProvider(getActiveProviderForTask(configs, 'isDraftingActive') || '');
  }, [configs]);

  async function handleSaveRouting() {
    setLoading(true);
    setMessage(null);

    const tasks: Array<{ provider: string; taskType: TaskType }> = [];

    if (researchProvider) tasks.push({ provider: researchProvider, taskType: 'research' });
    if (scoringProvider) tasks.push({ provider: scoringProvider, taskType: 'scoring' });
    if (draftingProvider) tasks.push({ provider: draftingProvider, taskType: 'drafting' });

    for (const { provider, taskType } of tasks) {
      const res = await setActiveProviderForTaskAction(provider, taskType);
      if (res.error) {
        setMessage({ type: 'error', text: `Failed to set ${TASK_LABELS[taskType].label}: ${res.error}` });
        setLoading(false);
        return;
      }
    }

    setMessage({ type: 'success', text: 'Task routing configuration saved.' });
    setLoading(false);
  }

  if (configuredProviders.length === 0) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 text-destructive p-5 flex flex-col gap-3 rounded-xl shadow-sm">
        <div className="font-semibold flex items-center gap-2 text-label-14">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          No AI Providers Configured
        </div>
        <p className="text-label-12 leading-relaxed font-semibold text-destructive/90">
          Configure at least one AI provider below before setting up task routing.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border border-border shadow-sm overflow-hidden bg-card">
      <CardHeader className="border-b border-border bg-muted/20 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-heading-xl font-semibold">Task-Based AI Routing</CardTitle>
            <CardDescription className="text-label-12 font-semibold">
              Route different AI workloads to different providers. Research tasks use one model, scoring uses another, and drafting uses a third.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TaskRouterSelector
            taskType="research"
            providersWithModels={configuredProviders.map((k) => ({
              key: k,
              modelName: configs[k as keyof typeof configs]?.modelName || '?',
            }))}
            activeProvider={researchProvider}
            onSelect={setResearchProvider}
            loading={loading}
          />
          <TaskRouterSelector
            taskType="scoring"
            providersWithModels={configuredProviders.map((k) => ({
              key: k,
              modelName: configs[k as keyof typeof configs]?.modelName || '?',
            }))}
            activeProvider={scoringProvider}
            onSelect={setScoringProvider}
            loading={loading}
          />
          <TaskRouterSelector
            taskType="drafting"
            providersWithModels={configuredProviders.map((k) => ({
              key: k,
              modelName: configs[k as keyof typeof configs]?.modelName || '?',
            }))}
            activeProvider={draftingProvider}
            onSelect={setDraftingProvider}
            loading={loading}
          />
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-border/80 mt-2 gap-4">
          <div className="flex items-center gap-1.5 text-label-12 font-semibold text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Same provider can be used for multiple tasks</span>
          </div>

          <Button onClick={handleSaveRouting} disabled={loading} size="sm">
            {loading ? 'Saving...' : 'Save Routing'}
          </Button>
        </div>

        <div className="bg-muted/40 p-3.5 rounded-md flex gap-2.5">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-label-12 font-semibold text-foreground">Failover Policy</h4>
            <p className="text-label-12 leading-relaxed text-muted-foreground font-medium">
              If the assigned provider for a task fails, the system logs the error and halts execution.
              No automatic failover routes to alternate providers, guaranteeing predictable API costs.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}