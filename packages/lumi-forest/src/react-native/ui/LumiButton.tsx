import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle, View } from 'react-native';
import { useLumiTheme } from '../LumiThemeProvider';
import { LumiText } from './LumiText';

export type LumiButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type LumiButtonSize = 'compact' | 'regular' | 'large';
export interface LumiButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: LumiButtonVariant;
  size?: LumiButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}
/** Primary touch targets stay at least 48 logical units for comfortable care taps. */
const heights: Record<LumiButtonSize, number> = { compact: 48, regular: 48, large: 56 };
export const LumiButton = React.memo(function LumiButton({ title, variant = 'primary', size = 'regular', loading = false,
  disabled = false, fullWidth = false, leftAdornment, rightAdornment, style, accessibilityLabel, onFocus, onBlur, ...rest }: LumiButtonProps) {
  const { colors, ui } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  const inactive = disabled || loading;
  const background = variant === 'primary' ? colors.primary : variant === 'destructive' ? colors.danger
    : variant === 'secondary' ? colors.secondary : 'transparent';
  const foreground = variant === 'primary' ? colors.onPrimary : variant === 'destructive' ? colors.onDanger
    : variant === 'secondary' ? colors.onSecondary : variant === 'ghost' ? colors.primary : colors.text;
  const outlined = variant === 'outline';
  return <Pressable {...rest} disabled={inactive}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}
    accessibilityState={{ disabled: inactive, busy: loading }}
    style={({ pressed }) => [{ minHeight: heights[size], borderRadius: ui.radius.md,
      paddingHorizontal: size === 'compact' ? ui.space.md : ui.space.xl,
      backgroundColor: background, borderColor: focused ? (variant === 'primary' || variant === 'destructive' ? foreground : colors.focus) : outlined ? colors.controlBorder : background,
      borderWidth: focused ? 2 : outlined ? 1 : 0, opacity: inactive ? ui.opacity.disabled : pressed ? .84 : 1,
      width: fullWidth ? '100%' : undefined }, styles.base, style]}>
    <View style={styles.inner}>
      {loading ? <ActivityIndicator color={foreground} accessibilityElementsHidden /> : leftAdornment}
      <LumiText variant="label" style={{ color: foreground, textAlign: 'center' }}>{title}</LumiText>
      {!loading && rightAdornment}
    </View>
  </Pressable>;
});
const styles = StyleSheet.create({ base: { justifyContent: 'center', alignItems: 'center' },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 0 } });
