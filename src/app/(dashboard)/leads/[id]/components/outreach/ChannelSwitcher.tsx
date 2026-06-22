'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type Channel = 'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING';

interface ChannelSwitcherProps {
  selectedChannel: Channel;
  onChange: (channel: Channel) => void;
  draftCounts: Record<Channel, number>;
}

export function ChannelSwitcher({ selectedChannel, onChange, draftCounts }: ChannelSwitcherProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4 w-full">
      <Tabs
        value={selectedChannel}
        onValueChange={(val) => onChange(val as Channel)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="EMAIL" className="text-xs font-bold relative">
            Email
            {draftCounts.EMAIL > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-muted text-[10px] text-muted-foreground font-semibold rounded-full border border-border/60">
                {draftCounts.EMAIL}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="LINKEDIN" className="text-xs font-bold relative">
            LinkedIn
            {draftCounts.LINKEDIN > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-muted text-[10px] text-muted-foreground font-semibold rounded-full border border-border/60">
                {draftCounts.LINKEDIN}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="CALL" className="text-xs font-bold relative">
            Call Prep
            {draftCounts.CALL > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-muted text-[10px] text-muted-foreground font-semibold rounded-full border border-border/60">
                {draftCounts.CALL}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="MEETING" className="text-xs font-bold relative">
            Meeting Prep
            {draftCounts.MEETING > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-muted text-[10px] text-muted-foreground font-semibold rounded-full border border-border/60">
                {draftCounts.MEETING}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
