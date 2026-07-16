'use client';

// TODO(22.8): Migrate generic error banner to per-field error display
// TODO(22.9): Preserve form field values on validation error (use defaultValue or keep state)
// TODO(22.15): Add optimistic UI update on save for instant feedback
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { saveMarketAction, listOffersAction, listICPProfilesAction } from '@/app/actions/strategy';

interface MarketFormProps {
  initialData?: {
    id: string;
    name: string;
    icpProfileId: string | null;
    offerId: string | null;
    status: string | null;
  };
}

export function MarketForm({ initialData }: MarketFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || '');
  const [offerId, setOfferId] = useState(initialData?.offerId || '');
  const [icpProfileId, setIcpProfileId] = useState(initialData?.icpProfileId || '');
  const [status, setStatus] = useState(initialData?.status || 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listOffersAction(),
      listICPProfilesAction(),
    ]).then(([offersRes, profilesRes]) => {
      if (offersRes.success) setOffers(offersRes.offers);
      if (profilesRes.success) setProfiles(profilesRes.profiles);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData();
    if (initialData?.id) form.set('id', initialData.id);
    form.set('name', name);
    form.set('offerId', offerId);
    form.set('icpProfileId', icpProfileId);
    form.set('status', status);

    const result = await saveMarketAction(null, form);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    toast.success('Market saved');
    router.push('/settings/market');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="text-copy-14">{error}</span>
        </div>
      )}

      <div>
        <label className="text-label-12 uppercase text-muted-foreground block mb-1.5">Market Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. D2C & Local Service Businesses"
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label className="text-label-12 uppercase text-muted-foreground block mb-1.5">Linked Offer</label>
        {loading ? (
          <div className="h-10 rounded-md bg-muted animate-pulse" />
        ) : offers.length === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-md bg-chart-5/10 border border-chart-5/20">
            <TriangleAlert className="w-4 h-4 text-chart-5 shrink-0" />
            <div>
              <p className="text-copy-14 text-chart-5">No offers yet.</p>
              <a href="/personalisation/offer/new" className="text-label-12 text-primary hover:underline">
                Create one first
              </a>
            </div>
          </div>
        ) : (
          <select
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
            className="w-full h-10 rounded-md border border-border bg-background px-3 text-copy-14 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select an offer...</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="text-label-12 uppercase text-muted-foreground block mb-1.5">Linked Ideal Client</label>
        {loading ? (
          <div className="h-10 rounded-md bg-muted animate-pulse" />
        ) : profiles.length === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-md bg-chart-5/10 border border-chart-5/20">
            <TriangleAlert className="w-4 h-4 text-chart-5 shrink-0" />
            <div>
              <p className="text-copy-14 text-chart-5">No Ideal Client criteria yet.</p>
              <a href="/personalisation/icp/new" className="text-label-12 text-primary hover:underline">
                Create one first
              </a>
            </div>
          </div>
        ) : (
          <select
            value={icpProfileId}
            onChange={(e) => setIcpProfileId(e.target.value)}
            className="w-full h-10 rounded-md border border-border bg-background px-3 text-copy-14 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select an Ideal Client...</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="text-label-12 uppercase text-muted-foreground block mb-1.5">Status</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStatus('active')}
            className={`flex-1 h-10 rounded-md border text-label-14 transition-colors ${
              status === 'active'
                ? 'bg-chart-2/10 border-chart-2/30 text-chart-2 font-semibold'
                : 'border-border text-muted-foreground hover:bg-muted/30'
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setStatus('paused')}
            className={`flex-1 h-10 rounded-md border text-label-14 transition-colors ${
              status === 'paused'
                ? 'bg-chart-5/10 border-chart-5/30 text-chart-5 font-semibold'
                : 'border-border text-muted-foreground hover:bg-muted/30'
            }`}
          >
            Paused
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : initialData ? 'Save Market' : 'Create Market'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/settings/market')}
          className="inline-flex items-center h-10 px-5 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
