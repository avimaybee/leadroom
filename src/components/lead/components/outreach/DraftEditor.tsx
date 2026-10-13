'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DraftStatusPath } from './DraftStatusPath';
import type { OutreachDraft } from './useOutreachState';
import type { Channel } from './ChannelSwitcher';
import { formatDateTimeUTC } from '@/lib/date';

interface DraftEditorProps {
  activeDraft: OutreachDraft;
  selectedChannel: Channel;
  subjectInput: string;
  setSubjectInput: (val: string) => void;
  bodyInput: string;
  setBodyInput: (val: string) => void;
  editable: boolean;
  isSaving: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  isSending: boolean;
  versionLabel: string | null;
  actionBar: React.ReactNode;
  errorMsg: string | null;
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'SENT':
      return 'Sent';
    default:
      return 'Draft';
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-chart-2/10 text-chart-2 border-chart-2/20';
    case 'REJECTED':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'SENT':
      return 'bg-primary/10 text-primary border-primary/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function formatChannelLabel(channel: Channel) {
  switch (channel) {
    case 'EMAIL':
      return 'Email';
    case 'LINKEDIN':
      return 'LinkedIn';
    case 'CALL':
      return 'Call prep';
    case 'MEETING':
      return 'Meeting prep';
  }
}

export function DraftEditor({
  activeDraft,
  selectedChannel,
  subjectInput,
  setSubjectInput,
  bodyInput,
  setBodyInput,
  editable,
  isSaving,
  isApproving,
  isRejecting,
  isSending,
  versionLabel,
  actionBar,
  errorMsg,
}: DraftEditorProps) {
  const disabled = !editable || isSaving || isApproving || isRejecting || isSending;
  
  const wordCount = bodyInput.trim() ? bodyInput.trim().split(/\s+/).length : 0;
  const charCount = bodyInput.length;
  
  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`rounded-full border px-2.5 py-0.5 text-label-12 uppercase tracking-wider ${getStatusBadgeClass(activeDraft.status)}`}>
                {getStatusLabel(activeDraft.status)}
              </Badge>
              {versionLabel && (
                <span className="text-label-12 text-muted-foreground">{versionLabel}</span>
              )}
              <span className="text-label-12 text-muted-foreground">
                {activeDraft.updatedAt ? `Updated ${formatDateTimeUTC(activeDraft.updatedAt)}` : 'Fresh draft'}
              </span>
            </div>
            <CardTitle className="text-heading-lg text-foreground">
              {formatChannelLabel(selectedChannel)} draft
            </CardTitle>
            <CardDescription className="max-w-2xl text-label-12 leading-5">
              Edit the draft directly. Approval, sending, and version changes are separate decisions.
            </CardDescription>
          </div>

          <div className="shrink-0">{actionBar}</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 py-5 px-5 sm:px-6">
        <DraftStatusPath status={activeDraft.status} feedback={activeDraft.feedback} />

        {errorMsg && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-copy-14 text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          {selectedChannel === 'EMAIL' && (
            <div className="space-y-2">
              <Label htmlFor="outreach-subject" className="text-label-12 text-muted-foreground uppercase">
                Subject
              </Label>
              <Input
                id="outreach-subject"
                value={subjectInput}
                onChange={(event) => setSubjectInput(event.target.value)}
                placeholder="Write a subject line"
                disabled={disabled}
                className="h-11 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="outreach-body" className="text-label-12 text-muted-foreground uppercase">
                {selectedChannel === 'CALL' || selectedChannel === 'MEETING' ? 'Notes / Agenda' : 'Message body'}
              </Label>
              <span className="text-label-12 text-muted-foreground">
                {wordCount} word{wordCount === 1 ? '' : 's'} / {charCount} char{charCount === 1 ? '' : 's'}
                {selectedChannel === 'LINKEDIN' && charCount > 300 && (
                  <span className="text-chart-5 font-semibold ml-1"> (exceeds connection limit)</span>
                )}
              </span>
            </div>
            <Textarea
              id="outreach-body"
              value={bodyInput}
              onChange={(event) => setBodyInput(event.target.value)}
              placeholder={
                selectedChannel === 'CALL'
                  ? 'Write the call opener, discovery questions, and actions...'
                  : selectedChannel === 'MEETING'
                  ? 'Write the meeting agenda, objections, and commitments...'
                  : 'Write the full outreach copy here...'
              }
              disabled={disabled}
              className="min-h-[420px] rounded-2xl border-border/70 bg-background/50 text-copy-14 leading-7 focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
