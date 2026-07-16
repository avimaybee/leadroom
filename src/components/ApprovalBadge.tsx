'use client';

import { useEffect, useState, memo } from 'react';

export const ApprovalBadge = memo(function ApprovalBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch('/api/approvals/count');
        if (res.ok) {
          const data: { count?: number } = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {}
    }
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (count === null || count === 0) return null;

  return (
    <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
});
