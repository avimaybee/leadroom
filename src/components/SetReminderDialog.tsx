'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createReminderAction } from '@/app/actions/reminders';
import { toast } from 'sonner';

interface SetReminderDialogProps {
  leadId: string;
  leadName: string;
}

export function SetReminderDialog({ leadId, leadName }: SetReminderDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState(`Follow up on ${leadName}`);
  const [message, setMessage] = useState('');
  const getDefaultDateTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
  };
  const [remindAt, setRemindAt] = useState(getDefaultDateTime());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !remindAt) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('leadId', leadId);
      formData.append('title', title.trim());
      formData.append('message', message.trim());
      formData.append('remindAt', remindAt);

      const result = await createReminderAction(null, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Reminder set');
        setOpen(false);
        setTitle(`Follow up on ${leadName}`);
        setMessage('');
        setRemindAt('');
      }
    } catch {
      toast.error('Failed to set reminder');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Bell className="w-3.5 h-3.5 mr-1" />
        Set Reminder
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Reminder</DialogTitle>
          <DialogDescription>
            You&apos;ll receive a notification at the specified time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="reminder-title" className="text-label-12 text-muted-foreground">
              Title
            </label>
            <input
              id="reminder-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-copy-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="reminder-message" className="text-label-12 text-muted-foreground">
              Message <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <textarea
              id="reminder-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-copy-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="reminder-time" className="text-label-12 text-muted-foreground">
              Date &amp; Time
            </label>
            <input
              id="reminder-time"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-copy-14 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isSubmitting || !title.trim() || !remindAt}>
              {isSubmitting ? 'Setting...' : 'Set Reminder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
