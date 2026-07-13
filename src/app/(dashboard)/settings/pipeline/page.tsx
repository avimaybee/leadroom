export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getDb } from '@/db';
import { PipelineAutomationCard } from '@/components/settings/PipelineAutomationCard';
import { pipelineConfig } from '@/db/schema/core';
import { eq } from 'drizzle-orm';
import { PIPELINE_STAGES } from '@/services/lead';
import { Info } from 'lucide-react';

export const metadata = {
  title: 'Pipeline Preferences | Leadroom',
};

export default async function PipelineSettingsPage() {
  const db = getDb();
  const [pcRow] = await Promise.all([
    db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1).then((r) => r[0] || null),
  ]);

  const config = pcRow?.stageRequirements
    ? (typeof pcRow.stageRequirements === 'object' ? pcRow.stageRequirements : {})
    : {};

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-label-14 text-primary font-semibold">ICP Optimization Suggestions</p>
          <p className="text-copy-14 text-primary/80 mt-0.5">
            View and manage learning suggestions in the{' '}
            <Link href="/learning" className="underline decoration-primary/40 underline-offset-4 hover:decoration-primary">
              Learning Inbox
            </Link>
            .
          </p>
        </div>
      </div>

      <PipelineAutomationCard
        stages={PIPELINE_STAGES as unknown as string[]}
        initialConfig={config as Record<string, unknown>}
      />
    </div>
  );
}
