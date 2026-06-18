import { getDb } from '@/db';
import { automationSettings } from '@/db/schema/core';
import { eq } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toggleAutomationAction } from './actions';
import { AutomationToggle } from './AutomationToggle';

export default async function AutomationsPage() {
  const db = getDb();
  const userId = await getUserId();
  
  if (!userId) {
    return <div>Please log in</div>;
  }

  const settings = await db.select().from(automationSettings).where(eq(automationSettings.userId, userId));
  const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.eventType]: s.isEnabled }), {} as Record<string, boolean>);

  // Default to true if not found in db
  const researchEnabled = settingsMap['research.completed'] ?? true;
  const auditEnabled = settingsMap['audit.completed'] ?? true;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
        <p className="text-muted-foreground mt-2">
          Configure event-driven workflows to automate tasks and streamline your follow-up process.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Triggers</CardTitle>
          <CardDescription>
            Automatically create follow-up tasks when background jobs complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Research Completed</Label>
              <p className="text-sm text-muted-foreground">
                Generate a "Review Research" task when a background research job completes.
              </p>
            </div>
            <AutomationToggle eventType="research.completed" initialEnabled={researchEnabled} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Audit Completed</Label>
              <p className="text-sm text-muted-foreground">
                Generate a "Review Audit Report" task when a website audit completes.
              </p>
            </div>
            <AutomationToggle eventType="audit.completed" initialEnabled={auditEnabled} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
