import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LumiButton,
  LumiChip,
  LumiInput,
  LumiText,
  useLumiTheme,
} from '@lumi/forest-design/native';
import {
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  endOfCalendarDayExclusive,
  formatCalendarDate,
  parseCalendarDate,
  startOfCalendarDay,
  todayInZone,
  type CareEvent,
  type CareSubtype,
  type DeletionMarker,
  type Draft,
  type TimelineCursor,
} from '../../domain';
import {
  careEventFromTrashMarker,
  loadDraftsForChild,
  loadHistoryDay,
  loadHistoryPage,
  loadRestorableTrash,
  rebuildSearchIndex,
} from '../../application';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';
import { useHistoryTabState } from '../../app/session/HistoryTabContext';
import { useCompositionRoot } from '../../app/providers';
import {
  clearHistoryFilters,
  formatIsoCalendarDate,
  historyFiltersActive,
  type HistoryFilter,
  type HistorySection,
} from '../../app/navigation/historyTabState';
import { FamilyConflictsPanel } from '../family/FamilyConflictsPanel';
import { presentCareEvent } from '../today/carePresentation';
import { PRODUCT_COPY } from '../ui';

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'Vše' },
  { id: 'care', label: 'Péče' },
  { id: 'activities', label: 'Aktivity' },
  { id: 'notes', label: 'Poznámky' },
];

const CARE_SUBTYPES: { id: CareSubtype; label: string }[] = [
  { id: 'diaper', label: 'Plenka' },
  { id: 'sleep', label: 'Spánek' },
  { id: 'nursing', label: 'Kojení' },
  { id: 'bottle', label: 'Lahvička' },
  { id: 'food', label: 'Jídlo' },
  { id: 'growth', label: 'Růst' },
];

const SECTIONS: { id: HistorySection; label: string }[] = [
  { id: 'timeline', label: PRODUCT_COPY.history.timeline },
  { id: 'drafts', label: PRODUCT_COPY.history.drafts },
  { id: 'trash', label: PRODUCT_COPY.history.trash },
];

const PAGE_SIZE = 40;

type HistoryScreenProps = {
  onOpenEvent?: (eventId: string) => void;
};

/**
 * Shared care memory: day/timeline filters, local search, drafts and trash.
 * Never mixes soft-deleted or draft rows into the real event list.
 */
