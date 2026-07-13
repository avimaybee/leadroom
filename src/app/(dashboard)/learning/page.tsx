export const dynamic = 'force-dynamic';

import { getLearningSuggestionsAction } from '@/app/actions/learning';
import { LearningInbox } from './LearningInbox';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Learning Inbox | Leadroom',
};

export default async function LearningPage() {
  const result = await getLearningSuggestionsAction();
  const suggestions = result.success ? result.suggestions : [];
  const pendingCount = suggestions.filter((s: any) => s.status === 'PENDING').length;
  const appliedCount = suggestions.filter((s: any) => s.status === 'APPLIED').length;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-heading-2xl">Learning Inbox</h2>
        <p className="text-copy-14 text-muted-foreground mt-1">
          The system analyzes outcome patterns and suggests ICP improvements.
        </p>
      </div>
      <div className="flex items-center gap-2 mb-6">
        <Badge>{pendingCount} Pending</Badge>
        <Badge variant="secondary">{appliedCount} Applied</Badge>
      </div>
      <LearningInbox initialSuggestions={suggestions as any[]} />
    </div>
  );
}
