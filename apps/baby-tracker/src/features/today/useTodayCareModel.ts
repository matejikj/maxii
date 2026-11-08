import { useCallback, useEffect, useState } from 'react';
import type { ActiveSession, CareEvent, ChildId } from '../../domain';
import {
  asTimeZoneId,
  endOfCalendarDayExclusive,
  formatCalendarDate,
  startOfCalendarDay,
  todayInZone,
} from '../../domain';
import { useCompositionRoot } from '../../app/providers';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';
import { presentLastCare, type LastCarePresentation } from './carePresentation';
import {
  DEFAULT_QUICK_ACTIONS,
  loadQuickActionOrder,
  moveQuickActionEarlier,
  saveQuickActionOrder,
  type QuickActionId,
} from './quickActions';

export type TodayCareModel = {
  loading: boolean;
  lastCare: LastCarePresentation | null;
  todayEvents: CareEvent[];
  activeSleep: ActiveSession | null;
  quickActions: QuickActionId[];
  calendarDate: string;
  refresh: () => Promise<void>;
  reorderQuickActionEarlier: (id: QuickActionId) => Promise<void>;
};

export function useTodayCareModel(
  childId: ChildId | null,
  summaryTimeZone: string | undefined,
): TodayCareModel {
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [loading, setLoading] = useState(true);
  const [lastCare, setLastCare] = useState<LastCarePresentation | null>(null);
  const [todayEvents, setTodayEvents] = useState<CareEvent[]>([]);
  const [activeSleep, setActiveSleep] = useState<ActiveSession | null>(null);
  const [quickActions, setQuickActions] = useState<QuickActionId[]>([...DEFAULT_QUICK_ACTIONS]);
  const [calendarDate, setCalendarDate] = useState('');

  const refresh = useCallback(async () => {
    if (!childId) {
      setLoading(false);
      setLastCare(null);
      setTodayEvents([]);
      setActiveSleep(null);
      return;
    }
    const zone = asTimeZoneId(summaryTimeZone ?? 'Europe/Prague');
    const now = services.clock.now();
    const today = todayInZone(now, zone);
    const fromMs = startOfCalendarDay(today, zone).epochMs;
    const toMs = endOfCalendarDayExclusive(today, zone).epochMs;
    const [recent, dayEvents, sleep, order] = await Promise.all([
      runtime.unitOfWork.run((uow) => uow.care.listRecent(childId, 20)),
      runtime.unitOfWork.run((uow) => uow.care.listInSortRange(childId, fromMs, toMs)),
      runtime.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'sleep')),
      loadQuickActionOrder(runtime.unitOfWork),
    ]);
    setLastCare(presentLastCare(recent, zone));
    setTodayEvents(dayEvents);
    setActiveSleep(sleep);
    setQuickActions(order);
    setCalendarDate(formatCalendarDate(today));
    setLoading(false);
  }, [childId, runtime.unitOfWork, services.clock, summaryTimeZone]);

  useEffect(() => {
    let cancelled = false;
    // Defer the first read so the effect only syncs to an external diary, not
    // cascade-render from the render that mounted this hook.
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    const unsubscribe = runtime.readModels.subscribe((topics) => {
      if (topics.includes('care') || topics.includes('sessions') || topics.includes('profile')) {
        void refresh();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refresh, runtime.readModels]);

  const reorderQuickActionEarlier = useCallback(
    async (id: QuickActionId) => {
      const next = moveQuickActionEarlier(quickActions, id);
      const saved = await saveQuickActionOrder(runtime.unitOfWork, next);
      setQuickActions(saved);
    },
    [quickActions, runtime.unitOfWork],
  );

  return {
    loading,
    lastCare,
    todayEvents,
    activeSleep,
    quickActions,
    calendarDate,
    refresh,
    reorderQuickActionEarlier,
  };
}
