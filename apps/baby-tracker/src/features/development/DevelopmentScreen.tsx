import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Keyboard, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { LumiButton, LumiCard, LumiChip, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { RECOMMENDATION_REASON_COPY_CS, type DevelopmentArea } from '../../domain';
import type { ActivityRevision } from '../../content';
import { DEVELOPMENT_AREA_LABELS_CS } from '../../content';
import { ChildSwitcher } from '../shell/ChildSwitcher';
import { CompactActiveSessionsVisibleContext } from '../shell/CompactActiveSessions';
import { useForestDockInset } from '../../app/navigation/ForestGlassTabBar';
import { PRODUCT_COPY } from '../ui';
import { ActivityDetailScreen } from './ActivityDetailScreen';
import { FamilyProjectsSection } from './FamilyProjectsSection';
import { useDevelopmentModel, type SituationFilters } from './useDevelopmentModel';
import {
  DevelopmentActivityCard, DevelopmentEmpty, DevelopmentHeading, DevelopmentHero, DevelopmentTabs,
  type DevelopmentSection,
} from './DevelopmentVisuals';
import { activityCountLabel, selectLibraryActivities } from './developmentPresentation';

/** Daily inspiration, a searchable library and shared projects have distinct places. */
export function DevelopmentScreen({ onOpenEvent, onOpenProfile }: {
  onOpenEvent?: (eventId: string) => void; onOpenProfile?: () => void;
}) {
  const { colors, mode } = useLumiTheme();
  const dockInset = useForestDockInset();
  const focused = useIsFocused();
  const stripVisible = useContext(CompactActiveSessionsVisibleContext);
  const model = useDevelopmentModel();
  const reload = model.reload;
  const [section, setSection] = useState<DevelopmentSection>('inspiration');
  const [detail, setDetail] = useState<{ revision: ActivityRevision; childId: string | null } | null>(null);
  const detailRevision = detail?.childId === model.childId ? detail.revision : null;
  function setDetailRevision(revision: ActivityRevision | null) {
    Keyboard.dismiss();
    setDetail(revision ? { revision, childId: model.childId } : null);
  }
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<DevelopmentArea | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alternativesOpen, setAlternativesOpen] = useState(false);
  const [libraryLimit, setLibraryLimit] = useState(12);
  const [projectsVisited, setProjectsVisited] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const libraryScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const favoriteIds = useMemo(() => new Set(model.favorites.map((item) => item.activityId)), [model.favorites]);
  const libraryResults = useMemo(() => selectLibraryActivities(model.filteredLibrary,
    { query, area, favoritesOnly }, favoriteIds), [model.filteredLibrary, query, area, favoritesOnly, favoriteIds]);
  const situationFilterCount = Number(!!model.filters.duration) + model.filters.environments.length
    + Number(model.filters.withoutMaterialsOnly);
  const filterCount = situationFilterCount + Number(!!area);
  const hasFilters = !!query.trim() || !!area || favoritesOnly || filterCount > 0;
  const primaryOffer = model.recommendation?.set.offers[0] ?? null;
  const primaryRevision = primaryOffer ? model.revisionById.get(primaryOffer.activityRevisionId) : null;
  const offerReason = Object.entries(RECOMMENDATION_REASON_COPY_CS).find(([code]) => code === primaryOffer?.reasonCodes[0])?.[1];
  const hidden = model.recommendation?.set.status === 'hidden';
  const emptyCodes = model.recommendation?.emptyReasonCodes ?? [];
  const emptyCopy = model.missingBirthDate || emptyCodes.includes('missing_birth_date') ? PRODUCT_COPY.empty.missingBirthDate
    : emptyCodes.includes('age_out_of_content_window') ? PRODUCT_COPY.empty.ageOutOfWindow
    : PRODUCT_COPY.empty.noEligibleActivity;

  function closeDetail() {
    setDetailRevision(null);
    void model.reload();
  }

  useEffect(() => {
    if (!detailRevision || !focused) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setDetail(null);
      void reload();
      return true;
    });
    return () => subscription.remove();
  }, [detailRevision, focused, reload]);

  async function runAction(action: () => Promise<unknown>) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setActionBusy(true);
    setActionError(null);
    try { await action(); }
    catch { setActionError('Změnu se nepodařilo uložit. Zkuste to znovu.'); }
    finally { inFlightRef.current = false; setActionBusy(false); }
  }

  function changeSection(next: DevelopmentSection) {
    Keyboard.dismiss();
    setSection(next);
    libraryScroll.current?.scrollTo({ y: 0, animated: false });
    if (next === 'together') setProjectsVisited(true);
  }

  function resetLibrary() {
    setQuery(''); setArea(null); setFavoritesOnly(false); setLibraryLimit(12); model.clearFilters();
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={stripVisible ? ['left', 'right'] : ['top', 'left', 'right']} style={[styles.root,
        { backgroundColor: colors.background, display: detailRevision ? 'none' : 'flex' }]}
        testID="development-screen">
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        <ScrollView ref={libraryScroll} contentContainerStyle={[styles.content, { paddingBottom: dockInset + 32 }]} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <LumiText variant="overline" tone="muted" style={styles.eyebrow}>MALÉ KROKY, VELKÉ CHVÍLE</LumiText>
              <LumiText variant="h1" accessibilityRole="header">{PRODUCT_COPY.development.title}</LumiText>
            </View>
            <View style={{ maxWidth: '48%' }}><ChildSwitcher compact /></View>
          </View>
          <DevelopmentTabs value={section} onChange={changeSection} />
          {model.error || actionError ? <LumiCard style={styles.status}>
            <LumiText tone="danger" accessibilityRole="alert">{actionError ?? model.error}</LumiText>
            <LumiButton title="Zkusit znovu" variant="secondary" onPress={() => void runAction(model.reload)} loading={actionBusy} />
          </LumiCard> : null}
          {model.busy ? <LumiText variant="caption" tone="muted" accessibilityLiveRegion="polite">Načítám rozvoj…</LumiText> : null}

          <View style={[styles.section, { display: section === 'inspiration' ? 'flex' : 'none' }]}>
            <DevelopmentHero />
            <DevelopmentHeading title="Malá inspirace na dnešek" subtitle="Stačí jedna společná chvíle. Nic nemusíte stihnout." />
            {hidden ? <DevelopmentEmpty title="Dnes jen být spolu" description="Nabídku jste pro dnešek odložili. Až budete chtít, můžete si vybrat něco sami." icon="care">
              <LumiButton title="Prohlédnout aktivity" variant="secondary" onPress={() => changeSection('library')} fullWidth />
            </DevelopmentEmpty> : primaryRevision && primaryOffer ? <>
              {model.recommendation?.presentation === 'later' ? <LumiText tone="muted">{PRODUCT_COPY.development.laterBecauseSleep}</LumiText> : null}
              <DevelopmentActivityCard revision={primaryRevision} featured testID="development-daily-offer"
                {...(offerReason ? { reason: offerReason } : {})}
                tried={!!model.todayByActivity[primaryOffer.activityId]} onPress={() => setDetailRevision(primaryRevision)} />
              <View style={styles.offerActions}>
                <LumiButton title="Jiný nápad" variant="secondary" onPress={() => void runAction(model.replaceOffer)} loading={actionBusy} />
                <LumiButton title={PRODUCT_COPY.actions.careOnlyToday} variant="ghost" onPress={() => void runAction(model.hideForCare)} disabled={actionBusy} />
              </View>
              {model.recommendation?.stale ? <LumiText variant="caption" tone="muted">Podmínky se změnily. Zvolte Jiný nápad pro novou nabídku.</LumiText> : null}
              {model.recommendation && model.recommendation.set.offers.length > 1 ? <>
                <LumiButton title={alternativesOpen ? 'Skrýt další nápady' : 'Další nápady na dnešek'} variant="ghost"
                  onPress={() => setAlternativesOpen((value) => !value)} accessibilityState={{ expanded: alternativesOpen }} />
                {alternativesOpen ? model.recommendation.set.offers.slice(1).map((offer) => {
                  const revision = model.revisionById.get(offer.activityRevisionId);
                  return revision ? <DevelopmentActivityCard key={offer.activityRevisionId} revision={revision}
                    tried={!!model.todayByActivity[offer.activityId]} onPress={() => setDetailRevision(revision)} /> : null;
                }) : null}
              </> : null}
            </> : !model.busy ? <DevelopmentEmpty title="Každé dítě má své tempo" description={emptyCopy}>
              {model.missingBirthDate && onOpenProfile ? <LumiButton title="Doplnit datum narození"
                onPress={onOpenProfile} fullWidth testID="development-complete-profile" /> : null}
              <LumiButton title={PRODUCT_COPY.development.library} variant="secondary" onPress={() => changeSection('library')} fullWidth />
            </DevelopmentEmpty> : null}
            <View style={styles.dividerSpace} />
            <DevelopmentHeading title={PRODUCT_COPY.development.weeklyGlance} subtitle="Vzpomínky z posledních sedmi dnů" icon="history" />
            <LumiCard style={styles.status}>
              {!model.glance || model.glance.insufficientData ? <>
                <LumiText variant="bodyStrong">Každý objev má svůj čas</LumiText>
                <LumiText tone="muted" variant="caption">{PRODUCT_COPY.empty.noWeeklyGlance}</LumiText>
              </> : model.glance.statements.map((statement) => <View key={statement.code} style={styles.statement}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1, gap: 4 }}><LumiText>{statement.textCs}</LumiText>
                  <LumiText variant="caption" tone="muted">Záznamy: {statement.evidenceEventIds.length}</LumiText></View>
              </View>)}
            </LumiCard>
          </View>

          <View style={[styles.section, { display: section === 'library' ? 'flex' : 'none' }]} testID="development-library">
            <DevelopmentHeading title="Knihovna malých objevů" subtitle="Najděte si chvíli, na kterou máte právě chuť." icon="experience" />
            <View style={styles.offerActions}>
              <LumiChip label="Všechny aktivity" selected={!favoritesOnly} onPress={() => { setFavoritesOnly(false); setLibraryLimit(12); }} />
              <LumiChip label={`Oblíbené (${model.favorites.length})`} selected={favoritesOnly}
                onPress={() => { setFavoritesOnly(true); setLibraryLimit(12); }} testID="development-favorites" />
            </View>
            <LumiInput label="Hledat aktivitu" placeholder="Název nebo pomůcka…" value={query}
              onChangeText={(value) => { setQuery(value); setLibraryLimit(12); }} returnKeyType="search"
              autoCorrect={false} testID="development-search" />
            <View style={styles.offerActions}>
              <LumiButton title={`Filtry${filterCount ? ` (${filterCount})` : ''}`} variant="secondary"
                onPress={() => setFiltersOpen((value) => !value)} accessibilityState={{ expanded: filtersOpen }} testID="development-filters-toggle" />
              {hasFilters ? <LumiButton title="Zrušit filtry" variant="ghost" onPress={resetLibrary} testID="development-clear-filters" /> : null}
            </View>
            {filtersOpen ? <LumiCard style={styles.status} testID="development-situation-filters">
              <LumiText variant="bodyStrong">{PRODUCT_COPY.development.situation}</LumiText>
              <LumiText variant="caption" tone="muted">Čas, prostředí a pomůcky se zohlední i při výběru nového dnešního nápadu.</LumiText>
              <SituationFilterChips filters={model.filters} onChange={(next) => { model.setFilters(next); setLibraryLimit(12); }} />
              <LumiText variant="label">Oblast objevování</LumiText>
              <View style={styles.offerActions}>
                <LumiChip label="Všechny oblasti" selected={!area} onPress={() => { setArea(null); setLibraryLimit(12); }} />
                {(Object.keys(DEVELOPMENT_AREA_LABELS_CS) as DevelopmentArea[]).map((key) => <LumiChip key={key}
                  label={DEVELOPMENT_AREA_LABELS_CS[key]} selected={area === key}
                  onPress={() => { setArea(area === key ? null : key); setLibraryLimit(12); }} />)}
              </View>
            </LumiCard> : situationFilterCount > 0 ? <LumiText variant="caption" tone="muted" testID="development-active-filters">
              {[model.filters.duration === 'moment' ? 'Chvilka' : model.filters.duration ? 'Několik minut' : '',
                ...model.filters.environments.map((item) => ({ home: 'Doma', outdoor: 'Venku', quiet: 'V klidu', travel: 'Na cestách' })[item]),
                model.filters.withoutMaterialsOnly ? 'Bez pomůcek' : ''].filter(Boolean).join(' · ')}
            </LumiText> : null}
            {area && !filtersOpen ? <LumiChip label={DEVELOPMENT_AREA_LABELS_CS[area]} selected onPress={() => setArea(null)} /> : null}
            <LumiText variant="caption" tone="muted">Knihovna zahrnuje různé věkové skupiny. Věk a podmínky najdete u každé aktivity.</LumiText>
            <LumiText variant="label" accessibilityLiveRegion="polite" testID="development-result-count">{activityCountLabel(libraryResults.length)}</LumiText>
            {libraryResults.length === 0 ? <DevelopmentEmpty icon={favoritesOnly ? 'care' : 'experience'}
              title={favoritesOnly && model.favorites.length === 0 ? 'Schovejte si oblíbené chvíle' : 'Zkusíme hledat jinak?'}
              description={favoritesOnly && model.favorites.length === 0
                ? 'Otevřete aktivitu a uložte si ji mezi oblíbené. Příště ji najdete tady.' : 'Této kombinaci teď nic neodpovídá. Zkuste jinou oblast nebo uvolněte filtry.'}>
              <LumiButton title="Zobrazit všechny aktivity" variant="secondary" onPress={resetLibrary} fullWidth />
            </DevelopmentEmpty> : libraryResults.slice(0, libraryLimit).map((revision) => <DevelopmentActivityCard
              key={revision.revisionId} revision={revision} onPress={() => setDetailRevision(revision)} testID={`library-${revision.activityId}`} />)}
            {libraryResults.length > libraryLimit ? <LumiButton title={`Další aktivity (${libraryResults.length - libraryLimit})`}
              variant="secondary" onPress={() => setLibraryLimit((value) => value + 12)} fullWidth testID="development-load-more" /> : null}
          </View>

          <View style={[styles.section, { display: section === 'together' ? 'flex' : 'none' }]}>
            <DevelopmentHeading title="Váš společný příběh" subtitle="Delší nápady a projekty, ke kterým se můžete vracet." icon="care" />
            {projectsVisited && model.childId ? <FamilyProjectsSection key={model.childId} childId={model.childId} /> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
      {detailRevision && model.childId ? <ActivityDetailScreen key={`${model.childId}:${detailRevision.revisionId}`}
        revision={detailRevision} childId={model.childId} timeZone={model.zone}
        isFavorite={favoriteIds.has(detailRevision.activityId)}
        onToggleFavorite={() => void runAction(() => model.toggleFavorite(detailRevision.activityId))}
        readinessByKey={model.readinessByKey}
        onConfirmReadiness={(key, state) => void runAction(() => model.confirmReadiness(key, state))}
        onClearReadiness={(key) => void runAction(() => model.clearReadiness(key))}
        mutationError={actionError} mutationBusy={actionBusy}
        onClose={closeDetail} {...(onOpenEvent ? { onOpenEvent } : {})} /> : null}
    </View>
  );
}

