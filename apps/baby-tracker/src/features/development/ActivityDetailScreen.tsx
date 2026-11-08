import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiChip, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ChildId, ExperienceCareEvent, TimeZoneId } from '../../domain';
import type { ActivityRevision, ReadinessKey, ReadinessState } from '../../content';
import { DEVELOPMENT_AREA_LABELS_CS, READINESS_LABELS_CS } from '../../content';
import {
  findTodaysExperienceForActivity,
  openDailyRecommendation,
} from '../../application';
import { useCompositionRoot } from '../../app/providers';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';
import { PRODUCT_COPY, SaveFeedback, type SaveFeedbackState } from '../ui';
import {
  buildRecordExperienceCommand,
  mintMomentIds,
  nowInZone,
} from '../today/recordMomentIntent';
import { buildEditCareCommand } from '../history/buildEditCareCommand';
import { asOperationId, asRevisionId, todayInZone } from '../../domain';

export type ActivityDetailScreenProps = {
  revision: ActivityRevision;
  childId: ChildId;
  timeZone: TimeZoneId;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  onOpenEvent?: (eventId: string) => void;
  readinessByKey?: Partial<Record<string, ReadinessState>>;
  onConfirmReadiness?: (key: ReadinessKey, state: 'yes' | 'no') => void;
  onClearReadiness?: (key: ReadinessKey) => void;
};

/**
 * Activity detail prioritizes short steps over illustration. “Vyzkoušeli jsme”
 * commits one experience; opening the screen alone never marks it tried.
 */
