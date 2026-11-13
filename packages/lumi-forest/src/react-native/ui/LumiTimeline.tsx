import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useLumiTheme } from '../LumiThemeProvider';
import { LumiText } from './LumiText';
export interface LumiTimelineItem {
  readonly id: string;
  readonly title: string;
  readonly detail?: string;
  readonly time?: string;
  readonly status?: 'complete' | 'current' | 'upcoming';
}
export interface LumiTimelineProps {
  readonly items: readonly LumiTimelineItem[];
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
}
export const LumiTimeline = React.memo(function LumiTimeline({
  items,
  style,
  accessibilityLabel = 'Časová osa',
}: LumiTimelineProps) {
  const { colors, ui } = useLumiTheme();
  return (
    <View style={style} accessibilityLabel={accessibilityLabel}>
      {items.map((item, index) => (
        <View
          key={item.id}
          style={styles.row}
          accessible
          accessibilityLabel={[
            item.time,
            item.title,
            item.detail,
            item.status === 'complete'
              ? 'Dokončeno'
              : item.status === 'current'
                ? 'Právě probíhá'
                : item.status === 'upcoming'
                  ? 'Nadcházející'
                  : undefined,
          ]
            .filter(Boolean)
            .join(', ')}
        >
          <View style={styles.rail}>
            <View
              style={[
                styles.dot,
                {
                  borderColor: item.status === 'upcoming' ? colors.border : colors.primary,
                  backgroundColor: item.status === 'complete' ? colors.primary : colors.surface,
                },
              ]}
            />
            {index < items.length - 1 && (
              <View style={[styles.line, { backgroundColor: colors.border }]} />
            )}
          </View>
          <View style={[styles.copy, { paddingBottom: ui.space.xl }]}>
            {item.time ? (
              <LumiText variant="overline" tone="muted">
                {item.time}
              </LumiText>
            ) : null}
            <LumiText variant="bodyStrong">{item.title}</LumiText>
            {item.detail ? (
              <LumiText variant="caption" tone="muted">
                {item.detail}
              </LumiText>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
});
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14 },
  rail: { width: 22, alignItems: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, marginTop: 5 },
  line: { flex: 1, width: 2, marginTop: 5 },
  copy: { flex: 1, gap: 2, minHeight: 62 },
});
