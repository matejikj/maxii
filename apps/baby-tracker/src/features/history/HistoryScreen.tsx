import React, { useContext, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiCard, LumiChip, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { CareSubtype, Draft } from '../../domain';
import { careEventFromTrashMarker } from '../../application';
import { useHistoryTabState } from '../../app/session/HistoryTabContext';
import { useForestDockInset } from '../../app/navigation/ForestGlassTabBar';
import { clearHistoryFilters, historyFiltersActive, type HistoryFilter, type HistorySection } from '../../app/navigation/historyTabState';
import { ChildSwitcher } from '../shell/ChildSwitcher';
import { CompactActiveSessionsVisibleContext } from '../shell/CompactActiveSessions';
import { FamilyConflictsPanel } from '../family/FamilyConflictsPanel';
import { ForestIconBadge } from '../ui/ForestIconBadge';
import { CareActionSheet, PRODUCT_COPY } from '../ui';
import { presentCareEvent } from '../today/carePresentation';
import {
  draftPreviewFields, groupHistoryByDay, HISTORY_EVENT_LABELS, historyCountLabel,
  historyDateLabel, historyDayLabel, parseHistoryDateInput, shiftHistoryDay,
} from './historyPresentation';
import { HistoryDayArrow, HistoryDayHeading, HistoryEmpty, HistoryEventRow, HistoryHero, HistoryPeriodButton, HistorySectionTabs, HISTORY_TONES } from './HistoryVisuals';
import { useHistoryModel } from './useHistoryModel';

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'Vše' }, { id: 'care', label: 'Péče' },
  { id: 'activities', label: 'Zážitky' }, { id: 'notes', label: 'Poznámky' },
];
const CARE_SUBTYPES: { id: CareSubtype; label: string }[] = [
  { id: 'diaper', label: 'Plenky' }, { id: 'sleep', label: 'Spánek' }, { id: 'nursing', label: 'Kojení' },
  { id: 'bottle', label: 'Lahvička' }, { id: 'food', label: 'Jídlo' }, { id: 'growth', label: 'Růst' },
];

