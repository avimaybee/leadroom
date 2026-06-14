'use client';

import ReactMarkdown from 'react-markdown';
import { AlertTriangle, Loader2, ExternalLink, FileText } from 'lucide-react';
import { ResearchSnapshot } from './types';
import { formatUTC } from '@/lib/date';
import { Button } from '@/components/ui/button';

interface ResearchDisplayProps {
  initialSnapshot: ResearchSnapshot;
  jobError: string | null;
  activeTab: 'overview' | 'audit' | 'opportunity';
  setActiveTab: (tab: 'overview' | 'audit' | 'opportunity') => void;
  onEnrich: () => void;
  onEdit: () => void;
  isEnriching?: boolean;
}

export function ResearchDisplay({
  initialSnapshot,
  jobError,
  activeTab,
  setActiveTab,
  onEnrich,
  onEdit,
  isEnriching = false,
}: ResearchDisplayProps) {
  const getConfidenceColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'HIGH':
        return 'bg-chart-2/10 text-chart-2 border border-chart-2/20';
      case 'MEDIUM':
        return 'bg-chart-5/10 text-chart-5 border border-chart-5/20';
      case 'LOW':
        return 'bg-destructive/10 text-destructive border border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const parseSources = (sourcesStr: string | null): string[] => {
    if (!sourcesStr) return [];
    try {
      return JSON.parse(sourcesStr);
    } catch {
      return [];
    }
  };

  const sourcesList = parseSources(initialSnapshot.sources);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden animate-fade-in">
      {jobError && (
        jobError.includes('429') ? (
          <div className="bg-chart-5/10 border-b border-chart-5/20 text-chart-5 p-3 text-xs font-semibold text-center flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Cloudflare Browser Run limit exceeded. You can manually edit the research below.
          </div>
        ) : (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive p-3 text-xs font-semibold text-center flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            {jobError}
          </div>
        )
      )}
      {/* Header */}
      <div className="p-5 border-b border-border flex flex-wrap justify-between items-center gap-3 bg-muted/40">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-foreground">Research snapshot</h4>
            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold uppercase ${getConfidenceColor(initialSnapshot.confidenceLevel)}`}>
              {initialSnapshot.confidenceLevel} Confidence
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5">
            Origin: {initialSnapshot.origin} &bull; Updated: {formatUTC(initialSnapshot.updatedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onEnrich} disabled={isEnriching} size="sm">
            {isEnriching ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Enriching...</>
            ) : 'Re-Enrich'}
          </Button>
          <Button onClick={onEdit} variant="outline" size="sm">
            Edit Notes
          </Button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-border px-5">
        {(['overview', 'audit', 'opportunity'] as const).map((tab) => (
          <Button
            key={tab}
            onClick={() => setActiveTab(tab)}
            variant="ghost"
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition rounded-none ${
              activeTab === tab
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'overview' ? 'Company Overview' : tab === 'audit' ? 'Branding & Audit' : 'Pitch Hypothesis'}
          </Button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-card-foreground block">Company Summary</span>
              <p className="text-xs text-foreground font-medium leading-relaxed bg-muted/50 p-4 rounded-xl border border-border/50">
                {initialSnapshot.companySummary || 'No summary registered yet.'}
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold text-card-foreground block">Products & Services</span>
              <p className="text-xs text-foreground font-medium leading-relaxed bg-muted/50 p-4 rounded-xl border border-border/50">
                {initialSnapshot.productsServicesSummary || 'No products/services list registered yet.'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-card-foreground block">Digital Presence</span>
              <p className="text-xs text-foreground font-medium leading-relaxed bg-muted/50 p-4 rounded-xl border border-border/50 h-full">
                {initialSnapshot.digitalPresenceNotes || 'No notes.'}
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold text-card-foreground block">Website Critique</span>
              <p className="text-xs text-foreground font-medium leading-relaxed bg-muted/50 p-4 rounded-xl border border-border/50 h-full">
                {initialSnapshot.websiteNotes || 'No notes.'}
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold text-card-foreground block">Branding Observations</span>
              <p className="text-xs text-foreground font-medium leading-relaxed bg-muted/50 p-4 rounded-xl border border-border/50 h-full">
                {initialSnapshot.brandingNotes || 'No notes.'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'opportunity' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-card-foreground block">Potential Pain Points</span>
              <div className="text-xs text-foreground font-medium leading-relaxed bg-muted/50 p-4 rounded-xl border border-border/50 prose-markdown">
                {initialSnapshot.painPointsHypotheses ? (
                  <ReactMarkdown>{initialSnapshot.painPointsHypotheses}</ReactMarkdown>
                ) : (
                  'No hypotheses compiled.'
                )}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold text-card-foreground block">Agency Opportunities</span>
              <div className="text-xs text-foreground font-medium leading-relaxed bg-muted/50 p-4 rounded-xl border border-border/50 prose-markdown">
                {initialSnapshot.opportunityHypotheses ? (
                  <ReactMarkdown>{initialSnapshot.opportunityHypotheses}</ReactMarkdown>
                ) : (
                  'No hypotheses compiled.'
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sources Footer */}
        {sourcesList.length > 0 && (
          <div className="pt-4 border-t border-border">
            <span className="text-xs font-bold text-card-foreground block mb-2">Sources Checked</span>
            <div className="flex flex-wrap gap-2">
              {sourcesList.map((src, i) => {
                const isUrl = (str: string) => {
                  try {
                    const url = new URL(str);
                    return url.protocol === 'http:' || url.protocol === 'https:';
                  } catch {
                    return false;
                  }
                };

                const isValidUrl = isUrl(src);

                if (isValidUrl) {
                  return (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 border border-border/60 text-xs font-bold text-primary transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {src.replace(/https?:\/\/(www\.)?/, '').substring(0, 30)}
                      {src.length > 30 && '...'}
                    </a>
                  );
                } else {
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border/60 text-xs font-bold text-muted-foreground"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {src}
                    </span>
                  );
                }
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
