'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Trophy, MessageCircle, TrendingDown, Lightbulb } from 'lucide-react';
import { getPipelineAnalyticsAction } from '@/app/actions/pipeline';

interface Analytics {
  totalActive: number;
  won: number;
  replied: number;
  bounced: number;
  pendingSuggestions: number;
}

export function PipelineAnalytics() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPipelineAnalyticsAction().then(r => {
      if (r.success) {
        setAnalytics({
          totalActive: r.totalActive,
          won: r.won,
          replied: r.outcomeStats.replied,
          bounced: r.outcomeStats.bounced,
          pendingSuggestions: r.pendingSuggestions,
        });
      }
      setLoading(false);
    });
  }, []);

  if (loading || !analytics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    );
  }

  const cards = [
    { key: 'totalActive', label: 'Total Active', value: analytics.totalActive, icon: Users, color: '', href: '/prospects' },
    { key: 'won', label: 'Won', value: analytics.won, icon: Trophy, color: 'text-chart-2', href: '/prospects?stage=Won' },
    { key: 'replied', label: 'Positive Outcomes', value: analytics.replied, icon: MessageCircle, color: 'text-chart-5', href: undefined },
    { key: 'bounced', label: 'Bounced / Lost', value: analytics.bounced, icon: TrendingDown, color: 'text-destructive', href: undefined },
    { key: 'suggestions', label: 'Learning Suggestions', value: analytics.pendingSuggestions, icon: Lightbulb, color: '', href: '/settings/insights' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {cards.map(({ key, label, value, icon: Icon, color, href }) => {
        const card = (
          <div className={`rounded-lg border border-border p-4 flex flex-col justify-between h-24 transition-colors ${
            value === 0 ? 'bg-muted/30' : 'bg-card'
          } ${href ? 'hover:border-primary/40 hover:shadow-sm' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-label-12 text-muted-foreground uppercase">{label}</span>
              <Icon className={`w-4 h-4 ${href ? 'text-muted-foreground/70' : 'text-muted-foreground'}`} />
            </div>
            <span className={`text-heading-2xl ${color || 'text-foreground'}`}>{value}</span>
          </div>
        );
        return href ? (
          <Link key={key} href={href} className="block" title={`View ${label}`}>
            {card}
          </Link>
        ) : (
          <div key={key}>{card}</div>
        );
      })}
    </div>
  );
}
