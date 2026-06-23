'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { formatDateTimeUTC } from '@/lib/date';
import { PenLine, ArrowLeft } from 'lucide-react';

interface DraftCompareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  draft1: any;
  draft2: any;
  onUseVersion: (draft: any) => void;
}

export function DraftCompareDialog({
  isOpen,
  onClose,
  draft1,
  draft2,
  onUseVersion,
}: DraftCompareDialogProps) {
  if (!draft1 || !draft2) return null;

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'default' as const;
      case 'REJECTED': return 'destructive' as const;
      case 'SENT': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      case 'SENT': return 'Sent';
      default: return 'Draft';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="text-label-14 text-foreground uppercase">
            Compare Outreach Drafts
          </DialogTitle>
          <DialogDescription className="text-label-12 text-muted-foreground">
            Evaluate differences between two versions of the outreach template.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Draft 1 */}
          <Card className="flex flex-col h-full bg-card border-border/80 shadow-sm" size="sm">
            <CardHeader className="border-b border-border/40 pb-3 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-label-12 text-foreground">Version A</span>
                  <Badge variant={getStatusVariant(draft1.status)} className="text-label-12 uppercase">
                    {getStatusLabel(draft1.status)}
                  </Badge>
                </div>
                <p className="text-label-12 text-muted-foreground">
                  Created: {draft1.createdAt ? formatDateTimeUTC(draft1.createdAt) : 'N/A'}
                </p>
              </div>
              <Button
                variant="outline"
                size="xs"
                onClick={() => onUseVersion(draft1)}
                className="font-semibold flex items-center gap-1 shrink-0 h-7"
              >
                <PenLine className="w-3 h-3" />
                Use Version A
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[450px]">
              {draft1.subject && (
                <div className="space-y-0.5">
                  <span className="text-label-12 text-muted-foreground uppercase">Subject</span>
                  <p className="text-label-12 text-foreground bg-muted/40 p-2 rounded-lg border border-border/40">
                    {draft1.subject}
                  </p>
                </div>
              )}
              <div className="space-y-0.5">
                <span className="text-label-12 text-muted-foreground uppercase">Body Content</span>
                <div className="text-label-12 text-muted-foreground leading-relaxed prose-markdown p-3 bg-muted/20 border border-border/30 rounded-xl overflow-x-hidden font-medium">
                  <ReactMarkdown>{draft1.body}</ReactMarkdown>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Draft 2 */}
          <Card className="flex flex-col h-full bg-card border-border/80 shadow-sm" size="sm">
            <CardHeader className="border-b border-border/40 pb-3 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-label-12 text-foreground">Version B</span>
                  <Badge variant={getStatusVariant(draft2.status)} className="text-label-12 uppercase">
                    {getStatusLabel(draft2.status)}
                  </Badge>
                </div>
                <p className="text-label-12 text-muted-foreground">
                  Created: {draft2.createdAt ? formatDateTimeUTC(draft2.createdAt) : 'N/A'}
                </p>
              </div>
              <Button
                variant="outline"
                size="xs"
                onClick={() => onUseVersion(draft2)}
                className="font-semibold flex items-center gap-1 shrink-0 h-7"
              >
                <PenLine className="w-3 h-3" />
                Use Version B
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[450px]">
              {draft2.subject && (
                <div className="space-y-0.5">
                  <span className="text-label-12 text-muted-foreground uppercase">Subject</span>
                  <p className="text-label-12 text-foreground bg-muted/40 p-2 rounded-lg border border-border/40">
                    {draft2.subject}
                  </p>
                </div>
              )}
              <div className="space-y-0.5">
                <span className="text-label-12 text-muted-foreground uppercase">Body Content</span>
                <div className="text-label-12 text-muted-foreground leading-relaxed prose-markdown p-3 bg-muted/20 border border-border/30 rounded-xl overflow-x-hidden font-medium">
                  <ReactMarkdown>{draft2.body}</ReactMarkdown>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex flex-row justify-end pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} className="font-semibold flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Editor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
