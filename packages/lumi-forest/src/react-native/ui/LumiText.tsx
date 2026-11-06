import React from 'react';
import { Text, type TextProps } from 'react-native';
import type { LumiTextVariant } from '../../core/ui/tokens';
import { useLumiTheme } from '../LumiThemeProvider';

export type LumiTextTone = 'default' | 'muted' | 'inverse' | 'accent' | 'success' | 'danger' | 'warning';
export interface LumiTextProps extends TextProps {
  variant?: LumiTextVariant;
  tone?: LumiTextTone;
  children?: React.ReactNode;
}
/** Native Text retains font scaling; never disable allowFontScaling. */
export const LumiText = React.memo(function LumiText({ variant = 'body', tone = 'default', style, children, ...rest }: LumiTextProps) {
  const theme = useLumiTheme();
  const colors = theme.colors;
  const color = ({ default: colors.text, muted: colors.textMuted, inverse: colors.textInverse,
    accent: colors.sceneAccent, success: colors.success, danger: colors.danger, warning: colors.warning })[tone];
  return <Text {...rest} style={[theme.ui.type[variant], { color }, style]}>{children}</Text>;
});
