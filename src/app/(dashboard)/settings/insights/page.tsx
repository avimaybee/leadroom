export const dynamic = 'force-dynamic';

import { getLearningSuggestionsAction } from '@/app/actions/learning';
import { LearningInbox } from '@/components/settings/LearningInbox';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Insights Suggestions | Leadroom',
};

export default async function SettingsInsightsPage() {
  const result = await getLearningSuggestionsAction();
  const suggestions = result.success ? result.suggestions : [];
  const pendingCount = suggestions.filter((s: any) => s.status === 'PENDING').length;
  const appliedCount = suggestions.filter((s: any) => s.status === 'APPLIED').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-heading-2xl">Insights Suggestions</h2>
        <p className="text-copy-14 text-muted-foreground mt-1">
          As you log outcomes — replies, wins, losses — the system analyzes pattern variations and suggests criteria changes here.
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <Badge>{pendingCount} Pending</Badge>
        <Badge variant="secondary">{appliedCount} Applied</Badge>
      </div>

      <LearningInbox initialSuggestions={suggestions as any[]} />
    </div>
  );
}
