'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChannel: string;
  feedbackInput: string;
  setFeedbackInput: (val: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function ReviewDialog({
  isOpen,
  onClose,
  selectedChannel,
  feedbackInput,
  setFeedbackInput,
  isApproving,
  isRejecting,
  onApprove,
  onReject,
}: ReviewDialogProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleRejectSubmit = () => {
    if (!feedbackInput.trim()) {
      toast.error('A feedback reason is required when rejecting a draft');
      return;
    }
    onReject();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setShowRejectForm(false); } }}>
      <DialogContent className="sm:max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-label-14 text-foreground uppercase">
            Review {selectedChannel.toLowerCase()} outreach draft
          </DialogTitle>
          <DialogDescription className="text-label-12 text-muted-foreground">
            Evaluate and record your human decision. Rejections require feedback for trace context.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 text-label-12 text-muted-foreground">
          <div className="bg-muted/30 p-3.5 border border-border/60 rounded-xl space-y-2 flex items-start gap-2.5 leading-relaxed font-semibold">
            <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-foreground font-semibold">Important Notice</p>
              <p className="text-copy-13 leading-normal">
                Approving this draft marks it as ready for outreach. <span className="font-semibold text-foreground">This does NOT automatically send any email or message.</span> You must still copy or trigger outreach manually when ready.
              </p>
            </div>
          </div>

          {showRejectForm && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="review-feedback" className="text-label-12 text-foreground uppercase">
                Rejection Reason (Required)
              </Label>
              <Textarea
                id="review-feedback"
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                placeholder="Describe why this draft is rejected (e.g. style is too aggressive, website details are outdated)..."
                rows={3}
                className="text-label-12"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2 w-full pt-4">
          {showRejectForm ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(false)}
                disabled={isRejecting}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectSubmit}
                disabled={isRejecting || !feedbackInput.trim()}
                className="font-semibold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    Confirm Reject
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(true)}
                disabled={isApproving}
                className="border-destructive/30 hover:bg-destructive/10 text-destructive"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Reject Draft
              </Button>
              <Button
                onClick={onApprove}
                disabled={isApproving}
                className="font-semibold bg-chart-2/80 hover:bg-chart-2 text-white"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Approve Draft
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
