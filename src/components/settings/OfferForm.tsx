'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { saveOfferAction } from '@/app/actions/strategy';

interface OfferFormProps {
  initialData?: {
    id: string;
    name: string;
    targetPain: string | null;
    desiredOutcome: string | null;
    proofPoints: string | null;
    forbiddenClaims: string | null;
  };
}

export function OfferForm({ initialData }: OfferFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || '');
  const [targetPain, setTargetPain] = useState(initialData?.targetPain || '');
  const [desiredOutcome, setDesiredOutcome] = useState(initialData?.desiredOutcome || '');
  const [proofPoints, setProofPoints] = useState<string[]>(
    initialData?.proofPoints ? JSON.parse(initialData.proofPoints) : []
  );
  const [forbiddenClaims, setForbiddenClaims] = useState<string[]>(
    initialData?.forbiddenClaims ? JSON.parse(initialData.forbiddenClaims) : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProof, setNewProof] = useState('');
  const [newClaim, setNewClaim] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData();
    if (initialData?.id) form.set('id', initialData.id);
    form.set('name', name);
    form.set('targetPain', targetPain);
    form.set('desiredOutcome', desiredOutcome);
    form.set('proofPoints', JSON.stringify(proofPoints));
    form.set('forbiddenClaims', JSON.stringify(forbiddenClaims));

    const result = await saveOfferAction(null, form);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    toast.success('Offer saved');
    router.push('/settings/offer');
  };

  const addProof = () => {
    if (newProof.trim()) {
      setProofPoints([...proofPoints, newProof.trim()]);
      setNewProof('');
    }
  };

  const addClaim = () => {
    if (newClaim.trim()) {
      setForbiddenClaims([...forbiddenClaims, newClaim.trim()]);
      setNewClaim('');
    }
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
        <label className="label-12 uppercase text-muted-foreground block mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. AI Website & Workflow Automation"
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label className="label-12 uppercase text-muted-foreground block mb-1.5">Target Pain</label>
        <textarea
          value={targetPain}
          onChange={(e) => setTargetPain(e.target.value)}
          rows={3}
          placeholder="What problem does your offer solve?"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      <div>
        <label className="label-12 uppercase text-muted-foreground block mb-1.5">Desired Outcome</label>
        <textarea
          value={desiredOutcome}
          onChange={(e) => setDesiredOutcome(e.target.value)}
          rows={3}
          placeholder="What results do prospects achieve?"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      <div>
        <label className="label-12 uppercase text-muted-foreground block mb-1.5">Proof Points</label>
        <p className="text-copy-14 text-muted-foreground mb-2">Specific results or case studies that build credibility.</p>
        <div className="space-y-2">
          {proofPoints.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-copy-14 bg-muted/30 rounded-md px-3 py-2">{p}</span>
              <button
                type="button"
                onClick={() => setProofPoints(proofPoints.filter((_, j) => j !== i))}
                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newProof}
              onChange={(e) => setNewProof(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addProof())}
              placeholder="Add a proof point..."
              className="flex-1 h-10 rounded-md border border-border bg-background px-3 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={addProof}
              className="inline-flex items-center gap-1 h-10 px-3 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="label-12 uppercase text-muted-foreground block mb-1.5">Forbidden Claims</label>
        <p className="text-copy-14 text-muted-foreground mb-2">
          These claims trigger risk flags in generated outreach.
        </p>
        <div className="space-y-2">
          {forbiddenClaims.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-copy-14 bg-muted/30 rounded-md px-3 py-2">{c}</span>
              <button
                type="button"
                onClick={() => setForbiddenClaims(forbiddenClaims.filter((_, j) => j !== i))}
                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newClaim}
              onChange={(e) => setNewClaim(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addClaim())}
              placeholder="Add a forbidden claim..."
              className="flex-1 h-10 rounded-md border border-border bg-background px-3 text-copy-14 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={addClaim}
              className="inline-flex items-center gap-1 h-10 px-3 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : initialData ? 'Save Offer' : 'Create Offer'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/settings/offer')}
          className="inline-flex items-center h-10 px-5 rounded-md border border-border text-label-14 hover:bg-muted/50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
