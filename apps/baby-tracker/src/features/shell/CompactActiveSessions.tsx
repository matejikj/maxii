import React, { createContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  listActiveSessionsForStrip,
  type ActiveSessionStripItem,
} from '../../domain';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';
import { useCompositionRoot } from '../../app/providers';
import { PRODUCT_COPY } from '../ui';
import { formatElapsedUnits } from '../today/recordSleepIntent';
import { nursingElapsedMs } from '../today/recordFeedingIntent';

type CompactActiveSessionsProps = {
  /** When true, Today already shows the expanded block — hide this strip. */
  hidden?: boolean;
  onOpenSleep: () => void;
  onVisibilityChange?: (visible: boolean) => void;
};

/** Screens can avoid applying the status-bar inset twice when the strip owns it. */
export const CompactActiveSessionsVisibleContext = createContext(false);

/**
 * Compact strip above tab content for non-Today screens. Names the child on
 * every running measurement so two timers never look interchangeable.
 */
export function CompactActiveSessions({ hidden = false, onOpenSleep, onVisibilityChange }: CompactActiveSessionsProps) {
  const { colors, ui } = useLumiTheme();
  const insets = useSafeAreaInsets();
  const { profiles, switchChild } = useBootstrap();
  const runtime = usePersonalRuntime();
  const { services } = useCompositionRoot();
  const [items, setItems] = useState<ActiveSessionStripItem[]>([]);
  const [nowMs, setNowMs] = useState(() => services.clock.now().epochMs);
  const visible = !hidden && items.length > 0;
  useEffect(() => { onVisibilityChange?.(visible); }, [onVisibilityChange, visible]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sessions = await runtime.unitOfWork.run((uow) => uow.sessions.listAll());
      const next = listActiveSessionsForStrip({ sessions, profiles });
      if (!cancelled) setItems(next);
    }
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    const unsubscribe = runtime.readModels.subscribe((topics) => {
      if (topics.includes('sessions') || topics.includes('profile')) void load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [profiles, runtime.readModels, runtime.unitOfWork]);

  useEffect(() => {
    if (hidden || items.length === 0) return;
    const timer = setInterval(() => setNowMs(services.clock.now().epochMs), 1000);
    return () => clearInterval(timer);
  }, [hidden, items.length, services.clock]);

  if (hidden || items.length === 0) return null;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.controlBorder,
          paddingHorizontal: ui.space.md,
          paddingVertical: ui.space.sm,
          paddingTop: ui.space.sm + insets.top,
          gap: ui.space.sm,
        },
      ]}
    >
      <View style={{ gap: 4, flex: 1 }}>
        {items.map((item) => {
          const session = item.session;
          const kindLabel =
            session.kind === 'sleep'
              ? PRODUCT_COPY.actions.sleepRunning
              : session.status === 'paused'
                ? PRODUCT_COPY.actions.nursingPaused
                : PRODUCT_COPY.actions.nursingRunning;
          const elapsed =
            session.kind === 'sleep' && session.status === 'running'
              ? formatElapsedUnits(Math.max(0, nowMs - session.startedAt.instant.epochMs))
              : session.kind === 'nursing' &&
                  (session.status === 'running' || session.status === 'paused')
                ? formatElapsedUnits(
                    nursingElapsedMs({
                      status: session.status === 'paused' ? 'paused' : 'running',
                      activeSegments: session.activeSegments,
                      ...(session.status === 'running'
                        ? { currentSegmentStartedAtMs: session.currentSegmentStartedAtMs }
                        : {}),
                      nowMs,
                    }),
                  )
                : '—';
          return (
            <Pressable
              key={session.sessionId}
              accessibilityRole="button"
              accessibilityLabel={`${item.displayName}: ${kindLabel}, ${elapsed}`}
              onPress={() => {
                void switchChild(item.childId).then(onOpenSleep);
              }}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <LumiText variant="label">
                {item.displayName} · {kindLabel} · {elapsed}
              </LumiText>
            </Pressable>
          );
        })}
      </View>
      <LumiText tone="accent">Otevřít</LumiText>
    </View>
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