export function ActivityDetailScreen({
  revision,
  childId,
  timeZone,
  isFavorite,
  onToggleFavorite,
  onClose,
  onOpenEvent,
  readinessByKey = {},
  onConfirmReadiness,
  onClearReadiness,
}: ActivityDetailScreenProps) {
  const { colors, ui } = useLumiTheme();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [expandedWhy, setExpandedWhy] = useState(false);
  const [expandedSources, setExpandedSources] = useState(false);
  const [todayExperience, setTodayExperience] = useState<ExperienceCareEvent | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedbackState>('idle');
  const inFlightRef = useRef(false);
  const isDraft = revision.editorial.stage === 'draft';
  const readinessKeys = requiredReadinessKeys(revision);

  const localDay = todayInZone(services.clock.now(), timeZone);

  const refreshToday = useCallback(async () => {
    if (!runtime.unitOfWork) return;
    const found = await findTodaysExperienceForActivity(runtime.unitOfWork, {
      childId,
      activityId: revision.activityId,
      day: localDay,
      summaryTimeZone: timeZone,
    });
    setTodayExperience(found);
  }, [childId, localDay, revision.activityId, runtime.unitOfWork, timeZone]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void refreshToday();
      if (runtime.unitOfWork) {
        void openDailyRecommendation(runtime.unitOfWork, {
          childId,
          localDay,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [childId, localDay, refreshToday, runtime.unitOfWork]);

  async function recordTried() {
    if (!runtime.commands || inFlightRef.current) return;
    inFlightRef.current = true;
    setPending(true);
    setFeedback('idle');
    const ids = mintMomentIds(services.ids);
    const intentMs = services.clock.now().epochMs;
    try {
      const result = await runtime.commands.dispatch(
        buildRecordExperienceCommand({
          ids,
          childId,
          occurredAt: nowInZone(intentMs, timeZone),
          intentCapturedAtMs: intentMs,
          title: revision.title,
          area: revision.primaryArea,
          activityId: revision.activityId,
          activityRevisionId: revision.revisionId,
        }),
      );
      if (!result.ok) {
        setFeedback('error');
        return;
      }
      setFeedback('saved');
      await refreshToday();
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }

  async function recordAgain() {
    // Fresh ids — explicit second experience, not a retry of the first tap.
    inFlightRef.current = false;
    await recordTried();
  }

  async function setReaction(reaction: 'liked' | 'not_liked') {
    if (!runtime.commands || !todayExperience) return;
    const intentMs = services.clock.now().epochMs;
    const command = buildEditCareCommand({
      event: todayExperience,
      expectedRevisionId: todayExperience.revisionId,
      operationId: asOperationId(services.ids.createId('op')),
      revisionId: asRevisionId(services.ids.createId('rev')),
      intentCapturedAtMs: intentMs,
      patch: { reaction },
    });
    const result = await runtime.commands.dispatch(command);
    if (result.ok) await refreshToday();
  }

  const triedLabel = todayExperience
    ? `${PRODUCT_COPY.development.triedTodayPrefix} ${formatClock(todayExperience.occurredAt.instant.epochMs, timeZone)}`
    : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { gap: ui.space.md }]}>
        <LumiButton title="Zpět" variant="secondary" onPress={onClose} />
        <LumiText variant="h1">{revision.title}</LumiText>
        <LumiText tone="muted">
          {DEVELOPMENT_AREA_LABELS_CS[revision.primaryArea]}
          {' · '}
          {durationLabel(revision)}
        </LumiText>
        {isDraft ? (
          <View style={{ gap: ui.space.xs }}>
            <LumiText>{PRODUCT_COPY.development.draftBadge}</LumiText>
            <LumiText tone="muted">{PRODUCT_COPY.development.draftPreviewNote}</LumiText>
          </View>
        ) : null}

        {readinessKeys.length > 0 ? (
          <View style={{ gap: ui.space.sm }} testID="activity-readiness">
            <LumiText variant="h2">{PRODUCT_COPY.development.readinessTitle}</LumiText>
            <LumiText tone="muted">{PRODUCT_COPY.development.readinessHint}</LumiText>
            {readinessKeys.map((key) => {
              const state = readinessByKey[key] ?? 'unknown';
              return (
                <View key={key} style={{ gap: ui.space.xs }}>
                  <LumiText>{READINESS_LABELS_CS[key]}</LumiText>
                  <View style={styles.row}>
                    <LumiChip
                      label={PRODUCT_COPY.development.readinessYes}
                      selected={state === 'yes'}
                      onPress={() => onConfirmReadiness?.(key, 'yes')}
                    />
                    <LumiChip
                      label={PRODUCT_COPY.development.readinessNo}
                      selected={state === 'no'}
                      onPress={() => onConfirmReadiness?.(key, 'no')}
                    />
                    <LumiChip
                      label={PRODUCT_COPY.development.readinessUnknown}
                      selected={state === 'unknown'}
                      onPress={() => onClearReadiness?.(key)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={{ gap: ui.space.xs }}>
          <LumiText variant="h2">{PRODUCT_COPY.development.materials}</LumiText>
          <LumiText>
            {revision.materials.length === 0
              ? PRODUCT_COPY.development.noMaterials
              : revision.materials.join(', ')}
          </LumiText>
        </View>

        <View style={{ gap: ui.space.xs }}>
          <LumiText variant="h2">{PRODUCT_COPY.development.howTo}</LumiText>
          {revision.steps.map((step, index) => (
            <LumiText key={`${revision.revisionId}-step-${index}`}>
              {index + 1}. {step}
            </LumiText>
          ))}
        </View>

        {revision.conversationPrompt ? (
          <View style={{ gap: ui.space.xs }}>
            <LumiText variant="h2">{PRODUCT_COPY.development.say}</LumiText>
            <LumiText>{revision.conversationPrompt}</LumiText>
          </View>
        ) : null}

        {revision.constraints.length > 0 ? (
          <View style={{ gap: ui.space.xs }}>
            <LumiText variant="h2">{PRODUCT_COPY.development.watchOut}</LumiText>
            {revision.constraints.map((item) => (
              <LumiText key={item}>{item}</LumiText>
            ))}
          </View>
        ) : null}

        <Pressable onPress={() => setExpandedWhy((value) => !value)} style={styles.expand}>
          <LumiText>{PRODUCT_COPY.actions.showWhy}</LumiText>
        </Pressable>
        {expandedWhy ? (
          <LumiText tone="muted">
            {revision.readinessNotes ??
              'Krátká společná chvíle podle schválených podmínek aktivity.'}
          </LumiText>
        ) : null}

        <Pressable onPress={() => setExpandedSources((value) => !value)} style={styles.expand}>
          <LumiText>{PRODUCT_COPY.actions.showSources}</LumiText>
        </Pressable>
        {expandedSources ? (
          <View style={{ gap: ui.space.xs }}>
            <LumiText tone="muted">Verze obsahu: {revision.revisionId}</LumiText>
            {revision.sources.map((source) => (
              <LumiText key={`${source.label}-${source.checkedOn}`} tone="muted">
                {source.label}
                {source.url ? ` · ${source.url}` : ''}
                {source.supportsPrinciple ? ` — ${source.supportsPrinciple}` : ''}
                {' · '}
                návštěva {source.checkedOn}
              </LumiText>
            ))}
          </View>
        ) : null}

        {!triedLabel ? (
          <LumiButton
            title={PRODUCT_COPY.actions.weTried}
            fullWidth
            loading={pending}
            onPress={() => void recordTried()}
            testID="activity-we-tried"
          />
        ) : (
          <View style={{ gap: ui.space.sm }}>
            <LumiText>{triedLabel}</LumiText>
            <View style={styles.row}>
              <LumiButton
                title={PRODUCT_COPY.actions.edit}
                variant="secondary"
                onPress={() => onOpenEvent?.(todayExperience!.eventId)}
              />
              <LumiButton
                title={PRODUCT_COPY.actions.recordAgain}
                variant="secondary"
                loading={pending}
                onPress={() => void recordAgain()}
                testID="activity-record-again"
              />
            </View>
            <LumiText tone="muted">Jaké to bylo? (volitelně)</LumiText>
            <View style={styles.row}>
              <LumiChip
                label={PRODUCT_COPY.actions.liked}
                selected={todayExperience?.reaction === 'liked'}
                onPress={() => void setReaction('liked')}
              />
              <LumiChip
                label={PRODUCT_COPY.actions.notLiked}
                selected={todayExperience?.reaction === 'not_liked'}
                onPress={() => void setReaction('not_liked')}
              />
            </View>
          </View>
        )}

        <LumiButton
          title={isFavorite ? PRODUCT_COPY.actions.unfavorite : PRODUCT_COPY.actions.favorite}
          variant="secondary"
          fullWidth
          onPress={onToggleFavorite}
        />
        <SaveFeedback state={feedback} />
      </ScrollView>
    </SafeAreaView>
  );
}

function requiredReadinessKeys(revision: ActivityRevision): ReadinessKey[] {
  const keys: ReadinessKey[] = [];
  for (const condition of revision.suitability) {
    if (condition.kind === 'readiness_confirmed' && !keys.includes(condition.key)) {
      keys.push(condition.key);
    }
  }
  return keys;
}

function durationLabel(revision: ActivityRevision): string {
  if (revision.duration.kind === 'moment') return PRODUCT_COPY.development.filterMoment;
  return `${revision.duration.minutes} minut`;
}

function formatClock(epochMs: number, timeZone: TimeZoneId): string {
  try {
    return new Intl.DateTimeFormat('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(new Date(epochMs));
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 24,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  expand: { minHeight: 48, justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
