'use client';

import { createLeadAction } from '@/app/actions/leads';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving Lead...' : 'Create Lead'}
    </Button>
  );
}

export default function NewLeadPage() {
  const [state, formAction] = useActionState(createLeadAction, undefined);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in text-left">
      {/* Page Header */}
      <header className="space-y-4 border-b border-border/70 pb-6">
        <nav className="flex items-center gap-2 text-copy-14 text-muted-foreground">
          <Link href="/leads" className="hover:text-foreground transition-colors">Leads</Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="font-medium text-foreground">New Lead</span>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-heading-3xl text-card-foreground">New Lead</h1>
            <p className="text-copy-14 text-muted-foreground mt-1.5 leading-relaxed">
              Manually add a new prospect business to your sales and consulting outreach pipeline.
            </p>
          </div>
        </div>
      </header>

      {/* Intake Form */}
      <form action={formAction} className="space-y-8 bg-card p-6 md:p-8 rounded-xl border border-border">
        {state?.error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md text-label-12 border border-destructive/20 leading-relaxed">
            {state.error}
          </div>
        )}

        {/* Section 1: Business Identity */}
        <div className="space-y-4">
          <h3 className="text-label-14 text-muted-foreground uppercase border-b border-border pb-1">
            Business Identity
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="lead-name" className="text-label-12 mb-1.5 block">Business Name *</Label>
              <Input required id="lead-name" type="text" name="name" placeholder="e.g. Austin Smiles Dentistry" />
            </div>
            <div>
              <Label htmlFor="lead-company" className="text-label-12 mb-1.5 block">Company Name (optional)</Label>
              <Input id="lead-company" type="text" name="company" placeholder="e.g. Acme Corporation" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="lead-website" className="text-label-12 mb-1.5 block">Website URL (optional)</Label>
              <Input id="lead-website" type="url" name="website" placeholder="e.g. https://example.com" />
            </div>
          </div>
        </div>

        {/* Section 2: Contact Paths */}
        <div className="space-y-4">
          <h3 className="text-label-14 text-muted-foreground uppercase border-b border-border pb-1">
            Contact Paths
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="lead-email" className="text-label-12 mb-1.5 block">Email Address (optional)</Label>
              <Input id="lead-email" type="email" name="email" placeholder="e.g. info@business.com" />
            </div>
            <div>
              <Label htmlFor="lead-phone" className="text-label-12 mb-1.5 block">Phone Number (optional)</Label>
              <Input id="lead-phone" type="text" name="phone" placeholder="e.g. +1 555 123 4567" />
            </div>
          </div>
        </div>

        {/* Section 3: Market Context */}
        <div className="space-y-4">
          <h3 className="text-label-14 text-muted-foreground uppercase border-b border-border pb-1">
            Market Context
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="lead-industry" className="text-label-12 mb-1.5 block">Industry (optional)</Label>
              <Input id="lead-industry" type="text" name="industry" placeholder="e.g. Local Services, Health" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lead-city" className="text-label-12 mb-1.5 block">City (optional)</Label>
                <Input id="lead-city" type="text" name="city" placeholder="e.g. Austin" />
              </div>
              <div>
                <Label htmlFor="lead-region" className="text-label-12 mb-1.5 block">State / Region (optional)</Label>
                <Input id="lead-region" type="text" name="region" placeholder="e.g. TX" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Pipeline Context */}
        <div className="space-y-4">
          <h3 className="text-label-14 text-muted-foreground uppercase border-b border-border pb-1">
            Pipeline Context
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="lead-stage" className="text-label-12 mb-1.5 block">Initial Pipeline Stage *</Label>
              <select 
                id="lead-stage"
                name="stage" 
                className="flex h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-copy-14 focus-visible:ring-2 focus-visible:ring-ring text-foreground hover:bg-muted/40 transition-colors outline-none cursor-pointer"
              >
                <option value="New">New</option>
                <option value="Researching">Researching</option>
                <option value="Auditing">Auditing</option>
                <option value="Audited">Audited</option>
                <option value="Drafting">Drafting</option>
                <option value="Ready to Send">Ready to Send</option>
              </select>
            </div>
            <div>
              <Label htmlFor="lead-source" className="text-label-12 mb-1.5 block">Source / Campaign (optional)</Label>
              <Input id="lead-source" type="text" name="sourceName" placeholder="e.g. Direct Outreach, Q3_Conference" />
              <p className="text-label-12 text-muted-foreground mt-1.5 leading-normal">
                If left blank, defaults to "Manual Entry". Specifying a name links the prospect to that campaign.
              </p>
            </div>
          </div>
        </div>

        {/* Form Confirmation Actions */}
        <div className="pt-5 border-t border-border/80 flex justify-end gap-3">
          <Link
            href="/leads"
            className={buttonVariants({ variant: 'outline' })}
          >
            Discard Lead
          </Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
