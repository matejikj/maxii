import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiChip, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  asTimeZoneId,
  endOfCalendarDayExclusive,
  formatCalendarDate,
  parseCalendarDate,
  startOfCalendarDay,
  todayInZone,
  type CareEvent,
} from '../../domain';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';
import { useHistoryTabState } from '../../app/session/HistoryTabContext';
import { useCompositionRoot } from '../../app/providers';
import type { HistoryFilter } from '../../app/navigation/historyTabState';
import { presentCareEvent } from '../today/carePresentation';
import { PRODUCT_COPY } from '../ui';

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'Vše' },
  { id: 'care', label: 'Péče' },
  { id: 'activities', label: 'Aktivity' },
  { id: 'notes', label: 'Poznámky' },
];

type HistoryScreenProps = {
  onOpenEvent?: (eventId: string) => void;
};

/**
 * Day-scoped care list from the same diary as Today. Filters are view-only and
 * never delete records; “show today” only clears them via history tab state.
 */
export function HistoryScreen({ onOpenEvent }: HistoryScreenProps) {
  const { colors, ui } = useLumiTheme();
  const { profile } = useBootstrap();
  const runtime = usePersonalRuntime();
  const { services } = useCompositionRoot();
  const { state, setState } = useHistoryTabState();
  const [events, setEvents] = useState<CareEvent[]>([]);

  const zone = asTimeZoneId(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const childId = profile?.childId ?? null;

  const load = useCallback(async () => {
    if (!childId) {
      setEvents([]);
      return;
    }
    const focus =
      state.focusDate ?? formatCalendarDate(todayInZone(services.clock.now(), zone));
    const day = parseCalendarDate(focus);
    const fromMs = startOfCalendarDay(day, zone).epochMs;
    const toMs = endOfCalendarDayExclusive(day, zone).epochMs;
    const rows = await runtime.unitOfWork.run((uow) =>
      uow.care.listInSortRange(childId, fromMs, toMs),
    );
    setEvents(rows);
  }, [childId, runtime.unitOfWork, services.clock, state.focusDate, zone]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    const unsubscribe = runtime.readModels.subscribe((topics) => {
      if (topics.includes('care')) void load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [load, runtime.readModels]);

  // Activities/notes filters stay empty until those event types exist locally.
  const visible =
    state.filter === 'all' || state.filter === 'care' ? events : [];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { gap: ui.space.md }]}>
        <LumiText variant="h1" accessibilityRole="header">
          Historie
        </LumiText>
        <LumiText tone="muted">
          {state.focusDate
            ? `Zobrazený den ${state.focusDate}. Filtry zůstávají při běžném návratu zachované.`
            : 'Časová osa péče a vzpomínek. Filtry se při návratu ze záložky zachovají.'}
        </LumiText>
        <View style={styles.filters} accessibilityRole="summary">
          {FILTERS.map((filter) => (
            <LumiChip
              key={filter.id}
              label={filter.label}
              selected={state.filter === filter.id}
              onPress={() => setState({ ...state, filter: filter.id })}
            />
          ))}
        </View>
        {visible.length === 0 ? (
          <LumiText tone="muted">{PRODUCT_COPY.empty.littleHistory}</LumiText>
        ) : (
          visible.map((event) => {
            const item = presentCareEvent(event, zone);
            return (
              <Pressable
                key={event.eventId}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${item.detail}`}
                onPress={() => onOpenEvent?.(event.eventId)}
                style={[
                  styles.row,
                  { borderColor: colors.controlBorder, minHeight: 48, padding: ui.space.md },
                ]}
              >
                <LumiText>{item.title}</LumiText>
                <LumiText tone="muted">{item.detail}</LumiText>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, maxWidth: 600, width: '100%', alignSelf: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { borderWidth: 1, borderRadius: 12, gap: 4 },
});
