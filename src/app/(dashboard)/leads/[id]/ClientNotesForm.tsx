'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Saving Note...' : 'Add Note'}
    </Button>
  );
}

interface ClientNotesFormProps {
  leadId: string;
  addNoteAction: (prevState: { error?: string | null, success?: boolean } | null | undefined, formData: FormData) => Promise<{ error?: string | null, success?: boolean } | null | undefined>;
}

export default function ClientNotesForm({ leadId, addNoteAction }: ClientNotesFormProps) {
  const [state, formAction] = useActionState(addNoteAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error && formRef.current) {
      formRef.current.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 bg-card p-5 rounded-2xl border border-border shadow-sm">
      {state?.error && (
        <div className="bg-destructive/10 text-destructive p-3.5 rounded-xl text-xs font-semibold border border-destructive/20">
          {state.error}
        </div>
      )}
      <input type="hidden" name="leadId" value={leadId} />
      <Label htmlFor="note-body-input" className="sr-only">Add notes to lead</Label>
      <Textarea
        required
        id="note-body-input"
        name="body"
        placeholder="Type notes from calls, meetings, or research..."
        rows={3}
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground font-semibold italic">
          e.g. &apos;Called 6/14 — interested, follow up Friday&apos;
        </span>
        <SubmitButton />
      </div>
    </form>
  );
}
