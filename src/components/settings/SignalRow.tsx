'use client';

import { X, GripVertical } from 'lucide-react';

interface SignalRowProps {
  name: string;
  weight: number;
  description: string;
  type: 'positive' | 'negative';
  onChange: (field: 'name' | 'weight' | 'description', value: string | number) => void;
  onRemove: () => void;
}

export function SignalRow({ name, weight, description, type, onChange, onRemove }: SignalRowProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Signal name"
            className="flex-1 h-10 rounded-md border border-border bg-background px-3 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-0"
          />
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-label-12 text-muted-foreground">Weight:</label>
            <input
              type="range"
              min={1}
              max={10}
              value={weight}
              onChange={(e) => { const v = parseInt(e.target.value); onChange('weight', isNaN(v) ? 0 : v); }}
              className="w-20 accent-primary"
            />
            <span className="text-label-14 font-semibold text-foreground w-4 text-right">{weight}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <textarea
        value={description}
        onChange={(e) => onChange('description', e.target.value)}
        placeholder="Describe what this signal looks like in practice..."
        rows={2}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
      />
    </div>
  );
}
