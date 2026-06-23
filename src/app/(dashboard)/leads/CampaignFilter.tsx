'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function CampaignFilter({ scopes, defaultValue }: { scopes: { id: string; name: string }[]; defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={defaultValue}
      className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-copy-14 focus-visible:ring-2 focus-visible:ring-ring text-foreground hover:bg-muted/40 transition-colors outline-none cursor-pointer"
      onChange={(e) => {
        const val = e.target.value;
        const next = new URLSearchParams(searchParams.toString());
        if (val) {
          next.set('campaignId', val);
        } else {
          next.delete('campaignId');
        }
        router.push(`/leads?${next.toString()}`);
      }}
    >
      <option value="">All Campaigns / Sources</option>
      {scopes.map(scope => (
        <option key={scope.id} value={scope.id}>{scope.name}</option>
      ))}
    </select>
  );
}
