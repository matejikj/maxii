import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LumiButton, LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { PRODUCT_COPY } from './productCopy';

export type ActiveMeasurementProps = {
  title: string;
  startedAtEpochMs: number;
  nowEpochMs: number;
  onOpen: () => void;
  onStop: () => void;
  compact?: boolean;
};

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Running care timer. The screen reader hears status changes, not every tick —
 * elapsed time is revealed on demand via the duration control.
 */
export function ActiveMeasurement({
  title,
  startedAtEpochMs,
  nowEpochMs,
  onOpen,
  onStop,
  compact = false,
}: ActiveMeasurementProps) {
  const { ui, colors } = useLumiTheme();
  const elapsedMs = Math.max(0, nowEpochMs - startedAtEpochMs);
  const [announceElapsed, setAnnounceElapsed] = useState(false);
  // Status block uses polite live region once; ticking digits stay outside it.
  const statusLabel = `${PRODUCT_COPY.measurement.running}. ${title}. ${PRODUCT_COPY.measurement.elapsedAvailable}`;

  return (
    <LumiCard>
      <View style={{ gap: ui.space.md }}>
        <View
          accessible
          accessibilityRole="summary"
          accessibilityLabel={statusLabel}
          accessibilityLiveRegion="polite"
        >
          <LumiText variant="caption" tone="accent">
            {PRODUCT_COPY.measurement.running}
          </LumiText>
          <LumiText variant="h2">{title}</LumiText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Délka ${formatElapsed(elapsedMs)}. Klepnutím zopakujete oznámení.`}
          onPress={() => setAnnounceElapsed((value) => !value)}
          style={[styles.duration, { minHeight: 48, borderColor: colors.controlBorder }]}
        >
          <LumiText
            accessibilityLiveRegion={announceElapsed ? 'polite' : 'none'}
            variant={compact ? 'label' : 'h1'}
          >
            {formatElapsed(elapsedMs)}
          </LumiText>
        </Pressable>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: ui.space.sm }}>
          <LumiButton
            title={PRODUCT_COPY.actions.sleepRunning}
            variant="secondary"
            onPress={onOpen}
            fullWidth={compact}
          />
          <LumiButton title="Ukončit spánek" onPress={onStop} fullWidth={compact} />
        </View>
      </View>
    </LumiCard>
  );
}

const styles = StyleSheet.create({
  duration: {
    minWidth: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
