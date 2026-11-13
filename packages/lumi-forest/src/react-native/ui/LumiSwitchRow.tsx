import React from 'react';
import { Switch, StyleSheet, View } from 'react-native';
import { LumiText } from './LumiText';
import { useLumiTheme } from '../LumiThemeProvider';
export interface LumiSwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}
export function LumiSwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
  testID,
}: LumiSwitchRowProps) {
  const { colors, ui } = useLumiTheme();
  return (
    <View style={[styles.row, { minHeight: ui.size.touch }]}>
      <View style={styles.label}>
        <LumiText variant="bodyStrong">{label}</LumiText>
        {description ? (
          <LumiText variant="caption" tone="muted">
            {description}
          </LumiText>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityRole="switch"
        disabled={disabled}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  label: { flex: 1, gap: 3 },
});
