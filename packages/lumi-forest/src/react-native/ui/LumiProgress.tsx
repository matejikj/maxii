import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLumiTheme } from '../LumiThemeProvider';
import { LumiText } from './LumiText';
export interface LumiProgressProps { value: number; max?: number; label: string; showValue?: boolean; testID?: string; }
export function LumiProgress({ value, max = 100, label, showValue = true, testID }: LumiProgressProps) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) throw new RangeError('Invalid progress range');
  const { colors, ui } = useLumiTheme();
  const now = Math.max(0, Math.min(max, value));
  const percentage = Math.round(100 * now / max);
  return <View testID={testID} style={styles.root}>
    <View style={styles.labels}><LumiText variant="label">{label}</LumiText>{showValue && <LumiText tone="muted" variant="caption">{percentage}%</LumiText>}</View>
    <View accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now }} style={[styles.track, { borderRadius: ui.radius.pill, backgroundColor: colors.surfaceSubtle }]}>
      <View style={{ height: '100%', width: `${percentage}%`, backgroundColor: colors.primary, borderRadius: ui.radius.pill }}/>
    </View>
  </View>;
}
const styles = StyleSheet.create({ root: { gap: 9 }, labels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 10, overflow: 'hidden' } });
