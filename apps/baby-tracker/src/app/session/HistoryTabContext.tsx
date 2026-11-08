import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  createInitialHistoryTabState,
  restoreHistoryContext,
  showTodayRecords,
  type HistoryTabState,
} from '../navigation/historyTabState';

type HistoryTabContextValue = {
  state: HistoryTabState;
  setState: (next: HistoryTabState) => void;
  showToday: (todayIsoDate: string) => void;
  rememberReturn: () => HistoryTabState;
};

const HistoryTabContext = createContext<HistoryTabContextValue | null>(null);

export function HistoryTabProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HistoryTabState>(createInitialHistoryTabState);
  const value = useMemo<HistoryTabContextValue>(
    () => ({
      state,
      setState,
      showToday: (todayIsoDate) => setState(showTodayRecords(todayIsoDate)),
      rememberReturn: () => restoreHistoryContext(state),
    }),
    [state],
  );
  return <HistoryTabContext.Provider value={value}>{children}</HistoryTabContext.Provider>;
}

export function useHistoryTabState(): HistoryTabContextValue {
  const value = useContext(HistoryTabContext);
  if (!value) {
    throw new Error('History tab state is unavailable outside HistoryTabProvider.');
  }
  return value;
}
