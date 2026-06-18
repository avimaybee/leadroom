'use client';

import { createLeadAction } from '@/app/actions/leads';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving Lead...' : 'Save Lead'}
    </Button>
  );
}

export default function NewLeadPage() {
  const [state, formAction] = useActionState(createLeadAction, undefined);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="space-y-1.5 text-left">
        <Link 
          href="/leads" 
          className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 transition w-fit py-2.5 pr-4 -my-2.5 -ml-1"
        >
          &larr; Back to Leads
        </Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">New Lead</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter the details of your new active pipeline prospect.</p>
        </div>
      </div>

      <form action={formAction} className="space-y-6 bg-card p-8 rounded-2xl border border-border shadow-sm">
        {state?.error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-sm border border-destructive/20 font-semibold">
            {state.error}
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Full Name *</Label>
            <Input required type="text" name="name" placeholder="e.g. John Doe" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Company</Label>
            <Input type="text" name="company" placeholder="e.g. Acme Corp" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Email</Label>
            <Input type="email" name="email" placeholder="e.g. john@acme.com" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Phone Number</Label>
            <Input type="text" name="phone" placeholder="e.g. +1 555 123 4567" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Website URL</Label>
            <Input type="url" name="website" placeholder="e.g. https://example.com" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Industry</Label>
            <Input type="text" name="industry" placeholder="e.g. Local Services" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Location / City</Label>
            <Input type="text" name="city" placeholder="e.g. San Francisco" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Region / State</Label>
            <Input type="text" name="region" placeholder="e.g. CA" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs uppercase tracking-wider mb-2 block">Source / Campaign</Label>
            <Input type="text" name="sourceName" placeholder="e.g. Direct Outreach, Q3_Tech_Conference" />
            <p className="text-[11px] text-muted-foreground mt-1.5">If left blank, it defaults to "Manual Entry". Entering a new name will create a campaign badge.</p>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs uppercase tracking-wider mb-2 block">Pipeline Stage</Label>
            <select 
              name="stage" 
              className="block w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground"
            >
              <option value="New">New</option>
              <option value="Researching">Researching</option>
              <option value="Qualified">Qualified</option>
              <option value="Outreach in Progress">Outreach in Progress</option>
              <option value="Meeting / Call">Meeting / Call</option>
            </select>
          </div>
        </div>
        
        <div className="pt-4 border-t border-border flex justify-end gap-3">
          <Link
            href="/leads"
            className="px-5 py-2.5 bg-card text-foreground hover:bg-muted border border-border rounded-xl font-semibold text-sm transition"
          >
            Cancel
          </Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
