'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { saveICPProfileAction } from '@/app/actions/strategy';
import { SignalRow } from './SignalRow';
import { ScoringPreview } from './ScoringPreview';
import type { IcpSignalDef } from '@/lib/domain/scoring';

interface IcpFormProps {
  initialData?: {
    id: string;
    name: string;
    positiveSignals: string | null;
    negativeSignals: string | null;
    disqualifiers: string | null;
  };
}

export function IcpForm({ initialData }: IcpFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || '');
  const [positiveSignals, setPositiveSignals] = useState<IcpSignalDef[]>(
    initialData?.positiveSignals ? JSON.parse(initialData.positiveSignals) : []
  );
  const [negativeSignals, setNegativeSignals] = useState<IcpSignalDef[]>(
    initialData?.negativeSignals ? JSON.parse(initialData.negativeSignals) : []
  );
  const [disqualifiers, setDisqualifiers] = useState<string[]>(
    initialData?.disqualifiers ? JSON.parse(initialData.disqualifiers) : []
  );
  const [newDisq, setNewDisq] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSignal = (type: 'positive' | 'negative') => {
    const signal: IcpSignalDef = { name: '', weight: 5, description: '' };
    if (type === 'positive') {
      setPositiveSignals([...positiveSignals, signal]);
    } else {
      setNegativeSignals([...negativeSignals, signal]);
    }
  };

  const updateSignal = (
    signals: IcpSignalDef[],
    setter: (v: IcpSignalDef[]) => void,
    index: number,
    field: 'name' | 'weight' | 'description',
    value: string | number
  ) => {
    const updated = signals.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    setter(updated);
  };

  const removeSignal = (signals: IcpSignalDef[], setter: (v: IcpSignalDef[]) => void, index: number) => {
    setter(signals.filter((_, i) => i !== index));
  };

  const addDisqualifier = () => {
    if (newDisq.trim()) {
      setDisqualifiers([...disqualifiers, newDisq.trim()]);
      setNewDisq('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData();
    if (initialData?.id) form.set('id', initialData.id);
    form.set('name', name);
    form.set('positiveSignals', JSON.stringify(positiveSignals));
    form.set('negativeSignals', JSON.stringify(negativeSignals));
    form.set('disqualifiers', JSON.stringify(disqualifiers));

    const result = await saveICPProfileAction(null, form);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    toast.success('ICP profile saved');
    router.push('/settings/icp');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="text-copy-14">{error}</span>
        </div>
      )}

      <div>
        <label className="label-12 uppercase text-muted-foreground block mb-1.5">Profile Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Growth-Stage B2B with Outdated Web Presence"
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="border-b border-border pb-6 mb-6">
        <label className="label-12 uppercase text-muted-foreground block mb-1">Positive Signals</label>
        <p className="text-copy-14 text-muted-foreground mb-3">
          Signals that increase fit score when found.
        </p>
        <div className="space-y-3">
          {positiveSignals.map((signal, i) => (
            <SignalRow
              key={i}
              {...signal}
              type="positive"
              onChange={(field, value) => updateSignal(positiveSignals, setPositiveSignals, i, field, value)}
              onRemove={() => removeSignal(positiveSignals, setPositiveSignals, i)}
            />
          ))}
          <button
            type="button"
            onClick={() => addSignal('positive')}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-dashed border-border text-label-14 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Signal
          </button>
        </div>
      </div>

      <div className="border-b border-border pb-6 mb-6">
        <label className="label-12 uppercase text-muted-foreground block mb-1">Negative Signals</label>
        <p className="text-copy-14 text-muted-foreground mb-3">
          Signals that subtract from fit score when found.
        </p>
        <div className="space-y-3">
          {negativeSignals.map((signal, i) => (
            <SignalRow
              key={i}
              {...signal}
              type="negative"
              onChange={(field, value) => updateSignal(negativeSignals, setNegativeSignals, i, field, value)}
              onRemove={() => removeSignal(negativeSignals, setNegativeSignals, i)}
            />
          ))}
          <button
            type="button"
            onClick={() => addSignal('negative')}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-dashed border-border text-label-14 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Signal
          </button>
        </div>
      </div>

      <div className="border-b border-border pb-6 mb-6">
        <label className="label-12 uppercase text-muted-foreground block mb-1">Hard Disqualifiers</label>
        <p className="text-copy-14 text-muted-foreground mb-3">
          If any disqualifier matches, the prospect is excluded regardless of other signals.
        </p>
        <div className="space-y-2">
          {disqualifiers.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-copy-14 bg-muted/30 rounded-md px-3 py-2">{d}</span>
              <button
                type="button"
                onClick={() => setDisqualifiers(disqualifiers.filter((_, j) => j !== i))}
                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newDisq}
              onChange={(e) => setNewDisq(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDisqualifier())}
              placeholder="Add a disqualifier..."
              className="flex-1 h-10 rounded-md border border-border bg-background px-3 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={addDisqualifier}
              className="inline-flex items-center gap-1 h-10 px-3 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      <ScoringPreview
        positiveSignals={positiveSignals}
        negativeSignals={negativeSignals}
        disqualifiers={disqualifiers}
      />

      <div className="flex gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : initialData ? 'Save ICP Profile' : 'Create ICP Profile'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/settings/icp')}
          className="inline-flex items-center h-10 px-5 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
