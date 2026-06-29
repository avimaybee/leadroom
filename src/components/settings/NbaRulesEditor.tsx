'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_NBA_RULES, type NBARule } from '@/services/lead';
import { updateNbaRulesAction, simulateNBARulesAction, type NBAResultWithName } from '@/app/actions/pipeline';
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
  const [simulating, setSimulating] = useState(false);
  const [preview, setPreview] = useState<NBAResultWithName[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const setWeight = (signal: string, weight: number) => {
    setRules((prev) => prev.map((r) => (r.signal === signal ? { ...r, weight } : r)));
  };

  const resetDefaults = () => {
    setRules(DEFAULT_NBA_RULES);
    setPreview(null);
  };

  // Debounced preview refresh every time rules change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSimulating(true);
      const result = await simulateNBARulesAction(JSON.stringify(rules));
      if ('results' in result) {
        setPreview(result.results);
      }
      setSimulating(false);
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rules]);

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
    <div className="space-y-6">
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

      {/* Live Preview Panel */}
      <div className="border border-border rounded-lg bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-label-14 text-foreground font-semibold">Preview: Top Pipeline Actions</span>
          </div>
          {simulating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        {preview && preview.length > 0 ? (
          <div className="space-y-1.5">
            {preview.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-md bg-card border border-border text-label-12">
                <span className="shrink-0 w-5 text-center font-semibold text-muted-foreground">{idx + 1}</span>
                <span className="font-semibold text-foreground min-w-[120px] truncate">{item.leadName}</span>
                <span className="text-muted-foreground flex-1 truncate">{item.action}</span>
                <span className={`shrink-0 font-semibold ${
                  item.priority === 'High' ? 'text-destructive' : item.priority === 'Medium' ? 'text-chart-3' : 'text-muted-foreground'
                }`}>
                  {item.score}
                </span>
              </div>
            ))}
          </div>
        ) : preview && preview.length === 0 ? (
          <p className="text-label-12 text-muted-foreground">No actions triggered for active leads with these weights.</p>
        ) : (
          <p className="text-label-12 text-muted-foreground">Adjust weights above to see the projected impact.</p>
        )}
      </div>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
