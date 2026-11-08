import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiCard, LumiChip, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { reasonCopyCs } from '../../domain';
import type { ActivityRevision } from '../../content';
import { DEVELOPMENT_AREA_LABELS_CS } from '../../content';
import { PRODUCT_COPY } from '../ui';
import { ActivityDetailScreen } from './ActivityDetailScreen';
import { useDevelopmentModel, type SituationFilters } from './useDevelopmentModel';

type DevelopmentScreenProps = {
  onOpenEvent?: (eventId: string) => void;
};

/**
 * Educational hub: today's shared offer, inline situation filters, favorites,
 * weekly descriptive glance, and a browsable local library — all offline.
 */
export function DevelopmentScreen({ onOpenEvent }: DevelopmentScreenProps) {
  const { colors, ui } = useLumiTheme();
  const model = useDevelopmentModel();
  const [detailRevision, setDetailRevision] = useState<ActivityRevision | null>(null);

  const primaryOffer = model.recommendation?.set.offers[0] ?? null;
  const alternatives = model.recommendation?.set.offers.slice(1) ?? [];
  const primaryRevision = primaryOffer
    ? model.revisionById.get(primaryOffer.activityRevisionId) ?? null
    : null;

  const emptyCopy = useMemo(() => {
    const codes = model.recommendation?.emptyReasonCodes ?? [];
    if (codes.includes('missing_birth_date')) return PRODUCT_COPY.empty.missingBirthDate;
    if (codes.includes('age_out_of_content_window')) return PRODUCT_COPY.empty.ageOutOfWindow;
    if (codes.length > 0) return PRODUCT_COPY.empty.noEligibleActivity;
    return null;
  }, [model.recommendation?.emptyReasonCodes]);

  if (detailRevision && model.childId) {
    return (
      <ActivityDetailScreen
        revision={detailRevision}
        childId={model.childId}
        timeZone={model.zone}
        isFavorite={model.favorites.some((favorite) => favorite.activityId === detailRevision.activityId)}
        onToggleFavorite={() => void model.toggleFavorite(detailRevision.activityId)}
        readinessByKey={model.readinessByKey}
        onConfirmReadiness={(key, state) => void model.confirmReadiness(key, state)}
        onClearReadiness={(key) => void model.clearReadiness(key)}
        onClose={() => {
          setDetailRevision(null);
          void model.reload();
        }}
        {...(onOpenEvent ? { onOpenEvent } : {})}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} testID="development-screen">
      <ScrollView contentContainerStyle={[styles.content, { gap: ui.space.lg }]}>
        <LumiText variant="h1">{PRODUCT_COPY.development.title}</LumiText>

        <LumiCard>
          <LumiText variant="h2">{PRODUCT_COPY.development.todayOffer}</LumiText>
          {model.recommendation?.set.status === 'hidden' ? (
            <LumiText tone="muted">{PRODUCT_COPY.actions.careOnlyToday}</LumiText>
          ) : null}
          {model.recommendation?.presentation === 'later' ? (
            <LumiText tone="muted">{PRODUCT_COPY.development.laterBecauseSleep}</LumiText>
          ) : null}
          {primaryRevision && primaryOffer ? (
            <View style={{ gap: ui.space.sm }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDetailRevision(primaryRevision)}
                style={styles.rowButton}
              >
                <LumiText>{primaryRevision.title}</LumiText>
                <LumiText tone="muted">
                  {DEVELOPMENT_AREA_LABELS_CS[primaryRevision.primaryArea]}
                </LumiText>
                {primaryOffer.reasonCodes[0] ? (
                  <LumiText tone="muted">
                    {reasonCopyCs(primaryOffer.reasonCodes[0] as never)}
                  </LumiText>
                ) : null}
                {model.todayByActivity[primaryOffer.activityId] ? (
                  <LumiText>{PRODUCT_COPY.development.triedTodayPrefix}</LumiText>
                ) : null}
              </Pressable>
              <View style={styles.row}>
                <LumiButton
                  title={PRODUCT_COPY.actions.replaceOffer}
                  variant="secondary"
                  onPress={() => void model.replaceOffer()}
                />
                <LumiButton
                  title={PRODUCT_COPY.actions.careOnlyToday}
                  variant="secondary"
                  onPress={() => void model.hideForCare()}
                />
              </View>
              {alternatives.length > 0 ? (
                <View style={{ gap: ui.space.xs }}>
                  <LumiText variant="h2">{PRODUCT_COPY.development.alternatives}</LumiText>
                  {alternatives.map((offer) => {
                    const revision = model.revisionById.get(offer.activityRevisionId);
                    if (!revision) return null;
                    return (
                      <Pressable
                        key={offer.activityRevisionId}
                        onPress={() => setDetailRevision(revision)}
                        style={styles.rowButton}
                      >
                        <LumiText>{revision.title}</LumiText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : (
            <LumiText tone="muted">{emptyCopy ?? PRODUCT_COPY.empty.noEligibleActivity}</LumiText>
          )}
        </LumiCard>

        <LumiCard>
          <LumiText variant="h2">{PRODUCT_COPY.development.situation}</LumiText>
          <SituationFilterChips filters={model.filters} onChange={model.setFilters} />
          <LumiButton
            title={PRODUCT_COPY.actions.clearSituationFilters}
            variant="secondary"
            onPress={model.clearFilters}
          />
        </LumiCard>

        <LumiCard>
          <LumiText variant="h2">{PRODUCT_COPY.development.favorites}</LumiText>
          {model.favorites.length === 0 ? (
            <LumiText tone="muted">{PRODUCT_COPY.empty.noFavorites}</LumiText>
          ) : (
            model.favorites.map((favorite) => {
              const revision = model.activityById.get(favorite.activityId);
              if (!revision) {
                return (
                  <LumiText key={favorite.favoriteId} tone="muted">
                    {favorite.activityId}
                  </LumiText>
                );
              }
              return (
                <Pressable
                  key={favorite.favoriteId}
                  onPress={() => setDetailRevision(revision)}
                  style={styles.rowButton}
                >
                  <LumiText>{revision.title}</LumiText>
                </Pressable>
              );
            })
          )}
        </LumiCard>

        <LumiCard>
          <LumiText variant="h2">{PRODUCT_COPY.development.weeklyGlance}</LumiText>
          {!model.glance || model.glance.insufficientData ? (
            <LumiText tone="muted">{PRODUCT_COPY.empty.noWeeklyGlance}</LumiText>
          ) : (
            model.glance.statements.map((statement) => (
              <View key={statement.code} style={{ gap: 4 }}>
                <LumiText>{statement.textCs}</LumiText>
                <LumiText tone="muted">
                  Záznamy: {statement.evidenceEventIds.length}
                </LumiText>
              </View>
            ))
          )}
        </LumiCard>

        <LumiCard>
          <LumiText variant="h2">{PRODUCT_COPY.development.library}</LumiText>
          {model.filteredLibrary.length === 0 ? (
            <LumiText tone="muted">{PRODUCT_COPY.empty.libraryEmpty}</LumiText>
          ) : (
            model.filteredLibrary.map((revision) => (
              <Pressable
                key={revision.revisionId}
                onPress={() => setDetailRevision(revision)}
                style={styles.rowButton}
                testID={`library-${revision.activityId}`}
              >
                <LumiText>{revision.title}</LumiText>
                <LumiText tone="muted">
                  {DEVELOPMENT_AREA_LABELS_CS[revision.primaryArea]}
                  {revision.editorial.stage !== 'published'
                    ? ` · ${PRODUCT_COPY.development.draftBadge}`
                    : ''}
                </LumiText>
              </Pressable>
            ))
          )}
        </LumiCard>

        {model.error ? <LumiText tone="muted">{model.error}</LumiText> : null}
        {model.busy ? <LumiText tone="muted">Načítám…</LumiText> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SituationFilterChips({
  filters,
  onChange,
}: {
  filters: SituationFilters;
  onChange: (next: SituationFilters) => void;
}) {
  function toggleEnvironment(value: SituationFilters['environments'][number]) {
    const exists = filters.environments.includes(value);
    onChange({
      ...filters,
      environments: exists
        ? filters.environments.filter((item) => item !== value)
        : [...filters.environments, value],
    });
  }

  return (
    <View style={styles.row}>
      <LumiChip
        label={PRODUCT_COPY.development.filterMoment}
        selected={filters.duration === 'moment'}
        onPress={() =>
          onChange({
            ...filters,
            duration: filters.duration === 'moment' ? null : 'moment',
          })
        }
      />
      <LumiChip
        label={PRODUCT_COPY.development.filter5}
        selected={filters.duration === 'minutes'}
        onPress={() =>
          onChange({
            ...filters,
            duration: filters.duration === 'minutes' ? null : 'minutes',
          })
        }
      />
      <LumiChip
        label={PRODUCT_COPY.development.filterHome}
        selected={filters.environments.includes('home')}
        onPress={() => toggleEnvironment('home')}
      />
      <LumiChip
        label={PRODUCT_COPY.development.filterOutdoor}
        selected={filters.environments.includes('outdoor')}
        onPress={() => toggleEnvironment('outdoor')}
      />
      <LumiChip
        label={PRODUCT_COPY.development.filterQuiet}
        selected={filters.environments.includes('quiet')}
        onPress={() => toggleEnvironment('quiet')}
      />
      <LumiChip
        label={PRODUCT_COPY.development.filterNoMaterials}
        selected={filters.withoutMaterialsOnly}
        onPress={() =>
          onChange({
            ...filters,
            withoutMaterialsOnly: !filters.withoutMaterialsOnly,
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 24,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowButton: { minHeight: 48, justifyContent: 'center', gap: 2 },
});
