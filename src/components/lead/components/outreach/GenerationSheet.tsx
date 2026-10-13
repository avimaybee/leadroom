'use client';

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, AlertTriangle } from 'lucide-react';

interface GenerationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChannel: string;
  customPrompt: string;
  setCustomPrompt: (val: string) => void;
  attachments: Array<{ name: string; type: string; base64: string }>;
  isUploadingAttachments: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (index: number) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  modelInfo: { provider: string; modelName: string; hasVision: boolean } | null;
  errorMsg: string | null;
}

export function GenerationSheet({
  isOpen,
  onClose,
  selectedChannel,
  customPrompt,
  setCustomPrompt,
  attachments,
  isUploadingAttachments,
  onFileChange,
  onRemoveAttachment,
  isGenerating,
  onGenerate,
  modelInfo,
  errorMsg,
}: GenerationSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-md w-full flex flex-col h-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-label-14 text-foreground uppercase">
            Generate {selectedChannel.toLowerCase()} Draft
          </SheetTitle>
          <SheetDescription className="text-label-12 text-muted-foreground">
            Tailor the AI prompt for this draft. Existing drafts will remain in the version history.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4 text-label-12 flex-1">
          {/* Custom Prompt */}
          <div className="space-y-1">
            <Label htmlFor="generation-custom-prompt" className="text-label-12 text-muted-foreground uppercase">
              Custom Instructions (Optional)
            </Label>
            <Textarea
              id="generation-custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Keep it brief, highlight the site load speed issues, maintain a warm advisory tone..."
              className="min-h-[80px]"
            />
          </div>

          {/* Attachments Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-label-12 text-muted-foreground uppercase">
                Attachments (Images / PDFs)
              </Label>
              {modelInfo && (
                <span className="text-label-12 text-muted-foreground/80">
                  Active model: {modelInfo.modelName}
                </span>
              )}
            </div>

            <Label className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-4 bg-muted/20 hover:bg-muted/40 cursor-pointer transition text-label-12 text-muted-foreground">
              <input
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.pdf"
                onChange={onFileChange}
                className="hidden"
                disabled={isUploadingAttachments || isGenerating}
              />
              {isUploadingAttachments ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin h-3.5 w-3.5 text-primary" />
                  <span>Uploading files...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="w-5 h-5 text-muted-foreground/80" />
                  <span>Choose Files</span>
                  <span className="text-label-12 text-muted-foreground/60">Images &amp; PDFs only</span>
                </div>
              )}
            </Label>

            {modelInfo && !modelInfo.hasVision && attachments.length > 0 && (
              <div className="bg-chart-5/10 border border-chart-5/20 text-chart-5 p-2.5 rounded-xl flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div className="text-label-12">
                  The active model ({modelInfo.modelName}) lacks vision capability. Uploaded files will be stored, but the model cannot visually analyze them.
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {attachments.map((att, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 text-label-12 text-primary rounded-lg shrink-0">
                    <span className="truncate max-w-[150px]">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(idx)}
                      className="text-primary hover:text-primary/70 font-extrabold shrink-0"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-xl font-semibold leading-normal">
              {errorMsg}
            </div>
          )}
        </div>

        <SheetFooter className="flex flex-row justify-end gap-2 w-full pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={onGenerate} disabled={isGenerating || isUploadingAttachments} className="font-semibold">
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />
                Generating...
              </>
            ) : (
              'Generate Draft'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
