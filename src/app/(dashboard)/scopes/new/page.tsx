'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useDebounce } from '@/lib/use-debounce';
import { Percent, TrendingUp, Sparkles, AlertTriangle } from 'lucide-react';

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
  const [autoResearch, setAutoResearch] = useState(true);
  const [debouncedNiche] = useDebounce(niche, 500);
  const [debouncedLocation] = useDebounce(location, 500);
  const [metrics, setMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    if (debouncedNiche && debouncedLocation) {
      setLoadingMetrics(true);
      fetch(`/api/market-metrics?niche=${encodeURIComponent(debouncedNiche)}&location=${encodeURIComponent(debouncedLocation)}`)
        .then(res => res.json())
        .then((data: any) => {
          if (data.data) {
            setMetrics(data.data);
          }
        })
        .finally(() => setLoadingMetrics(false));
    } else {
      setMetrics(null);
    }
  }, [debouncedNiche, debouncedLocation]);

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
          autoResearchPromotedLeads: autoResearch,
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

  // Dynamic campaign name generation for launch summary
  const generatedCampaignName = `${niche.trim() || '[Keyword]'} in ${location.trim() || '[Location (defaults to random state)]'}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in text-left">
      {/* Page Header */}
      <header className="space-y-4 border-b border-border/70 pb-6">
        <nav className="flex items-center gap-2 text-copy-14 text-muted-foreground">
          <Link href="/scopes" className="hover:text-foreground transition-colors">Campaigns</Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="font-medium text-foreground">New Campaign</span>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-heading-3xl text-card-foreground">New Campaign</h1>
            <p className="text-copy-14 text-muted-foreground mt-1.5 leading-relaxed">
              Configure keyword parameters to scan Google Maps, discover local businesses, and automatically build a campaign review backlog.
            </p>
          </div>
        </div>
      </header>

      {/* Campaign guided intake form */}
      <form onSubmit={handleSubmit} className="bg-card p-6 md:p-8 rounded-2xl border border-border/80 shadow-sm space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-label-12 border border-destructive/20 leading-relaxed">
            {error}
          </div>
        )}

        {/* Section 1: Basics */}
        <div className="space-y-4">
          <h3 className="text-label-14 text-muted-foreground uppercase border-b border-border pb-1">
            Campaign Basics
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="campaign-niche" className="text-label-12 mb-1.5 block">Target Niche / Keyword *</Label>
              <Input
                required
                id="campaign-niche"
                disabled={submitting}
                type="text"
                placeholder="e.g. Roofers, Dental Clinics, Plumbers"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="campaign-loc" className="text-label-12 mb-1.5 block">
                Target Location (City, Zip Code, Suburb)
              </Label>
              <Input
                id="campaign-loc"
                disabled={submitting}
                type="text"
                placeholder="e.g. Austin, TX (optional)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <p className="text-label-12 text-muted-foreground mt-1 leading-normal">
                If left blank, a random US state will be automatically chosen (e.g. Texas, California, Florida).
              </p>
            </div>

            <div>
              <Label htmlFor="campaign-limit" className="text-label-12 mb-1.5 block">Lead Limit</Label>
              <select
                id="campaign-limit"
                disabled={submitting}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="flex h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-copy-14 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground hover:bg-muted/40 cursor-pointer"
              >
                <option value={1}>1 prospect</option>
                <option value={5}>5 prospects</option>
                <option value={10}>10 prospects</option>
                <option value={20}>20 prospects (Recommended)</option>
                <option value={30}>30 prospects</option>
                <option value={50}>50 prospects</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Market Support Guidance (Optional / Secondary) */}
        {metrics && (
          <div className="space-y-3 pt-3 border-t border-border/50">
            <h4 className="text-label-14 uppercase text-muted-foreground">Historical Market Performance</h4>
            <div className="bg-muted/30 p-4 rounded-xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h5 className="text-label-12 flex items-center gap-1.5 text-foreground">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                    Segment Stats
                  </h5>
                  <p className="text-label-12 text-muted-foreground mt-0.5">Based on historical campaigns for this keyword.</p>
                </div>
                {metrics.conversionRate !== null ? (
                  <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-label-12 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5" aria-hidden="true" />
                    {metrics.conversionRate.toFixed(1)}% Promoted
                  </span>
                ) : (
                  <span className="text-label-12 text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-md border border-border/50">Insufficient Data</span>
                )}
              </div>

              {metrics.recommendations && metrics.recommendations.length > 0 && (
                <div className="pt-3 border-t border-border/40">
                  <p className="text-label-12 text-foreground mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-chart-5" aria-hidden="true" />
                    Alternatives in {location || 'this geography'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {metrics.recommendations.map((rec: any) => (
                      <button
                        key={rec.niche}
                        type="button"
                        onClick={() => setNiche(rec.niche)}
                        className="text-label-12 px-2 py-0.5 bg-card hover:bg-muted border border-border rounded transition-colors flex items-center gap-1 group"
                      >
                        <span className="text-muted-foreground group-hover:text-primary transition-colors">{rec.niche}</span>
                        <span className="text-[9px] text-muted-foreground/75">({rec.conversionRate.toFixed(1)}%)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 3: Automation Settings */}
        <div className="space-y-4 pt-3 border-t border-border/50">
          <h3 className="text-label-14 text-muted-foreground uppercase border-b border-border pb-1">
            Automation Settings
          </h3>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={autoResearch}
              onChange={(e) => setAutoResearch(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
            />
            <div>
              <span className="text-label-14 text-foreground font-medium group-hover:text-primary transition-colors">
                Auto-research promoted leads
              </span>
              <p className="text-label-12 text-muted-foreground mt-0.5 leading-normal">
                When a candidate is promoted to a lead, automatically queue a research snapshot if the candidate has a website URL.
              </p>
            </div>
          </label>
        </div>

        {/* Dynamic Launch Summary Footer Block */}
        <div className="bg-muted/30 border border-border/80 rounded-xl p-4 text-copy-13 text-muted-foreground leading-relaxed space-y-1">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-chart-5 shrink-0" />
            Launch Action Summary
          </span>
          <p className="text-label-12 text-muted-foreground leading-normal">
            On submit, the system will save a new campaign named <strong className="text-primary font-semibold">"{generatedCampaignName}"</strong> and immediately trigger a crawler scan on Google Maps to gather up to <strong className="text-foreground font-semibold">{limit}</strong> business prospects.
          </p>
        </div>

        {/* Footer actions */}
        <div className="pt-5 border-t border-border/80 flex justify-end gap-3">
          <Link
            href="/scopes"
            className={buttonVariants({ variant: 'outline' })}
          >
            Keep Editing
          </Link>
          <Button type="submit" disabled={submitting || !userId}>
            {submitting ? 'Launching Scan...' : 'Launch Scan'}
          </Button>
        </div>
      </form>
    </div>
  );
}
