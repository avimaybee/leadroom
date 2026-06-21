'use client';

export function CampaignFilter({ scopes, defaultValue }: { scopes: { id: string; name: string }[]; defaultValue: string }) {
  return (
    <select
      name="campaignId"
      defaultValue={defaultValue}
      className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground"
      onChange={(e) => {
        const form = e.target.closest('form');
        if (form) form.submit();
      }}
    >
      <option value="">All Campaigns / Sources</option>
      {scopes.map(scope => (
        <option key={scope.id} value={scope.id}>{scope.name}</option>
      ))}
    </select>
  );
}
