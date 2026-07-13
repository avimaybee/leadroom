export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getICPProfileAction } from '@/app/actions/strategy';
import { IcpForm } from '@/components/settings/IcpForm';

export const metadata = {
  title: 'Edit Ideal Client | Leadroom',
};

export default async function EditIcpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getICPProfileAction(id);
  if (!result.success || !result.profile) notFound();

  const profile = result.profile;

  return (
    <div>
      <h2 className="text-heading-lg mb-1">Edit Ideal Client</h2>
      <p className="text-copy-14 text-muted-foreground mb-6 max-w-2xl">
        Update your ideal client parameters and signals.
      </p>
      <IcpForm
        initialData={{
          id: profile.id,
          name: profile.name,
          positiveSignals: profile.positiveSignals,
          negativeSignals: profile.negativeSignals,
          disqualifiers: profile.disqualifiers,
        }}
      />
    </div>
  );
}
