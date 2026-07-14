'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, MapPin, Building2, Loader2 } from 'lucide-react';
import { updateCandidateAction, promoteCandidateAction } from '@/app/actions/discovery-candidate';
import { toast } from 'sonner';

interface CandidateEditData {
  id: string;
  rawName: string;
  rawWebsiteUrl: string | null;
  rawLocation: string | null;
}

interface EditCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: CandidateEditData;
  onPromoted: () => void;
}

export function EditCandidateModal({ isOpen, onClose, candidate, onPromoted }: EditCandidateModalProps) {
  const [name, setName] = useState(candidate.rawName);
  const [website, setWebsite] = useState(candidate.rawWebsiteUrl || '');
  const [location, setLocation] = useState(candidate.rawLocation || '');
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    const form = new FormData();
    form.append('candidateId', candidate.id);
    form.append('rawName', name.trim());
    form.append('rawWebsiteUrl', website.trim());
    form.append('rawLocation', location.trim());
    const result = await updateCandidateAction(null, form);
    if (result.error) {
      toast.error(result.error);
      setSaving(false);
    } else {
      toast.success('Candidate updated');
      setSaving(false);
      onClose();
    }
  };

  const handleSaveAndPromote = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setPromoting(true);
    // First save edits
    const saveForm = new FormData();
    saveForm.append('candidateId', candidate.id);
    saveForm.append('rawName', name.trim());
    saveForm.append('rawWebsiteUrl', website.trim());
    saveForm.append('rawLocation', location.trim());
    const saveResult = await updateCandidateAction(null, saveForm);
    if (saveResult.error) {
      toast.error(saveResult.error);
      setPromoting(false);
      return;
    }
    // Then promote
    const promoteForm = new FormData();
    promoteForm.append('candidateId', candidate.id);
    const result = await promoteCandidateAction(null, promoteForm);
    if (result.error) {
      toast.error(result.error);
      setPromoting(false);
    } else {
      toast.success(`${name.trim()} promoted to prospect`);
      setPromoting(false);
      onPromoted();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving && !promoting) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border border-border bg-card shadow-2xl rounded-2xl">
        <div className="px-6 py-5 border-b border-border bg-muted/20">
          <DialogTitle className="text-heading-lg">Edit & Promote</DialogTitle>
          <DialogDescription className="text-label-12 text-muted-foreground mt-1">
            Review and edit candidate data before converting to a prospect.
          </DialogDescription>
        </div>

        <div className="px-6 py-6 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-label-14 font-semibold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              Company Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 text-copy-14"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-label-14 font-semibold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              Website
            </Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="h-11 text-copy-14"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-label-14 font-semibold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              Location
            </Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Region"
              className="h-11 text-copy-14"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/10 flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving || promoting}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleSave} disabled={saving || promoting}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
            <Button type="button" onClick={handleSaveAndPromote} disabled={saving || promoting}>
              {promoting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {promoting ? 'Promoting...' : 'Promote to Prospect'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
