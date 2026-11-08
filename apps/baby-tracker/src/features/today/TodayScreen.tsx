import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LumiButton,
  LumiCard,
  LumiCharacter,
  LumiText,
  useLumiTheme,
} from '@lumi/forest-design/native';
import { asTimeZoneId } from '../../domain';
import { useBootstrap } from '../../app/session/BootstrapContext';
import { useHistoryTabState } from '../../app/session/HistoryTabContext';
import { formatIsoCalendarDate } from '../../app/navigation/historyTabState';
import { useCompositionRoot } from '../../app/providers';
import { PRODUCT_COPY } from '../ui';
import { DiaperRecorder } from './DiaperRecorder';
import { ExperienceRecorder } from './ExperienceRecorder';
import { FeedingRecorder } from './FeedingRecorder';
import { type QuickActionId } from './quickActions';
import { NursingSessionController } from './NursingSessionController';
import { SleepSessionController, useSleepStarter } from './SleepSessionController';
import { useTodayCareModel } from './useTodayCareModel';

type TodayScreenProps = {
  onOpenProfile: () => void;
  onOpenHistoryToday: () => void;
  onOpenEvent?: (eventId: string) => void;
};

/**
 * Care-first Today: measurement slot, four stable quick actions, last care,
 * one honest activity placeholder, and a link into today's History.
 */
