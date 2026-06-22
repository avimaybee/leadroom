'use client';

import { useState, useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  updateLeadAction: (
    prevState: { error?: string | null; success?: boolean } | null | undefined,
    formData: FormData
  ) => Promise<{ error?: string | null; success?: boolean } | null | undefined>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Saving...' : 'Save Changes'}
    </Button>
  );
}

export default function ClientLeadProfile({ lead, updateLeadAction }: ClientLeadProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction] = useActionState(updateLeadAction, undefined);

  useEffect(() => {
    if (state && !state.error && state.success) {
      setIsEditing(false);
    }
  }, [state]);

  if (isEditing) {
    return (
      <form action={formAction} className="space-y-4 animate-fade-in">
        <div className="flex justify-between items-center pb-2 border-b border-border/40">
          <span className="text-xs font-bold text-muted-foreground uppercase">Editing Profile</span>
          <Button type="button" variant="ghost" size="xs" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>

        {state?.error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-xl text-xs border border-destructive/20 font-semibold">
            {state.error}
          </div>
        )}

        <input type="hidden" name="leadId" value={lead.id} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Full Name *</Label>
            <Input required type="text" name="name" defaultValue={lead.name} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Company</Label>
            <Input type="text" name="company" defaultValue={lead.company || ''} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email Address</Label>
            <Input type="email" name="email" defaultValue={lead.email || ''} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Phone Number</Label>
            <Input type="text" name="phone" defaultValue={lead.phone || ''} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Website URL</Label>
            <Input type="url" name="website" defaultValue={lead.website || ''} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Location / City</Label>
            <Input type="text" name="city" defaultValue={lead.city || ''} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Industry</Label>
            <Input type="text" name="industry" defaultValue={lead.industry || ''} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <SubmitButton />
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in relative group">
      <div className="flex justify-end pb-2 border-b border-border/40">
        <Button variant="outline" size="xs" onClick={() => setIsEditing(true)}>
          Edit Profile
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <span className="block text-xs font-bold text-muted-foreground uppercase">Lead Name</span>
          <span className="text-sm text-foreground font-semibold mt-1 block">{lead.name}</span>
        </div>
        {lead.company && (
          <div>
            <span className="block text-xs font-bold text-muted-foreground uppercase">Company</span>
            <span className="text-sm text-foreground font-semibold mt-1 block">{lead.company}</span>
          </div>
        )}
        {lead.email && (
          <div>
            <span className="block text-xs font-bold text-muted-foreground uppercase">Email Address</span>
            <a href={`mailto:${lead.email}`} className="text-sm text-primary hover:underline font-semibold mt-1 block">
              {lead.email}
            </a>
          </div>
        )}
        {lead.phone && (
          <div>
            <span className="block text-xs font-bold text-muted-foreground uppercase">Phone Number</span>
            <span className="text-sm text-foreground font-semibold mt-1 block">{lead.phone}</span>
          </div>
        )}
        {lead.website && (
          <div>
            <span className="block text-xs font-bold text-muted-foreground uppercase">Website</span>
            <a 
              href={lead.website} 
              target="_blank" 
              rel="noreferrer" 
              className="text-sm text-primary hover:underline font-semibold mt-1 block"
            >
              <span className="truncate block max-w-full">
                {lead.website}
              </span>
            </a>
          </div>
        )}
        {lead.city && (
          <div>
            <span className="block text-xs font-bold text-muted-foreground uppercase">Location / City</span>
            <span className="text-sm text-foreground font-semibold mt-1 block">{lead.city}</span>
          </div>
        )}
        {lead.industry && (
          <div>
            <span className="block text-xs font-bold text-muted-foreground uppercase">Industry</span>
            <span className="text-sm text-foreground font-semibold mt-1 block">{lead.industry}</span>
          </div>
        )}
      </div>
    </div>
  );
}
