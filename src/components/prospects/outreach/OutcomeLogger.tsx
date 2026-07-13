'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientLog } from '@/lib/client-logger';
import { handleClientError, handleClientSuccess } from '@/lib/actions/toast-error';

const OUTCOME_TYPES = [
  { value: 'REPLIED', label: 'Replied' },
  { value: 'MEETING_BOOKED', label: 'Meeting Booked' },
  { value: 'BOUNCED', label: 'Bounced' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
] as const;

interface OutcomeLoggerProps {
  draftId: string | null;
  prospectId: string;
  onLog: (data: { outcomeType: string; notes: string }) => Promise<void>;
}

export function OutcomeLogger({ draftId, prospectId, onLog }: OutcomeLoggerProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) return;
    setSaving(true);
    clientLog.info('OutcomeLogger', 'Logging outcome', { prospectId, outcomeType: selectedType });
    try {
      await onLog({ outcomeType: selectedType, notes });
      handleClientSuccess('OutcomeLogger', 'Log outcome', 'Outcome logged', { prospectId, outcomeType: selectedType });
      setDone(true);
    } catch (err) {
      handleClientError('OutcomeLogger', 'Log outcome', err, 'Failed to log outcome');
    }
    setSaving(false);
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-chart-2/10 border border-chart-2/30 px-4 py-3 text-copy-14 text-chart-2">
        <CheckCircle2 className="w-4 h-4" />
        Outcome logged.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h3 className="text-label-12 text-muted-foreground uppercase">Log Outcome</h3>
      <p className="text-copy-14 text-muted-foreground">
        Record what happened with this outreach. This helps improve scoring over time.
      </p>

      <div className="flex flex-wrap gap-2">
        {OUTCOME_TYPES.map((t) => (
          <Button
            key={t.value}
            variant={selectedType === t.value ? 'default' : 'outline'}
            size="xs"
            onClick={() => setSelectedType(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div>
        <Label htmlFor="outcome-notes">Notes (optional)</Label>
        <Input id="outcome-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional context..." />
      </div>

      <Button onClick={handleSubmit} disabled={!selectedType || saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Log Outcome
      </Button>
    </div>
  );
}
