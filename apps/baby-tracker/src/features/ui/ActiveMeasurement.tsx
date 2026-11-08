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
  stopLabel?: string;
  openLabel?: string;
  /** Optional clock-skew / restart honesty line under the duration. */
  uncertaintyNote?: string | null;
  /** Prefer unit labels (“38 min”) over ambiguous MM:SS for care readability. */
  elapsedLabel?: string;
};

function formatElapsedClock(ms: number): string {
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
  stopLabel = 'Ukončit spánek',
  openLabel = PRODUCT_COPY.actions.sleepRunning,
  uncertaintyNote = null,
  elapsedLabel,
}: ActiveMeasurementProps) {
  const { ui, colors } = useLumiTheme();
  const elapsedMs = Math.max(0, nowEpochMs - startedAtEpochMs);
  const [announceElapsed, setAnnounceElapsed] = useState(false);
  const display = elapsedLabel ?? formatElapsedClock(elapsedMs);
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
          <LumiText variant={compact ? 'label' : 'h2'}>{title}</LumiText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Délka ${display}. Klepnutím zopakujete oznámení.`}
          onPress={() => setAnnounceElapsed((value) => !value)}
          style={[styles.duration, { minHeight: 48, borderColor: colors.controlBorder }]}
        >
          <LumiText
            accessibilityLiveRegion={announceElapsed ? 'polite' : 'none'}
            variant={compact ? 'label' : 'h1'}
          >
            {display}
          </LumiText>
        </Pressable>
        {uncertaintyNote ? (
          <LumiText tone="muted" variant="caption">
            {uncertaintyNote}
          </LumiText>
        ) : null}
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: ui.space.sm }}>
          <LumiButton title={openLabel} variant="secondary" onPress={onOpen} fullWidth={compact} />
          <LumiButton title={stopLabel} onPress={onStop} fullWidth={compact} />
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
