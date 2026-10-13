'use client';

// TODO(22.8): Migrate generic error banner to per-field error display
// TODO(22.15): Add optimistic UI update on add-task for instant feedback
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, ClipboardCheck } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Adding Task...' : 'Add Task'}
    </Button>
  );
}

interface ClientTaskFormProps {
  leadId: string;
  createTaskAction: (prevState: { error?: string | null, success?: boolean } | null | undefined, formData: FormData) => Promise<{ error?: string | null, success?: boolean } | null | undefined>;
  tasksCount?: number;
}

export default function ClientTaskForm({ leadId, createTaskAction, tasksCount = 0 }: ClientTaskFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction] = useActionState(createTaskAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error && formRef.current) {
      formRef.current.reset();
      setShowForm(false);
    }
  }, [state]);

  if (!showForm) {
    if (tasksCount === 0) {
      return (
        <div className="flex items-center justify-center gap-2 py-4 px-3 text-label-12 text-muted-foreground bg-muted/20 border border-dashed border-border/80 rounded-md">
          <ClipboardCheck className="w-4 h-4 text-muted-foreground/80 shrink-0" />
          <span>No tasks yet.</span>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-primary font-semibold hover:underline"
          >
            + Add
          </button>
        </div>
      );
    }

    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setShowForm(true)}
        className="w-full"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Task
      </Button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4 bg-muted/30 p-4 rounded-md animate-fade-in">
      <div className="flex justify-between items-center pb-1 border-b border-border/40">
        <h4 className="text-label-12 font-semibold text-foreground">Configure New Task</h4>
        <Button type="button" variant="ghost" size="xs" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
      {state?.error && (
        <div className="bg-destructive/10 text-destructive p-2.5 rounded-md text-label-12 border border-destructive/20 font-semibold">
          {state.error}
        </div>
      )}
      <input type="hidden" name="leadId" value={leadId} />
      
      <div className="space-y-3">
        <div>
          <Label htmlFor="task-title" className="sr-only">Task Title</Label>
          <Input 
            required
            id="task-title"
            type="text"
            name="title"
            placeholder="Task title..."
          />
        </div>
        <div>
          <Label htmlFor="task-desc" className="sr-only">Task Description</Label>
          <Input 
            id="task-desc"
            type="text"
            name="description"
            placeholder="Short description..."
          />
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="task-due-date" className="block text-label-12 font-semibold text-foreground mb-1">Due Date</Label>
            <Input 
              id="task-due-date"
              type="date"
              name="dueDate"
            />
          </div>
          <div>
            <Label htmlFor="task-priority" className="block text-label-12 font-semibold text-foreground mb-1">Priority</Label>
            <select 
              id="task-priority"
              name="priority"
              defaultValue="Medium"
              className="block w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-label-12 focus-visible:ring-2 focus-visible:ring-ring text-foreground outline-none cursor-pointer"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
