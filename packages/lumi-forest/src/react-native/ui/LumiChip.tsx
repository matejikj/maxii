import React, { useState } from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useLumiTheme } from '../LumiThemeProvider';
import { LumiText } from './LumiText';
export interface LumiChipProps extends Omit<PressableProps, 'children'> {
  label: string;
  selected?: boolean;
}
export const LumiChip = React.memo(function LumiChip({ label, selected = false, disabled, accessibilityLabel, onFocus, onBlur, ...props }: LumiChipProps) {
  const { colors, ui } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable {...props} disabled={disabled}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }} accessibilityLabel={accessibilityLabel ?? label}
    accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: !!disabled }}
    style={({ pressed }) => [styles.chip, { borderRadius: ui.radius.pill,
      backgroundColor: selected ? colors.primary : colors.surface,
      borderColor: focused ? colors.focus : selected ? colors.primary : colors.controlBorder,
      opacity: disabled ? ui.opacity.disabled : pressed ? .82 : 1 }]}>
    <LumiText variant="label" style={{ color: selected ? colors.onPrimary : colors.text }}>{label}</LumiText>
  </Pressable>;
});
const styles = StyleSheet.create({ chip: { minHeight: 44, paddingHorizontal: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' } });
