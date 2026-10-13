'use client';

interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  industry: string | null;
}

interface ClientLeadProfileProps {
  lead: Lead;
}

export default function ClientLeadProfile({ lead }: ClientLeadProfileProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <span className="block text-label-12 text-muted-foreground uppercase">Contact Name</span>
          <span className="text-copy-14 text-foreground mt-1 block">{lead.name}</span>
        </div>
        <div>
          <span className="block text-label-12 text-muted-foreground uppercase">Company</span>
          <span className="text-copy-14 text-foreground mt-1 block">{lead.company || '—'}</span>
        </div>
        <div>
          <span className="block text-label-12 text-muted-foreground uppercase">Email Address</span>
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="text-copy-14 text-primary hover:underline mt-1 block">
              {lead.email}
            </a>
          ) : (
            <span className="text-copy-14 text-muted-foreground mt-1 block">—</span>
          )}
        </div>
        <div>
          <span className="block text-label-12 text-muted-foreground uppercase">Phone Number</span>
          <span className="text-copy-14 text-foreground mt-1 block">{lead.phone || '—'}</span>
        </div>
        <div>
          <span className="block text-label-12 text-muted-foreground uppercase">Website</span>
          {lead.website ? (
            <a 
              href={lead.website} 
              target="_blank" 
              rel="noreferrer" 
              className="text-copy-14 text-primary hover:underline mt-1 block"
            >
              <span className="truncate block max-w-full">
                {lead.website}
              </span>
            </a>
          ) : (
            <span className="text-copy-14 text-muted-foreground mt-1 block">—</span>
          )}
        </div>
        <div>
          <span className="block text-label-12 text-muted-foreground uppercase">Location / City</span>
          <span className="text-copy-14 text-foreground mt-1 block">{lead.city || '—'}</span>
        </div>
        <div className="sm:col-span-2">
          <span className="block text-label-12 text-muted-foreground uppercase">Industry</span>
          <span className="text-copy-14 text-foreground mt-1 block">{lead.industry || '—'}</span>
        </div>
      </div>
    </div>
  );
}
