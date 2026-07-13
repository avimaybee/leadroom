'use client';

import { ExternalLink, User, ShieldAlert, Sparkles, Phone, Mail, Link2, Clock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatDateTimeUTC } from '@/lib/date';

interface EvidenceInspectorProps {
  researchSnapshot: any;
  auditSnapshot: any;
  contacts: any[];
  leadId: string;
}

export function EvidenceInspector({ researchSnapshot, auditSnapshot, contacts, leadId }: EvidenceInspectorProps) {
  const primaryContact = contacts?.find(c => c.isPrimary) || contacts?.[0];
  const pathname = usePathname();
  const isProspect = pathname.includes('/prospects');
  const basePath = isProspect ? `/prospects/${leadId}` : `/leads/${leadId}`;

  return (
    <div className="bg-muted/10 border border-border/80 rounded-2xl p-4 md:p-5 space-y-5 h-full">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <h3 className="text-label-14 text-foreground uppercase">Evidence Inspector</h3>
        <span className="text-label-12 text-muted-foreground">Active Reference Context</span>
      </div>

      {/* 1. Contact Context */}
      <div className="space-y-2">
        <h4 className="text-label-12 text-muted-foreground uppercase flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-muted-foreground/80" />
          <span>Primary Contact</span>
        </h4>
        {primaryContact ? (
          <div className="bg-card p-3 rounded-xl border border-border/50 text-label-12 space-y-1.5 shadow-sm">
            <div className="font-bold text-foreground text-label-12">{primaryContact.name}</div>
            {primaryContact.role && <div className="text-label-12 text-muted-foreground">{primaryContact.role}</div>}
            <div className="space-y-1 text-muted-foreground/90 font-semibold pt-1 border-t border-border/30 mt-1.5">
              {primaryContact.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-muted-foreground/60" />
                  <span className="truncate">{primaryContact.email}</span>
                </div>
              )}
              {primaryContact.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-muted-foreground/60" />
                  <span>{primaryContact.phone}</span>
                </div>
              )}
              {primaryContact.linkedinUrl && (
                <div className="flex items-center gap-1.5 text-primary hover:underline">
                  <Link2 className="w-3 h-3 text-primary/60" />
                  <a href={primaryContact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="truncate flex items-center gap-0.5">
                    LinkedIn Profile <ExternalLink className="w-2.5 h-2.5 inline" />
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-card/40 p-3 rounded-xl border border-border/40 text-label-12 text-muted-foreground italic text-center font-medium">
            No contacts recorded. Add contacts in Overview.
          </div>
        )}
      </div>

      {/* 2. Outreach Angle & Audit highlights */}
      <div className="space-y-2">
        <h4 className="text-label-12 text-muted-foreground uppercase flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground/80" />
          <span>Audit Weaknesses & Recommended Angle</span>
        </h4>
        {auditSnapshot ? (
          <div className="bg-card p-3 rounded-xl border border-border/50 text-label-12 space-y-2.5 shadow-sm">
            {auditSnapshot.keyWeaknesses && (
              <div className="space-y-0.5">
                <span className="text-label-12 text-muted-foreground/80">Observed Weaknesses:</span>
                <p className="text-foreground leading-relaxed text-label-12">{auditSnapshot.keyWeaknesses}</p>
              </div>
            )}
            {auditSnapshot.recommendedImprovements && (
              <div className="space-y-0.5 border-t border-border/30 pt-1.5">
                <span className="text-label-12 text-muted-foreground/80">Angle Hypothesis:</span>
                <p className="bg-primary/[0.02] border border-primary/10 p-2 rounded text-primary leading-relaxed text-label-12">
                  {auditSnapshot.recommendedImprovements}
                </p>
              </div>
            )}
            {auditSnapshot.updatedAt && (
              <div className="flex items-center gap-1 text-label-12 text-muted-foreground/70 pt-1 border-t border-border/20 mt-1">
                <Clock className="w-2.5 h-2.5" />
                <span>Audit from {formatDateTimeUTC(auditSnapshot.updatedAt)}</span>
              </div>
            )}
            <div className="text-label-12 pt-1 flex justify-end">
              <Link href={`${basePath}?view=research`} className="text-primary hover:underline flex items-center gap-0.5">
                View Full Audit <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-card/40 p-3 rounded-xl border border-border/40 text-label-12 text-muted-foreground italic text-center font-medium">
            No audit completed yet.
          </div>
        )}
      </div>

      {/* 3. Research Context */}
      <div className="space-y-2">
        <h4 className="text-label-12 text-muted-foreground uppercase flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground/80" />
          <span>Research Snapshot</span>
        </h4>
        {researchSnapshot ? (
          <div className="bg-card p-3 rounded-xl border border-border/50 text-label-12 space-y-2.5 shadow-sm">
            {researchSnapshot.companySummary && (
              <div className="space-y-0.5">
                <span className="text-label-12 text-muted-foreground/80">Company Focus:</span>
                <p className="text-foreground leading-relaxed text-label-12">{researchSnapshot.companySummary}</p>
              </div>
            )}
            {researchSnapshot.painPointsHypotheses && (
              <div className="space-y-0.5 border-t border-border/30 pt-1.5">
                <span className="text-label-12 text-muted-foreground/80">Inferred Pain Points:</span>
                <p className="text-muted-foreground leading-relaxed text-label-12">{researchSnapshot.painPointsHypotheses}</p>
              </div>
            )}
            {researchSnapshot.updatedAt && (
              <div className="flex items-center gap-1 text-label-12 text-muted-foreground/70 pt-1 border-t border-border/20 mt-1">
                <Clock className="w-2.5 h-2.5" />
                <span>Research from {formatDateTimeUTC(researchSnapshot.updatedAt)}</span>
              </div>
            )}
            <div className="text-label-12 pt-1 flex justify-end">
              <Link href={`${basePath}?view=research`} className="text-primary hover:underline flex items-center gap-0.5">
                View Research Workspace <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-card/40 p-3 rounded-xl border border-border/40 text-label-12 text-muted-foreground italic text-center font-medium">
            No research snapshot available.
          </div>
        )}
      </div>
    </div>
  );
}
