'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
    // Get current user ID
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
      // 1. Resolve Location (fallback to random US State if empty)
      let resolvedLocation = location.trim();
      if (!resolvedLocation) {
        const randomStateIndex = Math.floor(Math.random() * US_STATES.length);
        resolvedLocation = US_STATES[randomStateIndex];
      }

      // Format niche and location: capitalize first letter of words
      const formatString = (str: string) =>
        str
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

      const formattedNiche = formatString(niche.trim());
      const formattedLocation = formatString(resolvedLocation);

      // 2. Auto-generate Name
      const campaignName = `${formattedNiche} in ${formattedLocation}`;

      // 3. Create Campaign (Scope)
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

      // 4. Immediately trigger discovery search
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
        // We still redirect to the campaign page since it has been created,
        // and they can try running the crawler again or see the error there.
        console.error('Failed to trigger crawler search immediately.');
      }

      // 5. Redirect to Campaign detail view
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
      {/* Back and Breadcrumbs */}
      <div className="space-y-1.5">
        <Link
          href="/scopes"
          className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition w-fit py-2.5 pr-4 -my-2.5 -ml-1"
        >
          &larr; Back to Campaigns
        </Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">New Campaign</h1>
          <p className="text-sm text-slate-500 mt-1">Configure keywords to scan Google Maps and build a campaign workspace.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-5">
          {/* Keyword / Niche */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Niche / Keyword *</label>
            <input
              required
              disabled={submitting}
              type="text"
              placeholder="e.g. Roofers, Dental Clinics, Plumbers"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              City &amp; State / Location <span className="text-slate-400 font-normal lowercase">(optional - defaults to random US state)</span>
            </label>
            <input
              disabled={submitting}
              type="text"
              placeholder="e.g. Austin, TX"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Limit */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lead Limit</label>
            <select
              disabled={submitting}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="block w-full rounded-xl border border-slate-200 py-3 px-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
            >
              <option value={10}>10 Leads</option>
              <option value={20}>20 Leads (Recommended)</option>
              <option value={30}>30 Leads</option>
              <option value={50}>50 Leads</option>
            </select>
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
          <Link
            href="/scopes"
            className="px-5 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !userId}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-md shadow-indigo-600/10 disabled:opacity-50 hover:scale-[1.01]"
          >
            {submitting ? 'Creating & Launching Search...' : 'Launch Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}
