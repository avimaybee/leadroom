'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Globe, Users } from 'lucide-react';

interface Contact {
  id: string;
  leadId: string;
  fullName: string | null;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  otherProfileUrl: string | null;
  isPrimary: number;
  confidenceLevel: string;
  sourceType: string;
}

interface ClientContactsListProps {
  leadId: string;
  initialContacts: Contact[];
  addContactAction: (prevState: { error?: string | null, success?: boolean } | null | undefined, formData: FormData) => Promise<{ error?: string | null, success?: boolean } | null | undefined>;
  updateContactAction: (prevState: { error?: string | null, success?: boolean } | null | undefined, formData: FormData) => Promise<{ error?: string | null, success?: boolean } | null | undefined>;
  deleteContactAction: (leadId: string, contactId: string) => Promise<void>;
}

function SubmitButton({ label = 'Save Contact' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Saving...' : label}
    </Button>
  );
}

export default function ClientContactsList({
  leadId,
  initialContacts,
  addContactAction,
  updateContactAction,
  deleteContactAction,
}: ClientContactsListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addState, addFormAction] = useActionState(addContactAction, undefined);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editState, editFormAction] = useActionState(updateContactAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (addState && !addState.error && formRef.current) {
      formRef.current.reset();
      setShowAddForm(false);
    }
  }, [addState]);

  useEffect(() => {
    if (editState && !editState.error) {
      setEditingContactId(null);
    }
  }, [editState]);

  const handleDelete = async (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      await deleteContactAction(leadId, contactId);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-end pb-2 border-b border-border/40">
        <Button
          variant="outline"
          size="xs"
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingContactId(null);
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add Contact'}
        </Button>
      </div>

      {showAddForm && (
        <form
          ref={formRef}
          action={addFormAction}
          className="p-4 bg-muted/30 rounded-md space-y-4 animate-fade-in"
        >
          <h4 className="text-label-12 text-foreground uppercase">New Contact Details</h4>
          {addState?.error && (
                      <div className="bg-destructive/10 text-destructive p-2.5 rounded-md text-label-12 border border-destructive/20 font-semibold">
              {addState.error}
            </div>
          )}

          <input type="hidden" name="leadId" value={leadId} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-label-12 text-muted-foreground uppercase">Full Name</Label>
              <Input required id="contact-fullName" type="text" name="fullName" placeholder="Jane Doe" />
            </div>
            <div>
              <Label className="text-label-12 text-muted-foreground uppercase">Role / Title</Label>
              <Input id="contact-roleTitle" type="text" name="roleTitle" placeholder="CEO / Marketing Director" />
            </div>
            <div>
              <Label className="text-label-12 text-muted-foreground uppercase">Email</Label>
              <Input id="contact-email" type="email" name="email" placeholder="jane@company.com" />
            </div>
            <div>
              <Label className="text-label-12 text-muted-foreground uppercase">Phone</Label>
              <Input id="contact-phone" type="text" name="phone" placeholder="+1 555-0199" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-label-12 text-muted-foreground uppercase">LinkedIn Profile URL</Label>
              <Input id="contact-linkedinUrl" type="url" name="linkedinUrl" placeholder="https://linkedin.com/in/username" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimary"
              name="isPrimary"
              className="rounded text-primary focus:ring-primary cursor-pointer h-4 w-4"
            />
            <Label htmlFor="isPrimary" className="text-label-12 text-muted-foreground cursor-pointer select-none">
              Mark as primary contact for lead outreach
            </Label>
          </div>

          <div className="flex justify-end pt-1">
            <SubmitButton />
          </div>
        </form>
      )}

      <div className="space-y-3">
        {initialContacts.length === 0 ? (
          <div className="bg-muted/30 border border-dashed border-border rounded-md p-6 text-center space-y-3 animate-fade-in">
            <div className="w-10 h-10 bg-card rounded-md border border-border flex items-center justify-center text-muted-foreground mx-auto shadow-none">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-label-12 text-foreground">No Stakeholder Contacts Recorded</h4>
              <p className="text-label-12 text-muted-foreground max-w-xs mx-auto leading-relaxed">
                Add contacts, decision makers, and outreach recipients associated with this business profile.
              </p>
            </div>
            {!showAddForm && (
              <Button variant="link" onClick={() => setShowAddForm(true)}>
                + Add First Contact
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/60 border-t border-b border-border/40">
            {initialContacts.map((contact) => (
              <div
                key={contact.id}
                className="py-3.5 transition-all"
              >
                {editingContactId === contact.id ? (
                  <form action={editFormAction} className="p-4 bg-muted/30 rounded-md space-y-3 animate-fade-in">
                    <h4 className="text-label-12 text-foreground uppercase">Edit Contact</h4>
                    {editState?.error && (
            <div className="bg-destructive/10 text-destructive p-2.5 rounded-md text-label-12 border border-destructive/20">
                        {editState.error}
                      </div>
                    )}

                    <input type="hidden" name="leadId" value={leadId} />
                    <input type="hidden" name="contactId" value={contact.id} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-label-12 text-muted-foreground uppercase">Full Name</Label>
                        <Input required type="text" name="fullName" defaultValue={contact.fullName || ''} />
                      </div>
                      <div>
                        <Label className="text-label-12 text-muted-foreground uppercase">Role / Title</Label>
                        <Input type="text" name="roleTitle" defaultValue={contact.roleTitle || ''} />
                      </div>
                      <div>
                        <Label className="text-label-12 text-muted-foreground uppercase">Email</Label>
                        <Input type="email" name="email" defaultValue={contact.email || ''} />
                      </div>
                      <div>
                        <Label className="text-label-12 text-muted-foreground uppercase">Phone</Label>
                        <Input type="text" name="phone" defaultValue={contact.phone || ''} />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-label-12 text-muted-foreground uppercase">LinkedIn Profile URL</Label>
                        <Input type="url" name="linkedinUrl" defaultValue={contact.linkedinUrl || ''} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`isPrimary-edit-${contact.id}`}
                        name="isPrimary"
                        defaultChecked={contact.isPrimary === 1}
                        className="rounded text-primary focus:ring-primary cursor-pointer h-4 w-4"
                      />
                      <Label htmlFor={`isPrimary-edit-${contact.id}`} className="text-label-12 font-semibold text-muted-foreground cursor-pointer select-none">
                        Mark as primary contact for lead outreach
                      </Label>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button type="button" variant="outline" size="xs" onClick={() => setEditingContactId(null)}>
                        Cancel
                      </Button>
                      <SubmitButton label="Save Changes" />
                    </div>
                  </form>
                ) : (
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-label-14 font-semibold text-foreground block leading-tight">
                          {contact.fullName || contact.email || 'Unknown Contact'}
                        </span>
                        {contact.isPrimary === 1 && (
                          <Badge variant="secondary" className="px-1 py-0 uppercase bg-chart-2/10 text-chart-2">
                            Primary
                          </Badge>
                        )}
                        {contact.sourceType === 'ENRICHMENT' && (
                          <Badge variant="outline" className="px-1 py-0 uppercase text-chart-5 border-chart-5/20 bg-chart-5/10">
                            Auto
                          </Badge>
                        )}
                        {contact.sourceType === 'IMPORT' && (
                          <Badge variant="outline" className="px-1 py-0 uppercase text-primary border-primary/20 bg-primary/10">
                            Imported
                          </Badge>
                        )}
                        {contact.confidenceLevel === 'LOW' && (
                          <Badge variant="outline" className="px-1 py-0 uppercase text-muted-foreground border-border">
                            Low confidence
                          </Badge>
                        )}
                      </div>
                      {contact.roleTitle && (
                        <p className="text-label-12 font-semibold text-muted-foreground leading-tight">{contact.roleTitle}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5">
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="text-label-12 font-semibold text-primary hover:underline flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <span className="text-label-12 font-semibold text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            {contact.phone}
                          </span>
                        )}
                        {contact.linkedinUrl && (
                          <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="text-label-12 font-semibold text-primary hover:underline flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                            LinkedIn
                          </a>
                        )}
                        {contact.otherProfileUrl && (
                          <a href={contact.otherProfileUrl} target="_blank" rel="noreferrer" className="text-label-12 font-semibold text-muted-foreground hover:text-primary hover:underline flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5" />
                            {new URL(contact.otherProfileUrl).hostname.replace('www.', '')}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="xs" onClick={() => { setEditingContactId(contact.id); setShowAddForm(false); }} title="Edit Contact">
                        Edit
                      </Button>
                      <Button variant="ghost" size="xs" onClick={() => handleDelete(contact.id)} title="Delete Contact" className="text-destructive hover:text-destructive">
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
