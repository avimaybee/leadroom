'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toggleAutomationAction } from './actions';

export function AutomationToggle({ eventType, initialEnabled }: { eventType: string, initialEnabled: boolean }) {
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const newValue = !isEnabled;
    setIsEnabled(newValue);
    startTransition(() => {
      toggleAutomationAction(eventType, newValue);
    });
  };

  return (
    <Button
      variant={isEnabled ? 'default' : 'outline'}
      onClick={toggle}
      disabled={isPending}
    >
      {isEnabled ? 'Enabled' : 'Disabled'}
    </Button>
  );
}
