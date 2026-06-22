'use client';

import { formatDateTimeUTC } from '@/lib/date';
import { useState } from 'react';

export default function ClientActivityList({ activities }: { activities: any[] }) {
  const [search, setSearch] = useState('');

  if (!activities || activities.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground font-medium">
        No activity log found.
      </div>
    );
  }

  return (
    <div className="max-h-[420px] overflow-y-auto border border-border/60 rounded-xl bg-card">
      <div className="divide-y divide-border/40">
        {activities.map((act: any) => {
          const isNote = act.type === 'Note added';
          const hasError = act.metadata?.error;
          const hasBatch = act.metadata?.batch;
          
          return (
            <div key={act.id} className={`${isNote ? 'bg-chart-5/[0.02]' : ''}`}>
              {isNote ? (
                <div className="px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-chart-5/10 text-chart-5">
                        {act.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold shrink-0 whitespace-nowrap">
                        {formatDateTimeUTC(act.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-foreground leading-relaxed mt-1">
                      {act.summary}
                    </p>
                  </div>
                </div>
              ) : (
                <details className="group">
                  <summary className="flex flex-col gap-1.5 px-4 py-2.5 list-none marker:content-none cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3 w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-3 h-3 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground leading-tight shrink-0">
                          {act.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold shrink-0 whitespace-nowrap">
                        {formatDateTimeUTC(act.timestamp)}
                      </span>
                    </div>
                    <div className="pl-[22px] flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground font-medium truncate">
                        {act.summary}
                      </span>
                      {(hasError || hasBatch) && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-secondary text-secondary-foreground leading-tight shrink-0">
                          Has Metadata
                        </span>
                      )}
                    </div>
                  </summary>
                  <div className="px-4 pb-3 pl-[37px]">
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed mb-2">
                      {act.summary}
                    </p>
                    
                    {hasError && (
                      <div className="mt-2 bg-destructive/10 border border-destructive/20 rounded-md p-3">
                        <h4 className="text-xs font-bold text-destructive mb-1">Error Details</h4>
                        <p className="text-xs text-destructive/80 mb-2">{act.metadata.error.message}</p>
                        {act.metadata.error.payload && (
                          <div className="mt-2">
                            <h5 className="text-[10px] font-bold text-foreground">Payload:</h5>
                            <pre className="text-[10px] text-muted-foreground overflow-x-auto bg-background/50 p-2 rounded border border-border">
                              {JSON.stringify(act.metadata.error.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {hasBatch && act.metadata.batch.entities && (
                      <div className="mt-2 border border-border rounded-md p-3 bg-muted/10">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-xs font-bold text-foreground">Batch Entities</h4>
                          <input 
                            type="text" 
                            placeholder="Search IDs or Status..."
                            className="text-[10px] px-2 py-1 border border-border rounded-md bg-background w-32"
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          <table className="w-full text-left text-[10px]">
                            <thead>
                              <tr className="text-muted-foreground border-b border-border">
                                <th className="pb-1 font-medium">Entity ID</th>
                                <th className="pb-1 font-medium">Status</th>
                                <th className="pb-1 font-medium">Error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {act.metadata.batch.entities
                                .filter((e: any) => 
                                  search === '' || 
                                  e.id.toLowerCase().includes(search.toLowerCase()) || 
                                  e.status.toLowerCase().includes(search.toLowerCase())
                                )
                                .map((entity: any, i: number) => (
                                <tr key={i} className="border-b border-border/40 last:border-0">
                                  <td className="py-1.5 font-mono">{entity.id}</td>
                                  <td className="py-1.5">
                                    <span className={`px-1.5 py-0.5 rounded-sm ${entity.status.toLowerCase() === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                      {entity.status}
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-muted-foreground">{entity.error || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