/** A themed diary with civil-day groups; draft and trash records never enter the timeline. */
export function HistoryScreen({ onOpenEvent }: { onOpenEvent?: (eventId: string) => void }) {
  const { colors, mode } = useLumiTheme();
  const dockInset = useForestDockInset();
  const stripVisible = useContext(CompactActiveSessionsVisibleContext);
  const { state, setState } = useHistoryTabState();
  const model = useHistoryModel(state);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollY = useRef(state.scrollOffsetY);
  const initialOffset = useRef({ x: 0, y: state.scrollOffsetY });
  const [searchOpen, setSearchOpen] = useState(!!state.searchQuery);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [dateError, setDateError] = useState<string | undefined>();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const groups = useMemo(() => groupHistoryByDay(model.events, model.zone), [model.events, model.zone]);
  const yesterday = shiftHistoryDay(model.todayIso, -1);
  const filtersOn = historyFiltersActive(state);
  const instantLabel = (epochMs: number) => new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: model.zone,
  }).format(new Date(epochMs));

  function changeSection(section: HistorySection) {
    Keyboard.dismiss(); setDateOpen(false);
    scroll.current?.scrollTo({ y: 0, animated: false }); scrollY.current = 0;
    setState({ ...state, section, scrollOffsetY: 0 });
  }

  function chooseDay(focusDate: string | null) {
    Keyboard.dismiss(); setDateOpen(false); setDateError(undefined);
    setState({ ...state, focusDate, scrollOffsetY: 0 });
  }

  function openDatePicker() {
    if (dateOpen) { setDateOpen(false); return; }
    setDateInput((state.focusDate ?? model.todayIso).split('-').reverse().join('.'));
    setDateError(undefined); setDateOpen(true);
  }

  function applyDate() {
    const next = parseHistoryDateInput(dateInput);
    if (!next) { setDateError('Zadejte platné datum, například 11.11.2026.'); return; }
    chooseDay(next);
  }

  function clearFilters() {
    Keyboard.dismiss(); setDateOpen(false); setDateError(undefined);
    setState(clearHistoryFilters(state));
  }

  function openEvent(eventId: string) {
    Keyboard.dismiss(); setState({ ...state, scrollOffsetY: scrollY.current }); onOpenEvent?.(eventId);
  }

  function confirmDiscard(draft: Draft) {
    Alert.alert('Zahodit koncept?', 'Rozepsaný zápis se odstraní. Uložené záznamy v deníku zůstanou zachované.', [
      { text: 'Ponechat', style: 'cancel' },
      { text: 'Zahodit', style: 'destructive', onPress: () => void model.discardDraft(draft) },
    ]);
  }

  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}
    edges={stripVisible ? ['left', 'right'] : ['top', 'left', 'right']} testID="history-screen">
    <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
    <ScrollView ref={scroll} contentContainerStyle={[styles.content, { paddingBottom: dockInset + 32 }]} stickyHeaderIndices={[1]}
      contentOffset={initialOffset.current} keyboardShouldPersistTaps="handled" scrollEventThrottle={100}
      onScroll={(event) => { scrollY.current = event.nativeEvent.contentOffset.y; }}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 3 }}>
          <LumiText variant="overline" tone="muted" style={styles.eyebrow}>VAŠE SPOLEČNÁ PAMĚŤ</LumiText>
          <LumiText variant="h1" accessibilityRole="header">Historie</LumiText>
        </View>
        <View style={{ maxWidth: '48%' }}><ChildSwitcher compact /></View>
      </View>
      <View style={{ backgroundColor: colors.background, paddingVertical: 4 }}>
        <HistorySectionTabs value={state.section} draftsCount={model.drafts.length} trashCount={model.trash.length} onChange={changeSection} />
      </View>

      {state.section === 'timeline' ? <View style={styles.section}>
        <HistoryHero />
        <View style={styles.periods} accessibilityLabel="Období deníku">
          <HistoryPeriodButton label="Dnes" selected={state.focusDate === model.todayIso} onPress={() => chooseDay(model.todayIso)} testID="history-day-today" />
          <HistoryPeriodButton label="Včera" selected={state.focusDate === yesterday} onPress={() => chooseDay(yesterday)} testID="history-day-yesterday" />
          <HistoryPeriodButton label="Všechny dny" wide selected={!state.focusDate} onPress={() => chooseDay(null)} testID="history-day-all" />
          <HistoryPeriodButton label="Datum" selected={dateOpen} onPress={openDatePicker} testID="history-date-toggle" />
        </View>
        {state.focusDate || dateOpen ?
        <LumiCard padding="md" style={styles.panel}>
          <View style={styles.dateNavigation}>
            <HistoryDayArrow previous disabled={!state.focusDate} onPress={() => state.focusDate && chooseDay(shiftHistoryDay(state.focusDate, -1))} />
            <Pressable onPress={openDatePicker} accessibilityRole="button" accessibilityState={{ expanded: dateOpen }}
              accessibilityLabel={state.focusDate ? `Zobrazený den ${historyDateLabel(state.focusDate)}. Vybrat datum.` : 'Všechny dny. Vybrat datum.'}
              style={({ pressed }) => [styles.dateLabel, { opacity: pressed ? 0.7 : 1 }]}>
              <LumiText variant="bodyStrong" style={{ textAlign: 'center' }}>
                {state.focusDate ? historyDayLabel(state.focusDate, model.todayIso) : 'Všechny dny'}
              </LumiText>
              <LumiText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
                {state.focusDate ? historyDateLabel(state.focusDate) : 'Vybrat konkrétní datum'}
              </LumiText>
            </Pressable>
            <HistoryDayArrow disabled={!state.focusDate} onPress={() => state.focusDate && chooseDay(shiftHistoryDay(state.focusDate, 1))} />
          </View>
          {dateOpen ? <View style={styles.panel} testID="history-date-picker">
            <LumiInput label="Datum" hint="Den.měsíc.rok nebo RRRR-MM-DD" placeholder="11.11.2026" value={dateInput}
              onChangeText={(value) => { setDateInput(value); setDateError(undefined); }}
              {...(dateError ? { error: dateError } : {})} autoCorrect={false} autoCapitalize="none"
              onSubmitEditing={applyDate} returnKeyType="done" testID="history-date-input" />
            <LumiButton title="Zobrazit den" onPress={applyDate} fullWidth testID="history-date-apply" />
          </View> : null}
        </LumiCard> : null}

        <View style={styles.resultsHeading}>
          <LumiText variant="h2" accessibilityRole="header" style={{ flex: 1 }}>{state.searchQuery ? 'Výsledky hledání' : 'Váš deník'}</LumiText>
          <LumiButton title={searchOpen ? 'Skrýt' : 'Hledat'} variant="secondary"
            onPress={() => setSearchOpen((value) => !value)} accessibilityState={{ expanded: searchOpen }} testID="history-search-toggle" />
        </View>
        {searchOpen ? <LumiInput label={PRODUCT_COPY.history.search} placeholder="Název nebo slova z poznámky…"
          value={state.searchQuery} onChangeText={(searchQuery) => setState({ ...state, searchQuery })}
          autoCapitalize="none" autoCorrect={false} returnKeyType="search" testID="history-search" /> : null}
        {state.searchQuery && !searchOpen ? <LumiText variant="caption" tone="muted">Hledáte „{state.searchQuery}“</LumiText> : null}
        <View style={styles.wrap} accessibilityLabel="Typ záznamu">
          {FILTERS.map((filter) => <LumiChip key={filter.id} label={filter.label} selected={state.filter === filter.id}
            onPress={() => setState({ ...state, filter: filter.id, careSubtype: filter.id === 'care' ? state.careSubtype : null })}
            testID={`history-filter-${filter.id}`} />)}
        </View>
        {state.filter === 'care' ? <View style={styles.wrap} accessibilityLabel={PRODUCT_COPY.history.careSubtypes}>
          {CARE_SUBTYPES.map((subtype) => <LumiChip key={subtype.id} label={subtype.label} selected={state.careSubtype === subtype.id}
            onPress={() => setState({ ...state, careSubtype: state.careSubtype === subtype.id ? null : subtype.id })}
            testID={`history-subtype-${subtype.id}`} />)}
        </View> : null}
        {filtersOn ? <LumiButton title={PRODUCT_COPY.actions.clearFilters} variant="ghost" onPress={clearFilters} fullWidth testID="history-clear-filters" /> : null}
          <LumiText variant="caption" tone="muted" accessibilityLiveRegion="polite" testID="history-result-count">
            {model.loading ? 'Načítám…' : `Načteno: ${historyCountLabel(model.events.length)}`}
          </LumiText>
        {model.events.length === 0 && !model.loading && !model.error ? <HistoryEmpty
          title={filtersOn ? 'Tady je zatím klid' : 'První chvíle teprve přijdou'}
          description={filtersOn ? 'Pro tento výběr tu nejsou žádné záznamy. Můžete změnit den nebo zrušit filtry.' : 'Uložená péče, zážitky a poznámky se tu postupně poskládají do vašeho příběhu.'}>
          {filtersOn ? <LumiButton title="Zobrazit všechny záznamy" variant="secondary" onPress={clearFilters} fullWidth /> : null}
        </HistoryEmpty> : null}
        {groups.map((group) => <View key={group.day} style={styles.dayGroup} testID={`history-group-${group.day}`}>
          <HistoryDayHeading day={group.day} todayIso={model.todayIso} />
          {group.events.map((event, index) => <HistoryEventRow key={event.eventId} event={event} zone={model.zone}
            last={index === group.events.length - 1} {...(onOpenEvent ? { onPress: () => openEvent(event.eventId) } : {})} />)}
        </View>)}
        {model.nextCursor && !state.focusDate ? <LumiButton title="Načíst starší záznamy" variant="secondary"
          loading={model.loadingMore} onPress={() => void model.loadOlder()} fullWidth testID="history-load-more" /> : null}
        <LumiButton title="Možnosti hledání" variant="ghost" onPress={() => setOptionsOpen((value) => !value)} accessibilityState={{ expanded: optionsOpen }} fullWidth />
        {optionsOpen ? <LumiCard style={styles.panel}>
          <LumiText variant="caption" tone="muted">Pokud hledání nenachází dříve uložené poznámky, obnovte místní vyhledávání.</LumiText>
          <LumiButton title={PRODUCT_COPY.actions.rebuildSearch} variant="secondary" onPress={() => void model.onRebuildSearch()}
            loading={model.pendingId === 'search-index'} disabled={!!model.pendingId && model.pendingId !== 'search-index'} fullWidth />
        </LumiCard> : null}
      </View> : null}

      {state.section === 'drafts' ? <View style={styles.section}>
        <LumiText variant="h2" accessibilityRole="header">Rozepsané chvíle</LumiText>
        <LumiText variant="caption" tone="muted">Koncepty ještě nejsou uložené události. Jejich původní čas zůstává zachovaný.</LumiText>
        {model.drafts.length === 0 ? <HistoryEmpty title="Nic nezůstalo rozepsané" description="Když při zápisu přerušíte práci, uložené koncepty najdete tady." /> : model.drafts.map((draft) => <LumiCard key={draft.draftId} style={styles.panel} testID={`history-draft-${draft.draftId}`}>
          <View style={styles.cardHeading}><ForestIconBadge name={HISTORY_TONES[draft.formType]} size={42} />
            <LumiText variant="bodyStrong" style={{ flex: 1 }}>{HISTORY_EVENT_LABELS[draft.formType]}</LumiText></View>
          <LumiText variant="caption" tone="muted">Původní čas: {instantLabel(draft.originalEventTime.epochMs)}</LumiText>
          {draftPreviewFields(draft).slice(0, 2).map((field) => <LumiText key={field.label} variant="caption" numberOfLines={2}>{field.label}: {field.value}</LumiText>)}
          <LumiButton title="Zobrazit koncept" variant="secondary" onPress={() => setSelectedDraft(draft)} fullWidth />
          <LumiButton title={PRODUCT_COPY.actions.discardDraft} variant="ghost" disabled={!!model.pendingId}
            onPress={() => confirmDiscard(draft)} fullWidth />
        </LumiCard>)}
      </View> : null}

      {state.section === 'trash' ? <View style={styles.section}>
        <LumiText variant="h2" accessibilityRole="header">Nedávno smazané</LumiText>
        <LumiText variant="caption" tone="muted">Dokud neuplyne uvedená lhůta, můžete záznam vrátit do deníku.</LumiText>
        {model.trash.length === 0 ? <HistoryEmpty title="Koš je prázdný" description="Tady se objeví smazané záznamy, které ještě můžete obnovit." /> : model.trash.map((marker) => {
          const event = careEventFromTrashMarker(marker);
          return <LumiCard key={marker.deletionId} style={styles.panel} testID={`history-trash-${marker.deletionId}`}>
            <View style={styles.cardHeading}><ForestIconBadge name={event ? HISTORY_TONES[event.type] : 'history'} size={42} />
              <LumiText variant="bodyStrong" style={{ flex: 1 }}>{event ? presentCareEvent(event, model.zone).title : 'Smazaný záznam'}</LumiText></View>
            <LumiText variant="caption" tone="muted">Smazáno {instantLabel(marker.deletedAt.epochMs)}</LumiText>
            <LumiText variant="caption" tone="muted">Lze obnovit do {instantLabel(marker.retainUntil.epochMs)}</LumiText>
            <LumiButton title={PRODUCT_COPY.actions.restore} onPress={() => void model.restoreTrashItem(marker)}
              loading={model.pendingId === marker.deletionId} disabled={!!model.pendingId && model.pendingId !== marker.deletionId} fullWidth />
          </LumiCard>;
        })}
      </View> : null}

      {model.error ? <LumiCard style={styles.panel}><LumiText tone="danger" accessibilityRole="alert">{model.error}</LumiText>
        <LumiButton title="Zkusit znovu" variant="secondary" onPress={() => void model.reload()} fullWidth /></LumiCard> : null}
      {model.feedback ? <LumiText tone={model.feedback.error ? 'danger' : 'success'} accessibilityLiveRegion="polite">{model.feedback.message}</LumiText> : null}
      <FamilyConflictsPanel />
    </ScrollView>
    <CareActionSheet visible={!!selectedDraft && selectedDraft.childId === model.childId} title="Rozepsaný záznam"
      subtitle="Náhled konceptu. Do časové osy patří až uložené události." onClose={() => setSelectedDraft(null)}>
      {selectedDraft ? <>
        <LumiText variant="h2">{HISTORY_EVENT_LABELS[selectedDraft.formType]}</LumiText>
        <LumiText variant="caption" tone="muted">Původní čas: {instantLabel(selectedDraft.originalEventTime.epochMs)}</LumiText>
        {draftPreviewFields(selectedDraft).map((field) => <View key={field.label} style={{ gap: 4 }}>
          <LumiText variant="label">{field.label}</LumiText><LumiText>{field.value}</LumiText></View>)}
      </> : null}
    </CareActionSheet>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 32, width: '100%', maxWidth: 620, alignSelf: 'center', gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontSize: 9, lineHeight: 15, letterSpacing: 1.2 },
  section: { gap: 16 },
  panel: { gap: 12, borderRadius: 24 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  periods: { flexDirection: 'row', gap: 6 },
  dateNavigation: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { flex: 1, minHeight: 48, justifyContent: 'center', gap: 3 },
  resultsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dayGroup: { gap: 12, marginBottom: 8 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
