import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { LUMI_MOTIFS } from '@lumi/forest-design/core';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LumiCard,
  LumiIcon,
  LumiText,
  useLumiTheme,
} from '@lumi/forest-design/native';
import { asTimeZoneId } from '../../domain';
import { useBootstrap } from '../../app/session/BootstrapContext';
import { useHistoryTabState } from '../../app/session/HistoryTabContext';
import { formatIsoCalendarDate } from '../../app/navigation/historyTabState';
import { useForestDockInset } from '../../app/navigation/ForestGlassTabBar';
import { useCompositionRoot } from '../../app/providers';
import { BackupHintBanner } from '../shell/BackupHintBanner';
import { ChildSwitcher } from '../shell/ChildSwitcher';
import { PRODUCT_COPY } from '../ui';
import { DiaperRecorder } from './DiaperRecorder';
import { ExperienceRecorder } from './ExperienceRecorder';
import { FeedingRecorder } from './FeedingRecorder';
import { type QuickActionId } from './quickActions';
import { NursingSessionController } from './NursingSessionController';
import { SleepSessionController, useSleepStarter } from './SleepSessionController';
import { TodayTogetherCard } from './TodayTogetherCard';
import { useTodayCareModel } from './useTodayCareModel';
import { TodayHero, TodayIdleMeasurement, TodayLastCareCard, TodayQuickAction } from './TodayVisuals';

type TodayScreenProps = {
  onOpenProfile: () => void;
  onOpenHistoryToday: () => void;
  onOpenDevelopment?: () => void;
  onOpenEvent?: (eventId: string) => void;
};

/**
 * Care-first Today: measurement slot, four stable quick actions, last care,
 * shared daily development offer, and a link into today's History.
 */
