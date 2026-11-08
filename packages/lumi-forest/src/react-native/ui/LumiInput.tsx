import React, { useId, useState } from 'react';
import { TextInput, View, StyleSheet, type TextInputProps, type StyleProp, type ViewStyle, Platform } from 'react-native';
import { useLumiTheme } from '../LumiThemeProvider';
import { LumiText } from './LumiText';

export interface LumiInputProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Caller owns value and validation. Error text is linked to the field for
 * screen readers; multiline notes use the system keyboard (including optional
 * dictation) without any custom microphone control.
 */
export const LumiInput: React.ForwardRefExoticComponent<
  React.PropsWithoutRef<LumiInputProps> & React.RefAttributes<React.ComponentRef<typeof TextInput>>
> = React.forwardRef<React.ComponentRef<typeof TextInput>, LumiInputProps>(function LumiInput({
  label, hint, error, required = false, editable = true, containerStyle, style,
  accessibilityLabel, accessibilityHint, onFocus, onBlur, multiline = false, ...rest
}, ref) {
  const { colors, ui } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  const invalid = !!error;
  const disabled = !editable;
  const reactId = useId().replace(/:/g, '');
  const fieldId = `lumi-input-${reactId}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = invalid ? errorId : hint ? hintId : undefined;

  return <View style={[styles.container, { gap: ui.space.sm }, containerStyle]}>
    <LumiText variant="label" nativeID={`${fieldId}-label`}>{label}{required ? ' *' : ''}</LumiText>
    <TextInput {...rest} ref={ref} editable={editable} multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      onFocus={event => { setFocused(true); onFocus?.(event); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }}
      accessibilityLabel={accessibilityLabel ?? `${label}${required ? ', povinné' : ''}`}
      accessibilityHint={accessibilityHint ?? (error || hint)}
      accessibilityState={{ disabled }}
      // Web associates the error/hint node; native still exposes the message via hint + live region.
      {...(Platform.OS === 'web' && describedBy
        ? ({ accessibilityDescribedBy: describedBy, nativeID: fieldId } as object)
        : { nativeID: fieldId })}
      placeholderTextColor={colors.textMuted} selectionColor={colors.focus}
      style={[styles.input, {
        minHeight: multiline ? Math.max(ui.size.input * 2.5, 96) : ui.size.input,
        borderRadius: ui.radius.sm,
        backgroundColor: colors.surface,
        borderColor: invalid ? colors.danger : focused ? colors.focus : colors.controlBorder,
        color: colors.text,
        opacity: disabled ? ui.opacity.disabled : 1,
        paddingTop: multiline ? 12 : 10,
      }, style]}/>
    {error ? (
      <LumiText
        nativeID={errorId}
        accessibilityLiveRegion="polite"
        variant="caption"
        tone="danger"
        testID="lumi-input-error"
      >
        {error}
      </LumiText>
    ) : hint ? (
      <LumiText nativeID={hintId} variant="caption" tone="muted">{hint}</LumiText>
    ) : null}
  </View>;
});

const styles = StyleSheet.create({
  container: {},
  input: { borderWidth: 1.5, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16 },
});
