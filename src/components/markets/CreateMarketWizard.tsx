'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, ArrowLeft, Target, Sparkles, AlertCircle, Radar, MapPin, Hash } from 'lucide-react';
import { createMarketWithWizardAction } from '@/app/actions/strategy';
import { toast } from 'sonner';

interface CreateMarketWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateMarketWizard({ isOpen, onClose }: CreateMarketWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [marketName, setMarketName] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [icpDescription, setIcpDescription] = useState('');

  // Automatic discovery state
  const [runDiscovery, setRunDiscovery] = useState(true);
  const [discoveryNiche, setDiscoveryNiche] = useState('');
  const [discoveryLocation, setDiscoveryLocation] = useState('');
  const [discoveryLimit, setDiscoveryLimit] = useState('25');

  // Loading phase messages for micro-interactions
  const [loadingPhase, setLoadingPhase] = useState('Positioning offer...');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const nextStep = () => {
    if (step === 1 && !marketName.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (step === 2 && !offerDescription.trim()) {
      toast.error('Please describe what you sell');
      return;
    }
    if (step === 3 && !icpDescription.trim()) {
      toast.error('Please describe your ideal customer');
      return;
    }
    if (step === 3) {
      setDiscoveryNiche(marketName.trim());
    }
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    // Dynamic loading text transition
    const phases = [
      'Configuring campaign framework...',
      'Drafting offer & target pain signals...',
      'Synthesizing ideal client criteria...',
      'Assembling grading matrices...',
    ];
    let phaseIndex = 0;
    intervalRef.current = setInterval(() => {
      if (phaseIndex < phases.length - 1) {
        phaseIndex++;
        setLoadingPhase(phases[phaseIndex]);
      }
    }, 2000);

    try {
      const formData = new FormData();
      formData.append('marketName', marketName);
      formData.append('offerDescription', offerDescription);
      formData.append('icpDescription', icpDescription);

      if (runDiscovery) {
        formData.append('runDiscovery', 'on');
        formData.append('discoveryNiche', discoveryNiche.trim() || marketName.trim());
        formData.append('discoveryLocation', discoveryLocation.trim());
        formData.append('discoveryLimit', discoveryLimit);
      }

      const result = await createMarketWithWizardAction(null, formData);

      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        toast.success('Market campaign built successfully!');
        onClose();
        // Redirect to the market's prospects page, showing live scan progress when discovery was auto-started
        const query = result.jobId ? `?jobId=${result.jobId}` : '';
        router.push(`/markets/${result.marketId}/prospects${query}`);
      }
    } catch (err: unknown) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return; // Prevent closing while generating
    setStep(1);
    setMarketName('');
    setOfferDescription('');
    setIcpDescription('');
    setDiscoveryNiche('');
    setDiscoveryLocation('');
    setDiscoveryLimit('25');
    setRunDiscovery(true);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border border-border bg-card shadow-2xl rounded-2xl">
        {loading ? (
          <div className="py-20 px-8 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 h-20 bg-primary/10 rounded-full animate-ping duration-1000" />
              <div className="w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-heading-lg font-semibold text-foreground">AI is building your campaign</h3>
              <p className="text-copy-14 text-muted-foreground animate-pulse">{loadingPhase}</p>
              {runDiscovery && (
                <p className="text-label-12 text-muted-foreground">
                  Lead discovery will start automatically when setup completes.
                </p>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border bg-muted/20 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-heading-lg">Create Market Campaign</DialogTitle>
                <DialogDescription className="text-label-12 text-muted-foreground">
                  Step {step} of 4 • AI Strategy Generator
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

            {/* Step Body */}
            <div className="px-6 py-6 min-h-[220px] flex flex-col justify-center">
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-label-14 font-semibold text-foreground">Campaign Name</label>
                    <p className="text-label-12 text-muted-foreground">
                      Give this target segment or niche a descriptive name.
                    </p>
                  </div>
                  <Input
                    placeholder="e.g. US B2B SaaS Series-A"
                    value={marketName}
                    onChange={(e) => setMarketName(e.target.value)}
                    className="h-11 text-copy-14"
                    autoFocus
                  />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-label-14 font-semibold text-foreground">What are you selling?</label>
                    <p className="text-label-12 text-muted-foreground">
                      Describe your service, value proposition, and the main problem you solve.
                    </p>
                  </div>
                  <Textarea
                    placeholder="e.g. We provide custom web application development subscriptions for $8k/mo, helping funded SaaS startups ship new product lines without hiring full-time developers."
                    value={offerDescription}
                    onChange={(e) => setOfferDescription(e.target.value)}
                    className="min-h-[120px] text-copy-14 resize-none leading-relaxed"
                    autoFocus
                  />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-label-14 font-semibold text-foreground">Who is your ideal client?</label>
                    <p className="text-label-12 text-muted-foreground">
                      Describe the companies you want to target, positive signals to look for, and any disqualifiers.
                    </p>
                  </div>
                  <Textarea
                    placeholder="e.g. We target Series-A B2B SaaS companies in North America. Look for companies actively hiring engineers or complaining about shipping velocity. Disqualify them if they are agencies, consultancies, or have fewer than 15 employees."
                    value={icpDescription}
                    onChange={(e) => setIcpDescription(e.target.value)}
                    className="min-h-[120px] text-copy-14 resize-none leading-relaxed"
                    autoFocus
                  />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  {/* Toggle */}
                  <label className="flex items-start gap-3 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={runDiscovery}
                      onChange={(e) => setRunDiscovery(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                    <div>
                      <span className="text-label-14 font-semibold text-foreground flex items-center gap-1.5 group-hover:text-primary transition-colors">
                        <Radar className="w-4 h-4 text-primary" />
                        Automatically discover leads
                      </span>
                      <p className="text-label-12 text-muted-foreground mt-0.5 leading-normal">
                        Right after the campaign is built, Leadroom scans Google Maps for matching businesses and queues
                        them in the review inbox. No manual step needed.
                      </p>
                    </div>
                  </label>

                  {runDiscovery && (
                    <div className="space-y-4 bg-muted/20 border border-border/60 rounded-xl p-4">
                      <div className="space-y-1.5">
                        <label className="text-label-14 font-semibold text-foreground flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-muted-foreground" />
                          Search Niche
                        </label>
                        <Input
                          placeholder="e.g. SaaS marketing agencies"
                          value={discoveryNiche}
                          onChange={(e) => setDiscoveryNiche(e.target.value)}
                          className="h-11 text-copy-14"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-label-14 font-semibold text-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                          Location
                        </label>
                        <Input
                          placeholder="e.g. Austin, TX (optional)"
                          value={discoveryLocation}
                          onChange={(e) => setDiscoveryLocation(e.target.value)}
                          className="h-11 text-copy-14"
                        />
                        <p className="text-label-12 text-muted-foreground">
                          Leave blank to scan a random US state.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-label-14 font-semibold text-foreground flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                          Lead Limit
                        </label>
                        <select
                          value={discoveryLimit}
                          onChange={(e) => setDiscoveryLimit(e.target.value)}
                          className="flex h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-copy-14 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground hover:bg-muted/40 cursor-pointer"
                        >
                          <option value={5}>5 leads</option>
                          <option value={10}>10 leads</option>
                          <option value={25}>25 leads (Recommended)</option>
                          <option value={50}>50 leads</option>
                          <option value={100}>100 leads</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-muted/10 flex items-center justify-between">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={prevStep}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <Button type="button" onClick={nextStep}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Campaign
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