export function TodayScreen({
  onOpenProfile,
  onOpenHistoryToday,
  onOpenDevelopment,
  onOpenEvent,
}: TodayScreenProps) {
  const { colors, mode, ui, motif } = useLumiTheme();
  const dockInset = useForestDockInset();
  const { profile } = useBootstrap();
  const focused = useIsFocused();
  const { width, fontScale } = useWindowDimensions();
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
  /** Capture child at sheet open so a mid-form context switch cannot rewrite the draft. */
  const [formChildId, setFormChildId] = useState(childId);
  const [formChildName, setFormChildName] = useState(childName);
  const [editingActions, setEditingActions] = useState(false);
  const [nowMs, setNowMs] = useState(() => services.clock.now().epochMs);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const diaperOpenerRef = useRef(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const measurementY = useRef(0);
  const celebrateLocalSave = useCallback(() => {
    setCelebrationKey((value) => value + 1);
  }, []);

  function openBoundForm(setter: (open: boolean) => void) {
    if (!childId) return;
    setFormChildId(childId);
    setFormChildName(childName);
    setter(true);
  }

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
      openBoundForm(setDiaperOpen);
      return;
    }
    if (id === 'feeding') {
      openBoundForm(setFeedingOpen);
      return;
    }
    if (id === 'sleep') {
      const result = await sleepStarter.start();
      if (result.alreadyRunning) {
        // Opening the existing session is intentional — never start a second sleep.
        scrollRef.current?.scrollTo({ y: measurementY.current, animated: false });
        return;
      }
      if (result.ok) celebrateLocalSave();
      return;
    }
    if (id === 'experience') {
      openBoundForm(setExperienceOpen);
    }
  }

  const hasActiveMeasurement = Boolean(model.activeSleep || model.activeNursing);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={['top']}
      testID="today-screen"
    >
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: dockInset + 28 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <View style={{ flex: 1 }}>
            <LumiText variant="overline" tone="muted" style={styles.brand}>{LUMI_MOTIFS[motif].brand}</LumiText>
          </View>
          <ChildSwitcher compact />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Otevřít profil a nastavení"
            onPress={onOpenProfile}
            testID="today-open-profile"
            style={({ pressed }) => [styles.profileButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
          >
            <LumiIcon name="settings" color={colors.primary} size={23} />
          </Pressable>
        </View>
        <TodayHero childName={childName} calendarDate={model.calendarDate}
          celebrationKey={celebrationKey} visible={focused} />

        <View onLayout={(event) => { measurementY.current = event.nativeEvent.layout.y; }}
          style={hasActiveMeasurement ? { gap: 12 } : undefined}>
          {childId ? (
            <>
              <SleepSessionController
                childId={childId}
                timeZone={zone}
                activeSleep={model.activeSleep}
                nowEpochMs={nowMs}
                onSavedLocally={celebrateLocalSave}
              />
              <NursingSessionController
                childId={childId}
                timeZone={zone}
                activeNursing={model.activeNursing}
                nowEpochMs={nowMs}
                onSavedLocally={celebrateLocalSave}
              />
            </>
          ) : null}
          {!hasActiveMeasurement ? (
            <TodayIdleMeasurement message={sleepStarter.message} />
          ) : null}
        </View>

        <View style={{ gap: ui.space.sm }}>
          <View style={styles.rowBetween}>
            <LumiText variant="h2" accessibilityRole="header" style={{ flexShrink: 1 }}>{PRODUCT_COPY.today.quickActions}</LumiText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={PRODUCT_COPY.actions.editQuickActions}
              onPress={() => setEditingActions((value) => !value)}
              style={styles.editLink}
              accessibilityState={{ expanded: editingActions }}
            >
              <LumiText variant="label" tone="accent">
                {editingActions ? 'Hotovo' : PRODUCT_COPY.actions.edit}
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
                <TodayQuickAction
                  id={id}
                  title={actionTitle(id)}
                  running={(id === 'sleep' && Boolean(model.activeSleep)) || (id === 'feeding' && Boolean(model.activeNursing))}
                  pending={id === 'sleep' && sleepStarter.pending}
                  editing={editingActions}
                  onPress={() => void onQuickAction(id)}
                />
              );
              if (id === 'diaper') {
                return (
                  <View key={id} ref={diaperOpenerRef} collapsable={false}
                    style={[styles.quickSlot, width < 350 || fontScale > 1.25 ? styles.singleSlot : null]}>
                    {button}
                  </View>
                );
              }
              return (
                <View key={id} style={[styles.quickSlot, width < 350 || fontScale > 1.25 ? styles.singleSlot : null]}>
                  {button}
                </View>
              );
            })}
          </View>
        </View>

        {diaperOpen || feedingOpen || experienceOpen ? (
          <LumiText tone="muted" variant="caption">
            Zápis pro {formChildName}
            {formChildId && childId && formChildId !== childId
              ? ' — aktivní dítě v hlavičce je jiné; tento formulář zůstává u původního.'
              : ''}
          </LumiText>
        ) : null}

        {formChildId ? (
          <>
            <DiaperRecorder
              childId={formChildId}
              timeZone={zone}
              open={diaperOpen}
              onClose={() => setDiaperOpen(false)}
              returnFocusRef={diaperOpenerRef}
              onSavedLocally={celebrateLocalSave}
              {...(onOpenEvent ? { onOpenEvent } : {})}
            />
            <FeedingRecorder
              childId={formChildId}
              timeZone={zone}
              open={feedingOpen}
              onClose={() => setFeedingOpen(false)}
              activeNursing={
                formChildId === childId ? model.activeNursing : null
              }
              onSavedLocally={celebrateLocalSave}
              {...(onOpenEvent ? { onOpenEvent } : {})}
            />
            <ExperienceRecorder
              childId={formChildId}
              timeZone={zone}
              open={experienceOpen}
              onClose={() => setExperienceOpen(false)}
              onSavedLocally={celebrateLocalSave}
            />
          </>
        ) : null}

        <TodayLastCareCard lastCare={model.lastCare} {...(onOpenEvent ? { onOpenEvent } : {})} />

        <BackupHintBanner />

        {profile ? (
          <TodayTogetherCard
            profile={profile}
            sleepRunning={Boolean(model.activeSleep)}
            onOpenDevelopment={() => onOpenDevelopment?.()}
          />
        ) : (
          <LumiCard>
            <LumiText variant="h2">{PRODUCT_COPY.today.together}</LumiText>
            <LumiText tone="muted">{PRODUCT_COPY.empty.activitySlot}</LumiText>
          </LumiCard>
        )}

        <Pressable onPress={openHistoryToday} accessibilityRole="button"
          accessibilityLabel={PRODUCT_COPY.actions.showTodayRecords} testID="today-open-history"
          style={({ pressed }) => [styles.historyLink, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}>
          <LumiIcon name="history" color={colors.primary} size={22} />
          <LumiText variant="label" style={{ flex: 1, color: colors.primary }}>{PRODUCT_COPY.actions.showTodayRecords}</LumiText>
          <LumiIcon name="arrow-right" color={colors.primary} size={18} />
        </Pressable>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 18,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  heading: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  brand: { fontSize: 10, lineHeight: 17, letterSpacing: 1.8 },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  editLink: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickSlot: { flexBasis: '47%', flexGrow: 1, minWidth: 140 },
  singleSlot: { flexBasis: '100%' },
  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, minHeight: 54 },
});
