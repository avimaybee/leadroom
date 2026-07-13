export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Plus, Info } from 'lucide-react';
import { listICPProfilesAction } from '@/app/actions/strategy';

export const metadata = {
  title: 'ICP Profiles | Leadroom',
};

export default async function IcpListPage() {
  const result = await listICPProfilesAction();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-heading-2xl">ICP Profiles</h2>
          <p className="text-copy-14 text-muted-foreground mt-1">
            Define your Ideal Customer Profile with weighted signals and disqualifiers.
          </p>
        </div>
        <Link
          href="/settings/icp/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create ICP Profile
        </Link>
      </div>

      {!result.success || result.profiles.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <Info className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-heading-lg text-foreground">No ICP profiles yet</h3>
          <p className="text-copy-14 text-muted-foreground mt-1 max-w-md mx-auto">
            Define who you want to sell to. ICP profiles drive fit scoring and prospect prioritization.
          </p>
          <Link
            href="/settings/icp/new"
            className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-label-14 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create ICP Profile
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Positive Signals</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Negative Signals</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Disqualifiers</th>
                <th className="text-left px-4 py-3 text-label-12 text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {result.profiles.map((profile) => {
                const pos = profile.positiveSignals ? JSON.parse(profile.positiveSignals) : [];
                const neg = profile.negativeSignals ? JSON.parse(profile.negativeSignals) : [];
                const disq = profile.disqualifiers ? JSON.parse(profile.disqualifiers) : [];
                return (
                  <tr
                    key={profile.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/settings/icp/${profile.id}`}
                  >
                    <td className="px-4 py-3 text-copy-14 font-medium">{profile.name}</td>
                    <td className="px-4 py-3 text-copy-13 text-muted-foreground">{pos.length}</td>
                    <td className="px-4 py-3 text-copy-13 text-muted-foreground">{neg.length}</td>
                    <td className="px-4 py-3 text-copy-13 text-muted-foreground">{disq.length}</td>
                    <td className="px-4 py-3 text-copy-13 text-muted-foreground">
                      {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
