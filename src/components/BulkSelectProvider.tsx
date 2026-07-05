'use client';

import { createContext, useContext, useCallback, useState } from 'react';

interface BulkSelectContextType {
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  selectionCount: number;
}

const BulkSelectContext = createContext<BulkSelectContextType | null>(null);

export function BulkSelectProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  return (
    <BulkSelectContext.Provider
      value={{ selectedIds, toggleSelect, clearSelection, selectAll, selectionCount: selectedIds.size }}
    >
      {children}
    </BulkSelectContext.Provider>
  );
}

export function useBulkSelect() {
  const ctx = useContext(BulkSelectContext);
  if (!ctx) throw new Error('useBulkSelect must be used within BulkSelectProvider');
  return ctx;
}

export function LeadCheckbox({ leadId }: { leadId: string }) {
  const { selectedIds, toggleSelect } = useBulkSelect();
  return (
    <input
      type="checkbox"
      checked={selectedIds.has(leadId)}
      onChange={() => toggleSelect(leadId)}
      className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
    />
  );
}