function SituationFilterChips({ filters, onChange }: { filters: SituationFilters; onChange: (next: SituationFilters) => void }) {
  function toggleEnvironment(value: SituationFilters['environments'][number]) {
    onChange({ ...filters, environments: filters.environments.includes(value)
      ? filters.environments.filter((item) => item !== value) : [...filters.environments, value] });
  }
  return <View style={styles.status}>
    <LumiText variant="caption" tone="muted">Kolik máte času?</LumiText>
    <View style={styles.offerActions}>
      <LumiChip label="Chvilka" selected={filters.duration === 'moment'}
        onPress={() => onChange({ ...filters, duration: filters.duration === 'moment' ? null : 'moment' })} />
      <LumiChip label="Několik minut" selected={filters.duration === 'minutes'}
        onPress={() => onChange({ ...filters, duration: filters.duration === 'minutes' ? null : 'minutes' })} />
    </View>
    <LumiText variant="caption" tone="muted">Kde vám bude dobře?</LumiText>
    <View style={styles.offerActions}>
      {([['home', 'Doma'], ['outdoor', 'Venku'], ['quiet', 'V klidu'], ['travel', 'Na cestách']] as const).map(([key, label]) =>
        <LumiChip key={key} label={label} selected={filters.environments.includes(key)} onPress={() => toggleEnvironment(key)} />)}
    </View>
    <LumiText variant="caption" tone="muted">Co máte po ruce?</LumiText>
    <LumiChip label="Bez pomůcek" selected={filters.withoutMaterialsOnly}
      onPress={() => onChange({ ...filters, withoutMaterialsOnly: !filters.withoutMaterialsOnly })} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 32, gap: 22, width: '100%', maxWidth: 620, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 9, lineHeight: 15, letterSpacing: 1.1 },
  section: { gap: 18 },
  offerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  status: { gap: 12, borderRadius: 24 },
  dividerSpace: { height: 2 },
  statement: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
});
