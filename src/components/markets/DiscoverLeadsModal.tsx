'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, AlertCircle, Globe, MapPin, Hash } from 'lucide-react';
import { triggerDiscoveryForMarketAction } from '@/app/actions/discovery-market';
import { toast } from 'sonner';

interface DiscoverLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketId: string;
  marketName: string;
  defaultNiche?: string;
  defaultLocation?: string;
  onDiscoveryStarted?: (jobId: string) => void;
}

export function DiscoverLeadsModal({
  isOpen,
  onClose,
  marketId,
  marketName,
  defaultNiche,
  defaultLocation,
  onDiscoveryStarted,
}: DiscoverLeadsModalProps) {
  const [niche, setNiche] = useState(defaultNiche || '');
  const [location, setLocation] = useState(defaultLocation || '');
  const [limit, setLimit] = useState('25');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!niche.trim()) {
      toast.error('Please enter a search niche');
      return;
    }
    if (!location.trim()) {
      toast.error('Please enter a target location');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('marketId', marketId);
      formData.append('niche', niche.trim());
      formData.append('location', location.trim());
      formData.append('limit', limit);

      const result = await triggerDiscoveryForMarketAction(null, formData);

      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        toast.success(`Discovery search started for "${niche}" in "${location}"`);
        if (result.jobId && onDiscoveryStarted) {
          onDiscoveryStarted(result.jobId);
        }
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setNiche(defaultNiche || '');
    setLocation(defaultLocation || '');
    setLimit('25');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border border-border bg-card shadow-2xl rounded-2xl">
        {loading ? (
          <div className="py-16 px-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-16 h-16 bg-primary/10 rounded-full animate-ping duration-1000" />
              <div className="w-12 h-12 bg-primary/15 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-heading-lg font-semibold text-foreground">Discovering leads</h3>
              <p className="text-copy-14 text-muted-foreground">
                Searching Google Maps for &ldquo;{niche}&rdquo; in &ldquo;{location}&rdquo;
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border bg-muted/20 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-heading-lg">Discover Leads</DialogTitle>
                <DialogDescription className="text-label-12 text-muted-foreground">
                  Search Google Maps for new leads in &ldquo;{marketName}&rdquo;
                </DialogDescription>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mx-6 mt-4 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex gap-2.5 items-start text-copy-13">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="leading-tight">{error}</p>
              </div>
            )}

            {/* Form Body */}
            <div className="px-6 py-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-label-14 font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  Target Niche
                </label>
                <p className="text-label-12 text-muted-foreground mb-2">
                  Keywords describing the type of business you are searching for.
                </p>
                <Input
                  placeholder={defaultNiche || 'e.g. SaaS marketing agency'}
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="h-11 text-copy-14"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-label-14 font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  Location
                </label>
                <p className="text-label-12 text-muted-foreground mb-2">
                  City, region, or area to search in.
                </p>
                <Input
                  placeholder={defaultLocation || 'e.g. San Francisco, CA'}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-11 text-copy-14"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-label-14 font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                  Max Results
                </label>
                <p className="text-label-12 text-muted-foreground mb-2">
                  Maximum number of leads to discover (1–200).
                </p>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="h-11 text-copy-14 w-32"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-muted/10 flex items-center justify-between">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                <Search className="w-4 h-4 mr-2" />
                Start Discovery
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
