export const dynamic = 'force-dynamic';
import { getDb } from '@/db';
import { stageThresholds } from '@/db/schema/core';
import { updateStageThreshold } from '@/app/actions/pipeline';

export default async function PipelineSettingsPage() {
  const db = getDb();
  const thresholdsData = await db.select().from(stageThresholds);
  
  const thresholds = thresholdsData.reduce((acc, t) => {
    acc[t.stage] = t.days;
    return acc;
  }, {} as Record<string, number>);

  const stages = ['New', 'In Research', 'Auditing', 'Audited', 'Drafting', 'Ready to Send', 'Outreach Sent', 'Meeting', 'Won', 'Lost'];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Preferences</h1>
      <p className="text-muted-foreground mb-6">Set staleness thresholds (in days) for each pipeline stage. Leads idle longer than these thresholds will appear in the Daily Priority feed.</p>
      
      <div className="space-y-4">
        {stages.map(stage => {
          const defaultDays = 5;
          const currentDays = thresholds[stage] ?? defaultDays;

          return (
            <div key={stage} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl shadow-sm">
              <div>
                <h3 className="font-semibold">{stage}</h3>
                <p className="text-xs text-muted-foreground">Alert after {currentDays} days of inactivity</p>
              </div>
              <form action={async (formData: FormData) => {
                'use server';
                const days = parseInt(formData.get('days') as string, 10);
                if (!isNaN(days)) {
                  await updateStageThreshold(stage, days);
                }
              }} className="flex items-center gap-2">
                <input 
                  type="number" 
                  name="days" 
                  defaultValue={currentDays} 
                  min="1"
                  className="w-20 px-3 py-1.5 rounded-md border border-input bg-background text-sm" 
                />
                <button type="submit" className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90">
                  Save
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
