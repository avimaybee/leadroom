'use client';

// TODO(22.8): Migrate generic error banner to per-field error display
// TODO(22.9): Preserve form field values on validation error (use defaultValue or keep state)
// TODO(22.15): Add optimistic UI update on add-note for instant feedback
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
  embedded?: boolean;
}

export default function ClientNotesForm({ leadId, addNoteAction, embedded = false }: ClientNotesFormProps) {
  const [state, formAction] = useActionState(addNoteAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error && formRef.current) {
      formRef.current.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className={embedded ? 'space-y-3 p-0 border-0 bg-transparent shadow-none' : 'space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm'}>
      {state?.error && (
        <div className="bg-destructive/10 text-destructive p-3.5 rounded-md text-label-12 border border-destructive/20">
          {state.error}
        </div>
      )}
      <input type="hidden" name="leadId" value={leadId} />
      <div className="space-y-2">
        <Label htmlFor="note-body-input" className="text-label-12 text-muted-foreground uppercase">Add note</Label>
        <Textarea
          required
          id="note-body-input"
          name="body"
          placeholder="Type notes from calls, meetings, or research..."
          rows={3}
          className="bg-background text-copy-14"
        />
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-label-12 text-muted-foreground">
          Include the outcome and a specific next step when possible.
        </span>
        <SubmitButton />
      </div>
    </form>
  );
}
