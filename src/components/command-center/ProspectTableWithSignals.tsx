'use client';

import { useEffect, useMemo, useState } from 'react';
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

  // Stable key — avoids refetch loop when parent re-creates the array each render.
  const idsKey = useMemo(() => prospects.map(p => p.id).sort().join(','), [prospects]);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',').filter(Boolean) : [];
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
      .catch((err) => console.warn('Failed to fetch signals', err))
      .finally(() => setLoading(false));
  }, [idsKey]);

  const prospectsWithSignals = prospects.map(p => ({
    ...p,
    topSignal: signals[p.id] ?? null,
  }));

  return <ProspectTable prospects={prospectsWithSignals} />;
}
