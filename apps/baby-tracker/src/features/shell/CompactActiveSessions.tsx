import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ActiveSession } from '../../domain';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';
import { useCompositionRoot } from '../../app/providers';
import { PRODUCT_COPY } from '../ui';
import { formatElapsedUnits } from '../today/recordSleepIntent';
import { nursingElapsedMs } from '../today/recordFeedingIntent';

type CompactActiveSessionsProps = {
  /** When true, Today already shows the expanded block — hide this strip. */
  hidden?: boolean;
  onOpenSleep: () => void;
};

/**
 * Compact strip above tab content for non-Today screens. Never duplicates the
 * expanded Today measurement on the same view. Sleep and nursing can both show.
 */
export function CompactActiveSessions({ hidden = false, onOpenSleep }: CompactActiveSessionsProps) {
  const { colors, ui } = useLumiTheme();
  const { profile } = useBootstrap();
  const runtime = usePersonalRuntime();
  const { services } = useCompositionRoot();
  const [sleep, setSleep] = useState<ActiveSession | null>(null);
  const [nursing, setNursing] = useState<ActiveSession | null>(null);
  const [nowMs, setNowMs] = useState(() => services.clock.now().epochMs);

  useEffect(() => {
    let cancelled = false;
    const childId = profile?.childId;
    async function load() {
      if (!childId) {
        if (!cancelled) {
          setSleep(null);
          setNursing(null);
        }
        return;
      }
      const [activeSleep, activeNursing] = await Promise.all([
        runtime.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'sleep')),
        runtime.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'nursing')),
      ]);
      if (!cancelled) {
        setSleep(activeSleep);
        setNursing(activeNursing);
      }
    }
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    const unsubscribe = runtime.readModels.subscribe((topics) => {
      if (topics.includes('sessions')) void load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [profile?.childId, runtime.readModels, runtime.unitOfWork]);

  useEffect(() => {
    if (hidden || (!sleep && !nursing)) return;
    const timer = setInterval(() => setNowMs(services.clock.now().epochMs), 1000);
    return () => clearInterval(timer);
  }, [hidden, nursing, services.clock, sleep]);

  if (hidden || (!sleep && !nursing)) return null;

  const sleepElapsed =
    sleep != null
      ? formatElapsedUnits(Math.max(0, nowMs - sleep.startedAt.instant.epochMs))
      : null;
  const nursingElapsed =
    nursing != null
      ? formatElapsedUnits(
          nursingElapsedMs({
            status: nursing.status === 'paused' ? 'paused' : 'running',
            activeSegments: nursing.activeSegments,
            ...(nursing.status === 'running'
              ? { currentSegmentStartedAtMs: nursing.currentSegmentStartedAtMs }
              : {}),
            nowMs,
          }),
        )
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        sleepElapsed
          ? `${PRODUCT_COPY.actions.sleepRunning}, ${sleepElapsed}`
          : null,
        nursingElapsed
          ? `${PRODUCT_COPY.actions.nursingRunning}, ${nursingElapsed}`
          : null,
      ]
        .filter(Boolean)
        .join('. ')}
      onPress={onOpenSleep}
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.controlBorder,
          paddingHorizontal: ui.space.md,
          paddingVertical: ui.space.sm,
          gap: ui.space.sm,
        },
      ]}
    >
      <View style={{ gap: 2, flexShrink: 1 }}>
        {sleepElapsed ? (
          <LumiText variant="label">
            {PRODUCT_COPY.actions.sleepRunning} · {sleepElapsed}
          </LumiText>
        ) : null}
        {nursingElapsed ? (
          <LumiText variant="label">
            {nursing?.status === 'paused'
              ? PRODUCT_COPY.actions.nursingPaused
              : PRODUCT_COPY.actions.nursingRunning}{' '}
            · {nursingElapsed}
          </LumiText>
        ) : null}
      </View>
      <View style={{ flex: 1 }} />
      <LumiText tone="accent">
        {sleep && nursing
          ? 'Otevřít'
          : sleep
            ? PRODUCT_COPY.actions.endSleep
            : PRODUCT_COPY.actions.endNursing}
      </LumiText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    minHeight: 48,
  },
});