export function HistoryScreen({ onOpenEvent }: HistoryScreenProps) {
  const { colors, ui } = useLumiTheme();
  const { profile } = useBootstrap();
  const runtime = usePersonalRuntime();
  const { services } = useCompositionRoot();
  const { state, setState } = useHistoryTabState();
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<TimelineCursor | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [trash, setTrash] = useState<DeletionMarker[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const zone = asTimeZoneId(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const childId = profile?.childId ?? null;
  const todayIso = formatCalendarDate(todayInZone(services.clock.now(), zone));
  const yesterdayIso = useMemo(() => {
    const todayStart = startOfCalendarDay(parseCalendarDate(todayIso), zone);
    return formatIsoCalendarDate(todayStart.epochMs - 12 * 60 * 60 * 1000, zone);
  }, [todayIso, zone]);

  const filtersOn = historyFiltersActive(state);

  const loadTimeline = useCallback(async () => {
    if (!childId) {
      setEvents([]);
      setNextCursor(null);
      return;
    }
    if (state.focusDate) {
      const day = parseCalendarDate(state.focusDate);
      const fromMs = startOfCalendarDay(day, zone).epochMs;
      const toMs = endOfCalendarDayExclusive(day, zone).epochMs;
      const rows = await runtime.unitOfWork.run((uow) =>
        loadHistoryDay(uow, {
          childId,
          fromSortAtMsInclusive: fromMs,
          toSortAtMsExclusive: toMs,
          bucket: state.filter,
          careSubtype: state.careSubtype,
          searchQuery: state.searchQuery,
        }),
      );
      setEvents(rows);
      setNextCursor(null);
      return;
    }
    const page = await runtime.unitOfWork.run((uow) =>
      loadHistoryPage(uow, {
        childId,
        bucket: state.filter,
        careSubtype: state.careSubtype,
        searchQuery: state.searchQuery,
        limit: PAGE_SIZE,
        before: null,
      }),
    );
    setEvents(page.events);
    setNextCursor(page.nextCursor);
  }, [
    childId,
    runtime.unitOfWork,
    state.careSubtype,
    state.filter,
    state.focusDate,
    state.searchQuery,
    zone,
  ]);

  const loadAux = useCallback(async () => {
    if (!childId) {
      setDrafts([]);
      setTrash([]);
      return;
    }
    const nowMs = services.clock.now().epochMs;
    const [draftRows, trashRows] = await runtime.unitOfWork.run(async (uow) => [
      await loadDraftsForChild(uow, childId),
      await loadRestorableTrash(uow, nowMs),
    ]);
    setDrafts(draftRows);
    setTrash(trashRows);
  }, [childId, runtime.unitOfWork, services.clock]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void loadTimeline();
      void loadAux();
    });
    const unsubscribe = runtime.readModels.subscribe((topics) => {
      if (
        topics.includes('care') ||
        topics.includes('drafts') ||
        topics.includes('revisions')
      ) {
        void loadTimeline();
        void loadAux();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadAux, loadTimeline, runtime.readModels]);

  async function loadOlder() {
    if (!childId || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await runtime.unitOfWork.run((uow) =>
        loadHistoryPage(uow, {
          childId,
          bucket: state.filter,
          careSubtype: state.careSubtype,
          searchQuery: state.searchQuery,
          limit: PAGE_SIZE,
          before: nextCursor,
        }),
      );
      setEvents((prev) => [...prev, ...page.events]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function restoreTrashItem(marker: DeletionMarker) {
    const intentMs = services.clock.now().epochMs;
    const result = await runtime.commands.dispatch({
      type: 'restoreCare',
      operationId: asOperationId(services.ids.createId('op')),
      intentCapturedAt: { epochMs: intentMs },
      eventId: marker.entityId,
      deletionId: marker.deletionId,
      revisionId: asRevisionId(services.ids.createId('rev')),
      expectedDeletionRevisionId: marker.revisionId,
    });
    setStatusMessage(result.ok ? PRODUCT_COPY.feedback.restored : PRODUCT_COPY.feedback.saveFailed);
  }

  async function discardDraft(draft: Draft) {
    const intentMs = services.clock.now().epochMs;
    await runtime.commands.dispatch({
      type: 'discardDraft',
      operationId: asOperationId(services.ids.createId('op')),
      intentCapturedAt: { epochMs: intentMs },
      draftId: draft.draftId,
      revisionId: asRevisionId(services.ids.createId('rev')),
    });
  }

  async function onRebuildSearch() {
    if (!childId) return;
    const count = await runtime.unitOfWork.run((uow) => rebuildSearchIndex(uow, childId));
    setStatusMessage(`${PRODUCT_COPY.feedback.searchRebuilt} (${count})`);
    void loadTimeline();
  }

  const emptyTimelineMessage = filtersOn
    ? PRODUCT_COPY.feedback.filtersEmpty
    : PRODUCT_COPY.empty.littleHistory;

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

        <FamilyConflictsPanel />

        <View style={styles.filters} accessibilityRole="summary">
          {SECTIONS.map((section) => (
            <LumiChip
              key={section.id}
              label={section.label}
              selected={state.section === section.id}
              onPress={() => setState({ ...state, section: section.id })}
            />
          ))}
        </View>

        {state.section === 'timeline' ? (
          <>
            <View style={styles.filters}>
              <LumiChip
                label={PRODUCT_COPY.actions.today}
                selected={state.focusDate === todayIso}
                onPress={() => setState({ ...state, focusDate: todayIso })}
              />
              <LumiChip
                label={PRODUCT_COPY.actions.yesterday}
                selected={state.focusDate === yesterdayIso}
                onPress={() => setState({ ...state, focusDate: yesterdayIso })}
              />
              <LumiChip
                label="Všechny dny"
                selected={state.focusDate == null}
                onPress={() => setState({ ...state, focusDate: null })}
              />
            </View>

            <LumiInput
              label={PRODUCT_COPY.history.pickDate}
              accessibilityLabel={PRODUCT_COPY.history.pickDate}
              placeholder={PRODUCT_COPY.history.pickDate}
              value={state.focusDate ?? ''}
              onChangeText={(value) =>
                setState({
                  ...state,
                  focusDate: value.trim().length === 0 ? null : value.trim(),
                })
              }
              autoCapitalize="none"
              autoCorrect={false}
            />

            <LumiInput
              label={PRODUCT_COPY.history.search}
              accessibilityLabel={PRODUCT_COPY.history.search}
              placeholder={PRODUCT_COPY.history.search}
              value={state.searchQuery}
              onChangeText={(searchQuery) => setState({ ...state, searchQuery })}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.filters}>
              {FILTERS.map((filter) => (
                <LumiChip
                  key={filter.id}
                  label={filter.label}
                  selected={state.filter === filter.id}
                  onPress={() =>
                    setState({
                      ...state,
                      filter: filter.id,
                      careSubtype: filter.id === 'care' ? state.careSubtype : null,
                    })
                  }
                />
              ))}
            </View>

            {state.filter === 'care' ? (
              <View style={styles.filters} accessibilityLabel={PRODUCT_COPY.history.careSubtypes}>
                {CARE_SUBTYPES.map((subtype) => (
                  <LumiChip
                    key={subtype.id}
                    label={subtype.label}
                    selected={state.careSubtype === subtype.id}
                    onPress={() =>
                      setState({
                        ...state,
                        careSubtype: state.careSubtype === subtype.id ? null : subtype.id,
                      })
                    }
                  />
                ))}
              </View>
            ) : null}

            {filtersOn ? (
              <LumiButton
                title={PRODUCT_COPY.actions.clearFilters}
                onPress={() => setState(clearHistoryFilters(state))}
                fullWidth
              />
            ) : null}

            {events.length === 0 ? (
              <LumiText tone="muted">{emptyTimelineMessage}</LumiText>
            ) : (
              events.map((event) => {
                const item = presentCareEvent(event, zone);
                return (
                  <Pressable
                    key={event.eventId}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}, ${item.detail}`}
                    onPress={() => onOpenEvent?.(event.eventId)}
                    style={[
                      styles.row,
                      {
                        borderColor: colors.controlBorder,
                        minHeight: 48,
                        padding: ui.space.md,
                      },
                    ]}
                  >
                    <LumiText>{item.title}</LumiText>
                    <LumiText tone="muted">{item.detail}</LumiText>
                  </Pressable>
                );
              })
            )}

            {nextCursor && state.focusDate == null ? (
              <LumiButton
                title={loadingMore ? 'Načítám…' : PRODUCT_COPY.actions.loadMore}
                onPress={() => void loadOlder()}
                fullWidth
                disabled={loadingMore}
              />
            ) : null}

            <LumiButton
              title={PRODUCT_COPY.actions.rebuildSearch}
              onPress={() => void onRebuildSearch()}
              fullWidth
            />
          </>
        ) : null}

        {state.section === 'drafts' ? (
          drafts.length === 0 ? (
            <LumiText tone="muted">{PRODUCT_COPY.feedback.draftsEmpty}</LumiText>
          ) : (
            drafts.map((draft) => (
              <View
                key={draft.draftId}
                style={[
                  styles.row,
                  { borderColor: colors.controlBorder, padding: ui.space.md, gap: ui.space.sm },
                ]}
              >
                <LumiText>{draft.formType}</LumiText>
                <LumiText tone="muted">
                  {PRODUCT_COPY.history.originalDraftTime}:{' '}
                  {formatIsoCalendarDate(draft.originalEventTime.epochMs, zone)}
                </LumiText>
                <View style={styles.rowActions}>
                  <LumiButton
                    title={PRODUCT_COPY.actions.continueDraft}
                    onPress={() =>
                      setState({
                        ...state,
                        section: 'timeline',
                        openDraftFormType: draft.formType,
                      })
                    }
                  />
                  <LumiButton
                    title={PRODUCT_COPY.actions.discardDraft}
                    onPress={() => void discardDraft(draft)}
                  />
                </View>
              </View>
            ))
          )
        ) : null}

        {state.section === 'trash' ? (
          trash.length === 0 ? (
            <LumiText tone="muted">{PRODUCT_COPY.feedback.trashEmpty}</LumiText>
          ) : (
            trash.map((marker) => {
              const event = careEventFromTrashMarker(marker);
              const label = event
                ? presentCareEvent(event, zone).title
                : `Smazaný záznam ${marker.entityId}`;
              return (
                <View
                  key={marker.deletionId}
                  style={[
                    styles.row,
                    { borderColor: colors.controlBorder, padding: ui.space.md, gap: ui.space.sm },
                  ]}
                >
                  <LumiText>{label}</LumiText>
                  <LumiText tone="muted">
                    Koš do {formatIsoCalendarDate(marker.retainUntil.epochMs, zone)}
                  </LumiText>
                  <LumiButton
                    title={PRODUCT_COPY.actions.restore}
                    onPress={() => void restoreTrashItem(marker)}
                  />
                </View>
              );
            })
          )
        ) : null}

        {statusMessage ? <LumiText tone="muted">{statusMessage}</LumiText> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, maxWidth: 600, width: '100%', alignSelf: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { borderWidth: 1, borderRadius: 12, gap: 4 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
