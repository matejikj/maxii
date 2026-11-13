import { ActivityDemonstration } from './ActivityDemonstration';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiCard, LumiChip, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ChildId, ExperienceCareEvent, TimeZoneId } from '../../domain';
import type { ActivityRevision, ReadinessKey, ReadinessState } from '../../content';
import { DEVELOPMENT_AREA_LABELS_CS, READINESS_LABELS_CS } from '../../content';
import { findTodaysExperienceForActivity, openDailyRecommendation } from '../../application';
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
import { ActivityMetadata, DevelopmentHeading } from './DevelopmentVisuals';
import { CompactActiveSessionsVisibleContext } from '../shell/CompactActiveSessions';
import { useForestDockInset } from '../../app/navigation/ForestGlassTabBar';

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
  mutationError?: string | null;
  mutationBusy?: boolean;
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
  mutationError,
  mutationBusy = false,
}: ActivityDetailScreenProps) {
  const { colors, ui } = useLumiTheme();
  const dockInset = useForestDockInset();
  const stripVisible = useContext(CompactActiveSessionsVisibleContext);
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const detailScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [demoVisible, setDemoVisible] = useState(false);
  const demoVisibility = useRef({
    offset: 0,
    height: 0,
    sectionTop: 0,
    localTop: 0,
    demoHeight: 0,
    visible: false,
  });
  const checkDemoVisibility = () => {
    const bounds = demoVisibility.current;
    const top = bounds.sectionTop + bounds.localTop;
    const visible =
      bounds.height > 0 &&
      bounds.demoHeight > 0 &&
      top + bounds.demoHeight > bounds.offset &&
      top < bounds.offset + bounds.height;
    if (visible !== bounds.visible) {
      bounds.visible = visible;
      setDemoVisible(visible);
    }
  };
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
    <SafeAreaView
      edges={stripVisible ? ['left', 'right'] : ['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
      testID="activity-detail-screen"
    >
      <ScrollView
        ref={detailScroll}
        onLayout={(event) => {
          demoVisibility.current.height = Math.max(0, event.nativeEvent.layout.height - dockInset);
          checkDemoVisibility();
        }}
        onScroll={(event) => {
          demoVisibility.current.offset = event.nativeEvent.contentOffset.y;
          checkDemoVisibility();
        }}
        scrollEventThrottle={80}
        contentContainerStyle={[
          styles.content,
          { gap: ui.space.md, paddingBottom: dockInset + 32 },
        ]}
      >
        <LumiButton
          title="Zpět na Rozvoj"
          variant="ghost"
          onPress={onClose}
          testID="activity-back"
        />
        <LumiCard variant="soft" style={styles.detailHeading}>
          <LumiText variant="overline" tone="muted">
            SPOLEČNÁ CHVÍLE
          </LumiText>
          <LumiText variant="h1" accessibilityRole="header">
            {revision.title}
          </LumiText>
          <LumiText variant="label" tone="accent">
            {DEVELOPMENT_AREA_LABELS_CS[revision.primaryArea]}
          </LumiText>
          <ActivityMetadata revision={revision} />
        </LumiCard>
        {isDraft ? (
          <View style={{ gap: ui.space.xs }}>
            <LumiText>{PRODUCT_COPY.development.draftBadge}</LumiText>
            <LumiText tone="muted">{PRODUCT_COPY.development.draftPreviewNote}</LumiText>
          </View>
        ) : null}

        {readinessKeys.length > 0 ? (
          <LumiCard style={styles.detailHeading} testID="activity-readiness">
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
                      disabled={mutationBusy}
                      onPress={() => onConfirmReadiness?.(key, 'yes')}
                    />
                    <LumiChip
                      label={PRODUCT_COPY.development.readinessNo}
                      selected={state === 'no'}
                      disabled={mutationBusy}
                      onPress={() => onConfirmReadiness?.(key, 'no')}
                    />
                    <LumiChip
                      label={PRODUCT_COPY.development.readinessUnknown}
                      selected={state === 'unknown'}
                      disabled={mutationBusy}
                      onPress={() => onClearReadiness?.(key)}
                    />
                  </View>
                </View>
              );
            })}
          </LumiCard>
        ) : null}

        <LumiCard style={styles.detailHeading}>
          <DevelopmentHeading title={PRODUCT_COPY.development.materials} icon="experience" />
          <LumiText>
            {revision.materials.length === 0
              ? PRODUCT_COPY.development.noMaterials
              : revision.materials.join(', ')}
          </LumiText>
        </LumiCard>

        <View
          style={{ gap: ui.space.xs }}
          testID="activity-steps"
          onLayout={(event) => {
            demoVisibility.current.sectionTop = event.nativeEvent.layout.y;
            checkDemoVisibility();
          }}
        >
          <DevelopmentHeading
            title={PRODUCT_COPY.development.howTo}
            subtitle="Krok za krokem, bez spěchu"
          />
          <View
            onLayout={(event) => {
              demoVisibility.current.localTop = event.nativeEvent.layout.y;
              checkDemoVisibility();
            }}
          >
            <ActivityDemonstration
              revision={revision}
              visible={demoVisible}
              onShowScene={() =>
                detailScroll.current?.scrollTo({
                  y: Math.max(0, demoVisibility.current.sectionTop - 16),
                  animated: false,
                })
              }
              onSceneLayout={(height) => {
                demoVisibility.current.demoHeight = height;
                checkDemoVisibility();
              }}
            />
          </View>
          {revision.steps.map((step, index) => (
            <LumiCard key={`${revision.revisionId}-step-${index}`} style={styles.step} padding="md">
              <View style={[styles.stepNumber, { backgroundColor: colors.secondary }]}>
                <LumiText variant="bodyStrong" tone="accent">
                  {index + 1}
                </LumiText>
              </View>
              <LumiText style={{ flex: 1 }}>{step}</LumiText>
            </LumiCard>
          ))}
        </View>

        {revision.conversationPrompt ? (
          <LumiCard variant="soft" style={styles.detailHeading}>
            <LumiText variant="h2">{PRODUCT_COPY.development.say}</LumiText>
            <LumiText>{revision.conversationPrompt}</LumiText>
          </LumiCard>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: expandedWhy }}
          onPress={() => setExpandedWhy((value) => !value)}
          style={[styles.expand, { borderBottomColor: colors.border }]}
        >
          <LumiText>{PRODUCT_COPY.actions.showWhy}</LumiText>
        </Pressable>
        {expandedWhy ? (
          <LumiText tone="muted">
            {revision.readinessNotes ??
              'Krátká společná chvíle podle schválených podmínek aktivity.'}
          </LumiText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: expandedSources }}
          onPress={() => setExpandedSources((value) => !value)}
          style={[styles.expand, { borderBottomColor: colors.border }]}
        >
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
          loading={mutationBusy}
          onPress={onToggleFavorite}
        />
        {mutationError ? (
          <LumiText tone="danger" accessibilityRole="alert">
            {mutationError}
          </LumiText>
        ) : null}
        <SaveFeedback state={feedback} />
        {revision.constraints.length > 0 ? (
          <LumiCard style={styles.detailHeading} testID="activity-conditions">
            <LumiText variant="h2">{PRODUCT_COPY.development.watchOut}</LumiText>
            {revision.constraints.map((item) => (
              <LumiText key={item}>{item}</LumiText>
            ))}
          </LumiCard>
        ) : null}
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
    padding: 20,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  detailHeading: { gap: 12, borderRadius: 25 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 22 },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expand: { minHeight: 52, justifyContent: 'center', borderBottomWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
