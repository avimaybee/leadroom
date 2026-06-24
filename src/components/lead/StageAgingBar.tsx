'use client';

interface Props {
  stage: string;
  stageUpdatedAt: Date | null;
  daysThreshold: number;
  autoFollowUpDue?: Date | null;
}

export function StageAgingBar({ stage, stageUpdatedAt, daysThreshold, autoFollowUpDue }: Props) {
  if (!stageUpdatedAt) return null;

  const ageMs = Date.now() - new Date(stageUpdatedAt).getTime();
  const ageDays = Math.round((ageMs / (24 * 60 * 60 * 1000)) * 10) / 10;
  const progress = Math.min(ageDays / daysThreshold, 1);
  const percent = Math.round(progress * 100);

  const isStale = ageDays >= daysThreshold;
  const isWarning = ageDays >= daysThreshold * 0.8 && !isStale;

  const barColor = isStale ? 'bg-destructive' : isWarning ? 'bg-chart-5' : 'bg-primary/60';
  const remainingDays = Math.max(0, daysThreshold - ageDays);
  const expectedExit = new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000);

  return (
    <div className="bg-card p-5 rounded-xl border border-border space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-label-14 text-foreground uppercase">Stage Progress</h3>
        <span className={`text-label-12 font-semibold ${isStale ? 'text-destructive' : isWarning ? 'text-chart-5' : 'text-muted-foreground'}`}>
          {isStale ? '\u26A0 Stale' : isWarning ? '\u26A0 Approaching limit' : 'On track'}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-label-12 text-muted-foreground">
          <span>{stage}</span>
          <span>{daysThreshold}d threshold</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden border border-border/20">
          <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
        <div className="flex justify-between text-label-12">
          <span className={isStale ? 'text-destructive font-semibold' : 'text-foreground'}>{ageDays}d in stage</span>
          <span className="text-muted-foreground">{percent}% of threshold</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50">
        <div>
          <span className="text-label-12 text-muted-foreground">Auto follow-up</span>
          <p className="text-copy-13 text-foreground mt-0.5">
            {autoFollowUpDue ? `Due ${autoFollowUpDue.toLocaleDateString()}` : 'None scheduled'}
          </p>
        </div>
        <div>
          <span className="text-label-12 text-muted-foreground">If no movement by</span>
          <p className={`text-copy-13 mt-0.5 ${isStale ? 'text-destructive font-semibold' : 'text-foreground'}`}>
            {expectedExit.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}
