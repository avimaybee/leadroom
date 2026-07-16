'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Plus,
  History,
  ChevronRight,
  Mail,
  MessageSquareText,
  PhoneCall,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ChannelSwitcher, type Channel } from './components/outreach/ChannelSwitcher';
import { EvidenceInspector } from './components/outreach/EvidenceInspector';
import { GenerationSheet } from './components/outreach/GenerationSheet';
import { ReviewDialog } from './components/outreach/ReviewDialog';
import { VersionDrawer } from './components/outreach/VersionDrawer';
import { DraftCompareDialog } from './components/outreach/DraftCompareDialog';
import { ErrorBoundary } from './ErrorBoundary';
import { useOutreachState, type OutreachDraft, normalizeChannel } from './components/outreach/useOutreachState';
import { DraftEditor } from './components/outreach/DraftEditor';
import { DraftActionBar } from './components/outreach/DraftActionBar';
import { Card, CardContent } from '@/components/ui/card';

interface OutreachAssistantProps {
  leadId: string;
  initialDrafts: OutreachDraft[];
  researchSnapshot: any;
  auditSnapshot: any;
  contacts: any[];
  initialChannel?: string;
}

function getChannelIcon(channel: Channel) {
  switch (channel) {
    case 'CALL':
      return PhoneCall;
    case 'MEETING':
      return Users;
    case 'LINKEDIN':
      return MessageSquareText;
    default:
      return Mail;
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

export default function OutreachAssistant({
  leadId,
  initialDrafts,
  researchSnapshot,
  auditSnapshot,
  contacts,
  initialChannel,
}: OutreachAssistantProps) {
  const state = useOutreachState(leadId, initialDrafts, initialChannel);
  const ActiveChannelIcon = getChannelIcon(state.selectedChannel);

  const compareDrafts = state.comparePair
    ? {
        first: state.drafts.find((draft) => draft.id === state.comparePair![0]) ?? null,
        second: state.drafts.find((draft) => draft.id === state.comparePair![1]) ?? null,
      }
    : { first: null, second: null };

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-label-12 uppercase text-muted-foreground">
                  <span>Outreach assistant</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{formatChannelLabel(state.selectedChannel)}</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-heading-2xl text-foreground sm:text-heading-xl">
                    One draft, one decision path.
                  </h2>
                  <p className="max-w-3xl text-copy-14 leading-6 text-muted-foreground">
                    Channel choice comes first. The editor stays primary. History, generation, and comparisons move out of the way until they are needed.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => state.setVersionOpen(true)}
                  disabled={state.channelDrafts.length === 0}
                >
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  Versions {state.channelDrafts.length > 0 ? `(${state.channelDrafts.length})` : ''}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => state.setGenerationOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Generate variation
                </Button>
              </div>
            </div>

            <ChannelSwitcher
              selectedChannel={state.selectedChannel}
              onChange={state.handleChannelChange}
              draftCounts={state.draftCounts}
            />
          </div>

          <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)] sm:px-6">
            <div className="space-y-5">
              {state.activeDraft ? (
                <DraftEditor
                  activeDraft={state.activeDraft}
                  selectedChannel={state.selectedChannel}
                  subjectInput={state.subjectInput}
                  setSubjectInput={state.setSubjectInput}
                  bodyInput={state.bodyInput}
                  setBodyInput={state.setBodyInput}
                  editable={state.editable}
                  isSaving={state.isSaving}
                  isApproving={state.isApproving}
                  isRejecting={state.isRejecting}
                  isSending={state.isSending}
                  versionLabel={state.versionLabel}
                  errorMsg={state.errorMsg}
                  actionBar={
                    <DraftActionBar
                      activeDraft={state.activeDraft}
                      isDirty={state.isDirty}
                      isSaving={state.isSaving}
                      isApproving={state.isApproving}
                      isRejecting={state.isRejecting}
                      isSending={state.isSending}
                      isDuplicating={state.isDuplicating}
                      canReview={state.canReview}
                      canSend={state.canSend}
                      canDelete={state.canDelete}
                      copied={state.copied}
                      versionCount={state.channelDrafts.length}
                      menuOpen={state.menuOpen}
                      setMenuOpen={state.setMenuOpen}
                      onSave={() => state.saveCurrentDraft()}
                      onReview={() => state.setReviewOpen(true)}
                      onMarkSent={state.handleMarkSent}
                      onCopy={state.handleCopy}
                      onOpenVersions={() => state.setVersionOpen(true)}
                      onGenerateVariation={() => state.setGenerationOpen(true)}
                      onDuplicate={state.handleDuplicate}
                      onDelete={() => state.setDeleteTarget(state.activeDraft)}
                    />
                  }
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border/30 bg-muted/10">
                  <div className="space-y-6 p-6 sm:p-8">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-label-12 uppercase text-muted-foreground">
                        <ActiveChannelIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        No draft yet
                      </div>
                      <h3 className="text-heading-2xl text-foreground">
                        {state.channelGuidance.headline}
                      </h3>
                      <p className="max-w-2xl text-copy-14 leading-6 text-muted-foreground">
                        {state.channelGuidance.description} The system will use the available lead evidence, but the draft stays reviewable and editable before any approval.
                      </p>
                    </div>

                    <div className="grid gap-3 text-copy-14 text-foreground/85 sm:grid-cols-3">
                      {state.channelGuidance.bullets.map((bullet) => (
                        <div key={bullet} className="rounded-md bg-muted/50 p-4">
                          <div className="flex items-start gap-2">
                            <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-label-12 font-semibold text-primary">
                               1
                            </span>
                            <p className="text-copy-14 leading-6 text-muted-foreground">{bullet}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button size="lg" onClick={() => state.setGenerationOpen(true)}>
                        <Sparkles className="h-3.5 w-3.5 mr-2" />
                        {state.channelGuidance.cta}
                      </Button>
                      <p className="text-label-12 text-muted-foreground font-semibold">
                        Version history stays available after the first draft is created.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:sticky lg:top-6 lg:self-start">
              <EvidenceInspector
                researchSnapshot={researchSnapshot}
                auditSnapshot={auditSnapshot}
                contacts={contacts}
                leadId={leadId}
              />
            </div>
          </div>
        </div>
      </div>

      <GenerationSheet
        isOpen={state.generationOpen}
        onClose={() => state.setGenerationOpen(false)}
        selectedChannel={state.selectedChannel}
        customPrompt={state.customPrompt}
        setCustomPrompt={state.setCustomPrompt}
        attachments={state.attachments}
        isUploadingAttachments={state.isUploadingAttachments}
        onFileChange={state.handleFileChange}
        onRemoveAttachment={state.removeAttachment}
        isGenerating={state.isGenerating}
        onGenerate={state.handleGenerate}
        modelInfo={state.modelInfo}
        errorMsg={state.errorMsg}
      />

      <ReviewDialog
        isOpen={state.reviewOpen}
        onClose={() => state.setReviewOpen(false)}
        selectedChannel={state.selectedChannel}
        feedbackInput={state.feedbackInput}
        setFeedbackInput={state.setFeedbackInput}
        isApproving={state.isApproving}
        isRejecting={state.isRejecting}
        onApprove={state.handleApprove}
        onReject={state.handleReject}
      />

      <VersionDrawer
        isOpen={state.versionOpen}
        onClose={() => state.setVersionOpen(false)}
        channelDrafts={state.channelDrafts}
        activeDraftId={state.activeDraftId}
        onSelectDraft={state.handleSelectVersion}
        onTriggerCompare={state.handleCompareVersions}
        onDuplicate={state.handleDuplicate}
      />

      <DraftCompareDialog
        isOpen={state.comparePair !== null}
        onClose={() => state.setComparePair(null)}
        draft1={compareDrafts.first}
        draft2={compareDrafts.second}
        onUseVersion={(draft) => {
          state.handleSelectVersion(draft);
          state.setComparePair(null);
        }}
      />

      {state.deleteTarget && (
        <Dialog open={state.deleteTarget !== null} onOpenChange={(open) => !open && state.setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md rounded-xl bg-card border border-border">
            <DialogHeader>
              <DialogTitle className="text-heading-lg text-foreground">Delete Draft</DialogTitle>
              <DialogDescription className="text-copy-14 text-muted-foreground">
                Are you sure you want to permanently delete this draft? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => state.setDeleteTarget(null)}>
                Keep Draft
              </Button>
              <Button variant="destructive" size="sm" onClick={state.handleDelete}>
                Delete Draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ErrorBoundary>
  );
}
