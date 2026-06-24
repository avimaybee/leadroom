'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DEFAULT_NBA_RULES, type NBARule } from '@/services/lead';
import { updateNbaRulesAction } from '@/app/actions/pipeline';
import { useRouter } from 'next/navigation';

const SIGNAL_LABELS: Record<string, string> = {
  overdue_task: 'Overdue task',
  future_task: 'Future task',
  stale: 'Stale lead',
  unsent_draft: 'Unsent draft',
  no_research: 'No research',
  no_audit: 'No audit',
  unread: 'Unread lead',
};

interface Props {
  initialRules?: NBARule[];
}

export function NbaRulesEditor({ initialRules }: Props) {
  const [rules, setRules] = useState<NBARule[]>(initialRules ?? DEFAULT_NBA_RULES);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const setWeight = (signal: string, weight: number) => {
    setRules((prev) => prev.map((r) => (r.signal === signal ? { ...r, weight } : r)));
  };

  const resetDefaults = () => {
    setRules(DEFAULT_NBA_RULES);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('nbaRules', JSON.stringify(rules));
      const result = await updateNbaRulesAction(null, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('NBA rules saved');
        router.refresh();
      }
    } catch {
      toast.error('Failed to save NBA rules');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-copy-14 text-muted-foreground">
          Configure which signals influence next-action recommendations. Higher weight = more influence.
        </p>
        <Button variant="ghost" size="xs" onClick={resetDefaults}>
          Reset to defaults
        </Button>
      </div>

      <div className="space-y-1 divide-y divide-border/50">
        {rules.map((rule) => (
          <div key={rule.signal} className="flex items-center gap-4 py-2.5 group">
            <span className="text-copy-14 w-28 shrink-0 text-foreground">{SIGNAL_LABELS[rule.signal] || rule.signal}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={rule.weight}
              onChange={(e) => setWeight(rule.signal, Number(e.target.value))}
              className="flex-1 h-2 accent-primary cursor-pointer"
            />
            <span className="text-label-14 w-10 text-right font-semibold text-foreground">{rule.weight}</span>
            <button
              type="button"
              onClick={() => setWeight(rule.signal, 0)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-label-12 text-muted-foreground hover:text-foreground"
            >
              Zero
            </button>
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
