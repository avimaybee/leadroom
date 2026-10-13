export const dynamic = 'force-dynamic';

import { OfferForm } from '@/components/settings/OfferForm';

export const metadata = {
  title: 'New Offer | Leadroom',
};

export default function NewOfferPage() {
  return (
    <div>
      <h2 className="text-heading-lg mb-1">New Offer</h2>
      <p className="text-copy-14 text-muted-foreground mb-6 max-w-2xl">
        Define what you sell — the pain you solve, outcomes you deliver, and proof you can cite.
      </p>
      <OfferForm />
    </div>
  );
}
