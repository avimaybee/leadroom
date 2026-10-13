export const dynamic = 'force-dynamic';

import { IcpForm } from '@/components/settings/IcpForm';

export const metadata = {
  title: 'Define Ideal Client | Leadroom',
};

export default function NewIcpPage() {
  return (
    <div>
      <h2 className="text-heading-lg mb-1">Define Ideal Client</h2>
      <p className="text-copy-14 text-muted-foreground mb-6 max-w-2xl">
        Define signals that indicate a good-fit prospect. The scoring preview below lets you tune weights in real time.
      </p>
      <IcpForm />
    </div>
  );
}
