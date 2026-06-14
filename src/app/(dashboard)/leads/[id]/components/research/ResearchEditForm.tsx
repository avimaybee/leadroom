'use client';

import { ResearchSnapshot } from './types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ResearchEditFormProps {
  leadId: string;
  initialSnapshot: ResearchSnapshot | null;
  formAction: (payload: FormData) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function ResearchEditForm({
  leadId,
  initialSnapshot,
  formAction,
  onCancel,
  onSave
}: ResearchEditFormProps) {
  const sourcesList = initialSnapshot?.sources 
    ? ((): string[] => {
        try {
          return JSON.parse(initialSnapshot.sources);
        } catch {
          return [];
        }
      })() 
    : [];

  return (
    <form
      action={(fd) => {
        formAction(fd);
        onSave();
      }}
      className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-6 animate-fade-in"
    >
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
          <h4 className="text-base font-bold text-foreground">Edit Research Snapshot</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Edit research fields or enrich outcomes manually.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={onCancel} variant="outline" size="sm">
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Save Snapshot
          </Button>
        </div>
      </div>

      <input type="hidden" name="leadId" value={leadId} />

      <div className="grid grid-cols-1 gap-5">
        <div>
          <Label className="text-xs uppercase tracking-wider mb-1.5">Company Summary</Label>
          <Textarea
            name="companySummary"
            defaultValue={initialSnapshot?.companySummary || ''}
            rows={3}
            placeholder="Overview of scale, products, and core business..."
          />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider mb-1.5">Products & Services</Label>
          <Textarea
            name="productsServicesSummary"
            defaultValue={initialSnapshot?.productsServicesSummary || ''}
            rows={3}
            placeholder="What core services or offerings do they focus on?"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider mb-1.5">Digital Footprint Notes</Label>
            <Textarea
              name="digitalPresenceNotes"
              defaultValue={initialSnapshot?.digitalPresenceNotes || ''}
              rows={3}
              placeholder="Social channels, maps, directory profiles..."
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-1.5">Website Critique</Label>
            <Textarea
              name="websiteNotes"
              defaultValue={initialSnapshot?.websiteNotes || ''}
              rows={3}
              placeholder="UX critique, call-to-actions, load speeds..."
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-1.5">Branding Observations</Label>
            <Textarea
              name="brandingNotes"
              defaultValue={initialSnapshot?.brandingNotes || ''}
              rows={3}
              placeholder="Colors, typography quality, brand coherence..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider mb-1.5">Pain Points Hypotheses</Label>
            <Textarea
              name="painPointsHypotheses"
              defaultValue={initialSnapshot?.painPointsHypotheses || ''}
              rows={3}
              placeholder="Potential friction points preventing client conversion..."
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-1.5">Agency Growth Opportunities</Label>
            <Textarea
              name="opportunityHypotheses"
              defaultValue={initialSnapshot?.opportunityHypotheses || ''}
              rows={3}
              placeholder="Pitch hypotheses: how we help them improve or redesign..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider mb-1.5">Sources (one URL per line)</Label>
            <Textarea
              name="sources"
              defaultValue={sourcesList.join('\n')}
              rows={2}
              placeholder="https://example.com"
              className="font-mono"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-1.5">Research Confidence</Label>
            <select
              name="confidenceLevel"
              defaultValue={initialSnapshot?.confidenceLevel || 'MEDIUM'}
              className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="HIGH">High Confidence</option>
              <option value="MEDIUM">Medium Confidence</option>
              <option value="LOW">Low Confidence</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>
        </div>
      </div>
    </form>
  );
}
