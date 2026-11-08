import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';
import { useCompositionRoot } from '../../app/providers';
import { PRODUCT_COPY } from '../ui';
import { formatElapsedUnits } from '../today/recordSleepIntent';

type CompactActiveSessionsProps = {
  /** When true, Today already shows the expanded block — hide this strip. */
  hidden?: boolean;
  onOpenSleep: () => void;
};

/**
 * Compact strip above tab content for non-Today screens. Never duplicates the
 * expanded Today measurement on the same view.
 */
export function CompactActiveSessions({ hidden = false, onOpenSleep }: CompactActiveSessionsProps) {
  const { colors, ui } = useLumiTheme();
  const { profile } = useBootstrap();
  const runtime = usePersonalRuntime();
  const { services } = useCompositionRoot();
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => services.clock.now().epochMs);

  useEffect(() => {
    let cancelled = false;
    const childId = profile?.childId;
    async function load() {
      if (!childId) {
        if (!cancelled) setStartedAtMs(null);
        return;
      }
      const active = await runtime.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'sleep'));
      if (!cancelled) {
        setStartedAtMs(active?.startedAt.instant.epochMs ?? null);
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
    if (startedAtMs == null || hidden) return;
    const timer = setInterval(() => setNowMs(services.clock.now().epochMs), 1000);
    return () => clearInterval(timer);
  }, [hidden, services.clock, startedAtMs]);

  if (hidden || startedAtMs == null) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${PRODUCT_COPY.actions.sleepRunning}, ${formatElapsedUnits(nowMs - startedAtMs)}`}
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
      <LumiText variant="label">{PRODUCT_COPY.actions.sleepRunning}</LumiText>
      <LumiText tone="muted">{formatElapsedUnits(Math.max(0, nowMs - startedAtMs))}</LumiText>
      <View style={{ flex: 1 }} />
      <LumiText tone="accent">{PRODUCT_COPY.actions.endSleep}</LumiText>
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
