'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Driver {
  name: string;
  value: number;
  description: string;
}

interface ClientScoreDriversProps {
  factors: string | null;
  scoreValue: number | null;
  scoreLabel: string | null;
}

export function ClientScoreDrivers({ factors, scoreValue, scoreLabel }: ClientScoreDriversProps) {
  const [isOpen, setIsOpen] = useState(false);

  let drivers: Driver[] = [];
  if (factors) {
    try {
      drivers = (JSON.parse(factors) as Driver[]).sort(
        (a, b) => Math.abs(b.value) - Math.abs(a.value),
      );
    } catch (e) {
      console.warn('[ClientScoreDrivers] Failed to parse score factors JSON:', e);
    }
  }

  if (drivers.length === 0) return null;

  const maxAbs = Math.max(...drivers.map((d) => Math.abs(d.value)), 1);
  const totalPos = drivers
    .filter((d) => d.value > 0)
    .reduce((s, d) => s + d.value, 0);
  const totalNeg = drivers
    .filter((d) => d.value < 0)
    .reduce((s, d) => s + Math.abs(d.value), 0);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="min-w-0">
          <span className="text-sm font-bold text-card-foreground flex items-center gap-2">
            Priority Score Driver Breakdown
            {!isOpen && (
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">
                {drivers.length} {drivers.length === 1 ? 'factor' : 'factors'}
              </span>
            )}
          </span>
          {!isOpen && (
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Click to see how the score breaks down by contributing factors
            </p>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-4" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-4" />
        )}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-4 border-t border-border animate-fade-in">
          <div className="space-y-0.5 pt-4">
            {drivers.map((d, i) => {
              const pct = (Math.abs(d.value) / maxAbs) * 100;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 py-1 group"
                  title={d.description}
                >
                  <span className="text-xs font-semibold text-card-foreground w-48 truncate shrink-0">
                    {d.name}
                  </span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        d.value > 0 ? 'bg-chart-2' : 'bg-destructive'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-black w-10 text-right shrink-0 ${
                      d.value > 0
                        ? 'text-chart-2'
                        : d.value < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {d.value > 0 ? `+${d.value}` : d.value}
                  </span>
                </div>
              );
            })}
          </div>

          {scoreValue !== null && (
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold border-t border-border pt-3">
              <span>
                +{totalPos} from positives &middot; &minus;{totalNeg} from negatives
              </span>
              <span className="font-bold text-card-foreground">
                Net: +{totalPos - totalNeg} &rarr; {scoreValue}/100
                {scoreLabel ? ` ${scoreLabel}` : ''}
              </span>
            </div>
          )}

          <p className="text-xs text-muted-foreground italic">
            Hover any row for details on each factor.
          </p>
        </div>
      )}
    </div>
  );
}
