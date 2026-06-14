'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const US_STATES = [
  'Texas, USA',
  'California, USA',
  'Florida, USA',
  'New York, USA',
  'Illinois, USA',
  'Ohio, USA',
  'Georgia, USA',
  'North Carolina, USA',
  'Michigan, USA',
  'Colorado, USA',
  'Washington, USA',
  'Arizona, USA',
];

export default function NewScopePage() {
  const router = useRouter();
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(20);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) return res.json() as Promise<{ user: { id: string } }>;
        throw new Error('Not logged in');
      })
      .then((data) => {
        setUserId(data.user.id);
      })
      .catch((err) => {
        console.error(err);
        setError('Unauthorized. Please log in.');
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche) return;
    if (!userId) {
      setError('Session not loaded. Please try logging in again.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let resolvedLocation = location.trim();
      if (!resolvedLocation) {
        const randomStateIndex = Math.floor(Math.random() * US_STATES.length);
        resolvedLocation = US_STATES[randomStateIndex];
      }

      const formatString = (str: string) =>
        str
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

      const formattedNiche = formatString(niche.trim());
      const formattedLocation = formatString(resolvedLocation);
      const campaignName = `${formattedNiche} in ${formattedLocation}`;

      const scopeRes = await fetch('/api/scopes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          description: `Automated discovery campaign for ${formattedNiche} in ${formattedLocation}`,
          industryFilter: formattedNiche,
          geographyFilter: formattedLocation,
          createdByUserId: userId,
        }),
      });

      if (!scopeRes.ok) {
        const scopeData = await scopeRes.json() as { error?: any };
        const errMsg = typeof scopeData.error === 'string' 
          ? scopeData.error 
          : 'Failed to create campaign. Please check input requirements.';
        throw new Error(errMsg);
      }

      const scopeData = await scopeRes.json() as { data: { id: string } };
      const campaignId = scopeData.data.id;

      const searchRes = await fetch('/api/discovery/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: formattedNiche,
          location: formattedLocation,
          limit,
          scopeId: campaignId,
        }),
      });

      if (!searchRes.ok) {
        console.error('Failed to trigger crawler search immediately.');
      }

      router.push(`/scopes/${campaignId}`);
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'An error occurred while creating campaign.';
      setError(errMsg);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in text-left">
      <div className="space-y-1.5">
        <Link
          href="/scopes"
          className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 transition w-fit py-2.5 pr-4 -my-2.5 -ml-1"
        >
          &larr; Back to Campaigns
        </Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">New Campaign</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure keywords to scan Google Maps and build a campaign workspace.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card p-8 rounded-2xl border border-border shadow-sm space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-sm border border-destructive/20 font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Target Niche / Keyword *</Label>
            <Input
              required
              disabled={submitting}
              type="text"
              placeholder="e.g. Roofers, Dental Clinics, Plumbers"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">
              City &amp; State / Location <span className="text-muted-foreground font-normal lowercase">(optional - defaults to random US state)</span>
            </Label>
            <Input
              disabled={submitting}
              type="text"
              placeholder="e.g. Austin, TX"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Lead Limit</Label>
            <select
              disabled={submitting}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="block w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground"
            >
              <option value={10}>10 Leads</option>
              <option value={20}>20 Leads (Recommended)</option>
              <option value={30}>30 Leads</option>
              <option value={50}>50 Leads</option>
            </select>
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Link
            href="/scopes"
            className="px-5 py-2.5 bg-card text-foreground hover:bg-muted border border-border rounded-xl font-semibold text-sm transition"
          >
            Cancel
          </Link>
          <Button type="submit" disabled={submitting || !userId}>
            {submitting ? 'Creating & Launching Search...' : 'Launch Campaign'}
          </Button>
        </div>
      </form>
    </div>
  );
}
