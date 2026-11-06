import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { LumiCard } from './LumiCard';
import { LumiText } from './LumiText';
import { useLumiTheme } from '../LumiThemeProvider';
export interface LumiChartContainerProps {
  title: string;
  /** Mandatory equivalent for users who cannot interpret a visual chart. */
  summary: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}
export function LumiChartContainer({ title, summary, subtitle, children, footer, style }: LumiChartContainerProps) {
  const { ui } = useLumiTheme();
  return <LumiCard style={style} accessibilityLabel={title}>
    <LumiText variant="h3">{title}</LumiText>
    {subtitle ? <LumiText variant="caption" tone="muted">{subtitle}</LumiText> : null}
    <View accessible accessibilityRole="image" accessibilityLabel={`${title}. ${summary}`}
      style={{ minHeight: 160, paddingVertical: ui.space.lg, justifyContent: 'center' }}>{children}</View>
    <LumiText variant="caption" tone="muted">{summary}</LumiText>
    {footer ? <View style={{ marginTop: ui.space.sm }}>{footer}</View> : null}
  </LumiCard>;
}
