import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LumiButton, LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { PRODUCT_COPY } from './productCopy';
import { ForestIconBadge, forestTone } from './ForestIconBadge';

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
  icon?: 'sleep' | 'nursing';
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
  icon = 'sleep',
}: ActiveMeasurementProps) {
  const { ui, colors, mode } = useLumiTheme();
  const { width, fontScale } = useWindowDimensions();
  const stacked = compact || width < 350 || fontScale > 1.25;
  const tone = forestTone(mode, icon);
  const elapsedMs = Math.max(0, nowEpochMs - startedAtEpochMs);
  const [announceElapsed, setAnnounceElapsed] = useState(false);
  const display = elapsedLabel ?? formatElapsedClock(elapsedMs);
  const statusLabel = `${PRODUCT_COPY.measurement.running}. ${title}. ${PRODUCT_COPY.measurement.elapsedAvailable}`;

  return (
    <LumiCard padding="none" style={{ padding: 20, borderRadius: 26 }}>
      <View style={{ gap: ui.space.md }}>
        <View
          accessible
          accessibilityRole="summary"
          accessibilityLabel={statusLabel}
          accessibilityLiveRegion="polite"
          style={styles.status}
        >
          <ForestIconBadge name={icon} size={44} />
          <View style={{ flex: 1, gap: 3 }}>
            <LumiText variant="caption" tone="muted">
              {PRODUCT_COPY.measurement.running}
            </LumiText>
            <LumiText variant={compact ? 'label' : 'h2'}>{title}</LumiText>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Délka ${display}. Klepnutím zopakujete oznámení.`}
          onPress={() => setAnnounceElapsed((value) => !value)}
          style={[
            styles.duration,
            {
              minHeight: compact ? 48 : 80,
              backgroundColor: tone.background,
              borderColor: colors.controlBorder,
            },
          ]}
        >
          <LumiText
            accessibilityLiveRegion={announceElapsed ? 'polite' : 'none'}
            variant={compact ? 'label' : 'display'}
            style={{ color: tone.ink, fontVariant: ['tabular-nums'], letterSpacing: -0.6 }}
          >
            {display}
          </LumiText>
        </Pressable>
        {uncertaintyNote ? (
          <LumiText tone="muted" variant="caption">
            {uncertaintyNote}
          </LumiText>
        ) : null}
        <View style={{ flexDirection: stacked ? 'column' : 'row', gap: ui.space.sm }}>
          <View style={stacked ? undefined : { flex: 1 }}>
            <LumiButton
              title={openLabel}
              variant="secondary"
              onPress={onOpen}
              fullWidth
              style={{ paddingHorizontal: 10 }}
            />
          </View>
          <View style={stacked ? undefined : { flex: 1 }}>
            <LumiButton
              title={stopLabel}
              onPress={onStop}
              fullWidth
              style={{ paddingHorizontal: 10 }}
            />
          </View>
        </View>
      </View>
    </LumiCard>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  duration: {
    minWidth: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
});
