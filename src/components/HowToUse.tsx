'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const sections = [
  {
    title: '1. Define a Campaign',
    body: 'Go to Campaigns and create a discovery scope. Set your target market (industry, location, business size). Choose how many leads to scan — start with 5–10 to validate before scaling.',
  },
  {
    title: '2. Discover Leads',
    body: 'Run the scan. The system finds matching businesses from public sources. Review the candidate list, remove mismatches, and import promising leads into your pipeline.',
  },
  {
    title: '3. Research & Enrich',
    body: 'Open a lead and run Research. The system fetches website content, extracts business details, and builds a research snapshot with source links and confidence markers. Review and edit the results.',
  },
  {
    title: '4. Audit & Score',
    body: 'Switch to the Audit tab. Review the website analysis, brand positioning, messaging, and opportunity flags. The lead score helps you prioritize — higher scores mean stronger potential.',
  },
  {
    title: '5. Draft Outreach',
    body: 'Go to Outreach. Review the drafted email, call, or proposal. Edit the tone and content. Nothing is sent automatically — you must approve each draft before it becomes actionable.',
  },
  {
    title: '6. Track & Follow Up',
    body: 'Use the Activity tab to log calls, emails, and notes. Update the lead stage as it moves through your pipeline. Add tasks and reminders so nothing falls through the cracks.',
  },
];

export function HowToUse() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="xs" aria-label="How to use Leadroom">How to use?</Button>} />
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How to Use Leadroom</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-copy-14 text-muted-foreground">
          <p>
            Leadroom is an internal operating system for agency growth. It helps you discover,
            research, audit, and reach out to potential clients — with human judgment at every step.
          </p>
          <div className="space-y-4">
            {sections.map((s) => (
              <div key={s.title}>
                <h3 className="text-label-14 text-foreground mb-1">{s.title}</h3>
                <p className="text-copy-14">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-4 mt-6">
            <h3 className="text-label-14 text-foreground mb-1">Key Principles</h3>
            <ul className="text-copy-14 space-y-1 list-disc pl-4">
              <li>The system never sends outreach without your approval.</li>
              <li>All research is reviewable and editable — source evidence is preserved.</li>
              <li>You can override any score, status, or field manually.</li>
              <li>Start small. Validate 5–10 leads before scaling up.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
