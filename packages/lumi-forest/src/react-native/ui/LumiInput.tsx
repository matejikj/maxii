import React, { useState } from 'react';
import { TextInput, View, StyleSheet, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { useLumiTheme } from '../LumiThemeProvider';
import { LumiText } from './LumiText';

export interface LumiInputProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}
/** Caller owns value and validation; hint/error never compete for vertical real estate. */
export const LumiInput: React.ForwardRefExoticComponent<
  React.PropsWithoutRef<LumiInputProps> & React.RefAttributes<React.ComponentRef<typeof TextInput>>
> = React.forwardRef<React.ComponentRef<typeof TextInput>, LumiInputProps>(function LumiInput({
  label, hint, error, required = false, editable = true, containerStyle, style,
  accessibilityLabel, accessibilityHint, onFocus, onBlur, ...rest
}, ref) {
  const { colors, ui } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  const invalid = !!error;
  const disabled = !editable;
  return <View style={[styles.container, { gap: ui.space.sm }, containerStyle]}>
    <LumiText variant="label">{label}{required ? ' *' : ''}</LumiText>
    <TextInput {...rest} ref={ref} editable={editable}
      onFocus={event => { setFocused(true); onFocus?.(event); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }} accessibilityLabel={accessibilityLabel ?? `${label}${required ? ', povinné' : ''}`}
      accessibilityHint={accessibilityHint ?? (error || hint)} accessibilityState={{ disabled }}
      placeholderTextColor={colors.textMuted} selectionColor={colors.focus}
      style={[styles.input, { minHeight: ui.size.input, borderRadius: ui.radius.sm, backgroundColor: colors.surface,
        borderColor: invalid ? colors.danger : focused ? colors.focus : colors.controlBorder, color: colors.text,
        opacity: disabled ? ui.opacity.disabled : 1 }, style]}/>
    {error ? <LumiText accessibilityLiveRegion="polite" variant="caption" tone="danger" testID="lumi-input-error">{error}</LumiText>
      : hint ? <LumiText variant="caption" tone="muted">{hint}</LumiText> : null}
  </View>;
});
const styles = StyleSheet.create({ container: {}, input: { borderWidth: 1.5, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16 } });
