'use client';

import { useEffect, useState } from 'react';
import { ProspectTable } from './ProspectTable';

interface ProspectBase {
  id: string;
  company: string | null;
  name: string;
  fitScore: number | null;
  confidenceScore: number | null;
  priorityTier: string | null;
  updatedAt: Date | number | null;
}

export function ProspectTableWithSignals({ prospects }: { prospects: ProspectBase[] }) {
  const [signals, setSignals] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = prospects.map(p => p.id);
    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    fetch('/api/prospects/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectIds: ids }),
    })
      .then(res => res.json() as Promise<{ signals?: Record<string, string | null> }>)
      .then(data => {
        setSignals(data.signals || {});
      })
      .catch(() => {
        // Signals are a nice-to-have enhancement
      })
      .finally(() => setLoading(false));
  }, [prospects]);

  const prospectsWithSignals = prospects.map(p => ({
    ...p,
    topSignal: signals[p.id] ?? null,
  }));

  return <ProspectTable prospects={prospectsWithSignals} />;
}
