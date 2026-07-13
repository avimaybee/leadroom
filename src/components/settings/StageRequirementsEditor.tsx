'use client';

import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PIPELINE_STAGES } from '@/services/lead';
import { saveStageRequirementsAction } from '@/app/actions/pipeline';

interface Props {
  initialRequirements: Record<string, string[]>;
}

const REQUIREMENT_OPTIONS = [
  { value: 'require_research', label: 'Research Snapshot' },
  { value: 'require_audit', label: 'Digital Presence Audit' },
  { value: 'require_draft', label: 'Outreach Draft' },
  { value: 'require_contact_email', label: 'Contact Email' },
];

const STAGES_WITH_REQUIREMENTS = PIPELINE_STAGES.filter(
  (s) => !['New', 'Won', 'Lost'].includes(s),
);

export function StageRequirementsEditor({ initialRequirements }: Props) {
  const [requirements, setRequirements] = useState<Record<string, string[]>>(initialRequirements);
  const [saving, setSaving] = useState(false);

  const toggle = (stage: string, value: string) => {
    setRequirements((prev) => {
      const current = prev[stage] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [stage]: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveStageRequirementsAction(requirements);
    setSaving(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success('Stage requirements saved');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-copy-14 text-muted-foreground mb-4">
        Block stage transitions until certain requirements are met. Only takes effect when moving forward in the pipeline.
      </p>

      <div className="space-y-2">
        {STAGES_WITH_REQUIREMENTS.map((stage) => {
          const selected = requirements[stage] || [];
          return (
            <div key={stage} className="grid grid-cols-[160px_1fr] gap-3 items-start py-2.5 border-b border-border/30 last:border-0">
              <span className="text-label-14 text-foreground font-semibold pt-1">{stage}</span>
              <div className="flex flex-wrap gap-2">
                {REQUIREMENT_OPTIONS.map((opt) => {
                  const isOn = selected.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggle(stage, opt.value)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-label-12 font-semibold border transition-colors ${
                        isOn
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'bg-muted/20 text-muted-foreground border-border hover:bg-muted/40 hover:text-foreground'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                      {opt.label}
                    </button>
                  );
                })}
                {selected.length === 0 && (
                  <span className="text-label-12 text-muted-foreground italic">No requirements</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
        Save Requirements
      </Button>

    </div>
  );
}