export function TodayScreen({
  onOpenProfile,
  onOpenHistoryToday,
  onOpenEvent,
}: TodayScreenProps) {
  const { colors, mode, ui } = useLumiTheme();
  const { profile } = useBootstrap();
  const { services } = useCompositionRoot();
  const history = useHistoryTabState();
  const childName = profile?.displayName ?? 'Miminko';
  const childId = profile?.childId ?? null;
  const zone = asTimeZoneId(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const model = useTodayCareModel(childId, profile?.settings.summaryTimeZone);
  const sleepStarter = useSleepStarter(childId, zone, model.activeSleep);
  const [diaperOpen, setDiaperOpen] = useState(false);
  const [feedingOpen, setFeedingOpen] = useState(false);
  const [experienceOpen, setExperienceOpen] = useState(false);
  const [editingActions, setEditingActions] = useState(false);
  const [nowMs, setNowMs] = useState(() => services.clock.now().epochMs);
  const diaperOpenerRef = useRef(null);

  React.useEffect(() => {
    if (!model.activeSleep && !model.activeNursing) return;
    const timer = setInterval(() => setNowMs(services.clock.now().epochMs), 1000);
    return () => clearInterval(timer);
  }, [model.activeNursing, model.activeSleep, services.clock]);

  function openHistoryToday() {
    const today = formatIsoCalendarDate(services.clock.now().epochMs, zone);
    history.showToday(today);
    onOpenHistoryToday();
  }

  function actionTitle(id: QuickActionId): string {
    switch (id) {
      case 'feeding':
        return model.activeNursing
          ? PRODUCT_COPY.actions.nursingRunning
          : PRODUCT_COPY.actions.feeding;
      case 'sleep':
        return model.activeSleep
          ? PRODUCT_COPY.actions.sleepRunning
          : PRODUCT_COPY.actions.startSleep;
      case 'diaper':
        return PRODUCT_COPY.actions.diaper;
      case 'experience':
        return PRODUCT_COPY.actions.experience;
    }
  }

  async function onQuickAction(id: QuickActionId) {
    if (editingActions) {
      void model.reorderQuickActionEarlier(id);
      return;
    }
    if (id === 'diaper') {
      setDiaperOpen(true);
      return;
    }
    if (id === 'feeding') {
      setFeedingOpen(true);
      return;
    }
    if (id === 'sleep') {
      const result = await sleepStarter.start();
      if (result.alreadyRunning) {
        // Opening the existing session is intentional — never start a second sleep.
        return;
      }
      return;
    }
    if (id === 'experience') {
      setExperienceOpen(true);
    }
  }

  const hasActiveMeasurement = Boolean(model.activeSleep || model.activeNursing);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <View style={styles.headingText}>
            <LumiText variant="caption" tone="accent">
              LUMI
            </LumiText>
            <LumiText variant="h1" accessibilityRole="header">
              Dnes s {childName}
            </LumiText>
            <LumiText tone="muted">
              {model.calendarDate ? model.calendarDate : 'Místní deník bez účtu'}
            </LumiText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Otevřít profil a nastavení"
            onPress={onOpenProfile}
            style={[styles.avatar, { borderColor: colors.controlBorder }]}
          >
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <LumiCharacter species="rabbit" expression="happy" />
            </View>
          </Pressable>
        </View>

        {childId ? (
          <>
            <SleepSessionController
              childId={childId}
              timeZone={zone}
              activeSleep={model.activeSleep}
              nowEpochMs={nowMs}
            />
            <NursingSessionController
              childId={childId}
              timeZone={zone}
              activeNursing={model.activeNursing}
              nowEpochMs={nowMs}
            />
          </>
        ) : null}
        {!hasActiveMeasurement ? (
          <LumiCard>
            <LumiText variant="caption" tone="muted">
              {PRODUCT_COPY.measurement.none}
            </LumiText>
            {sleepStarter.message ? <LumiText>{sleepStarter.message}</LumiText> : null}
          </LumiCard>
        ) : null}

        <View style={{ gap: ui.space.sm }}>
          <View style={styles.rowBetween}>
            <LumiText variant="h2">{PRODUCT_COPY.today.quickActions}</LumiText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={PRODUCT_COPY.actions.editQuickActions}
              onPress={() => setEditingActions((value) => !value)}
              style={styles.editLink}
            >
              <LumiText tone="accent">
                {editingActions ? PRODUCT_COPY.actions.close : PRODUCT_COPY.actions.editQuickActions}
              </LumiText>
            </Pressable>
          </View>
          {editingActions ? (
            <LumiText tone="muted" variant="caption">
              Klepnutím posunete akci dřív. Pořadí se uloží; frekvence ho sama nemění.
            </LumiText>
          ) : null}
          <View style={styles.quickGrid}>
            {model.quickActions.map((id) => {
              const button = (
                <LumiButton
                  title={actionTitle(id)}
                  variant={
                    id === 'diaper' ||
                    id === 'feeding' ||
                    (id === 'sleep' && !model.activeSleep)
                      ? 'primary'
                      : 'secondary'
                  }
                  fullWidth
                  loading={id === 'sleep' && sleepStarter.pending}
                  onPress={() => void onQuickAction(id)}
                  testID={`quick-${id}`}
                />
              );
              if (id === 'diaper') {
                return (
                  <View key={id} ref={diaperOpenerRef} collapsable={false} style={styles.quickSlot}>
                    {button}
                  </View>
                );
              }
              return (
                <View key={id} style={styles.quickSlot}>
                  {button}
                </View>
              );
            })}
          </View>
        </View>

        {childId ? (
          <>
            <DiaperRecorder
              childId={childId}
              timeZone={zone}
              open={diaperOpen}
              onClose={() => setDiaperOpen(false)}
              returnFocusRef={diaperOpenerRef}
              {...(onOpenEvent ? { onOpenEvent } : {})}
            />
            <FeedingRecorder
              childId={childId}
              timeZone={zone}
              open={feedingOpen}
              onClose={() => setFeedingOpen(false)}
              activeNursing={model.activeNursing}
              {...(onOpenEvent ? { onOpenEvent } : {})}
            />
            <ExperienceRecorder
              childId={childId}
              timeZone={zone}
              open={experienceOpen}
              onClose={() => setExperienceOpen(false)}
            />
          </>
        ) : null}

        <LumiCard>
          <LumiText variant="h2">{PRODUCT_COPY.today.lastCare}</LumiText>
          {model.lastCare ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${model.lastCare.title}, ${model.lastCare.detail}`}
              onPress={() => onOpenEvent?.(model.lastCare!.eventId)}
              style={{ gap: ui.space.xs, minHeight: 48, justifyContent: 'center' }}
            >
              <LumiText>{model.lastCare.title}</LumiText>
              <LumiText tone="muted">{model.lastCare.detail}</LumiText>
            </Pressable>
          ) : (
            <LumiText tone="muted">{PRODUCT_COPY.empty.noLastCare}</LumiText>
          )}
        </LumiCard>

        <LumiCard>
          <LumiText variant="h2">{PRODUCT_COPY.today.together}</LumiText>
          <LumiText tone="muted">{PRODUCT_COPY.empty.activitySlot}</LumiText>
        </LumiCard>

        <LumiButton
          title={PRODUCT_COPY.actions.showTodayRecords}
          variant="secondary"
          fullWidth
          onPress={openHistoryToday}
        />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 20,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  heading: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headingText: { flex: 1, gap: 8 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  editLink: { minHeight: 48, justifyContent: 'center' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickSlot: { width: '47%', flexGrow: 1, minWidth: 140 },
});
