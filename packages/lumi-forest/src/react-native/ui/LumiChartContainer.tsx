import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { LumiCard } from './LumiCard';
import { LumiText } from './LumiText';
import { useLumiTheme } from '../LumiThemeProvider';

export type LumiChartTableRow = {
  label: string;
  value: string;
};

export interface LumiChartContainerProps {
  title: string;
  /** Mandatory equivalent for users who cannot interpret a visual chart. */
  summary: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Structured values exposed as a readable table alongside the graphic. */
  table?: readonly LumiChartTableRow[];
  style?: StyleProp<ViewStyle>;
}

export function LumiChartContainer({
  title,
  summary,
  subtitle,
  children,
  footer,
  table,
  style,
}: LumiChartContainerProps) {
  const { ui, colors } = useLumiTheme();
  return (
    <LumiCard style={style} accessibilityLabel={title}>
      <LumiText variant="h3">{title}</LumiText>
      {subtitle ? (
        <LumiText variant="caption" tone="muted">
          {subtitle}
        </LumiText>
      ) : null}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${title}. ${summary}`}
        style={{ minHeight: 160, paddingVertical: ui.space.lg, justifyContent: 'center' }}
      >
        {children}
      </View>
      <LumiText variant="caption" tone="muted">
        {summary}
      </LumiText>
      {table && table.length > 0 ? (
        <View
          accessibilityRole="summary"
          style={{
            marginTop: ui.space.md,
            gap: ui.space.xs,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: ui.space.sm,
          }}
        >
          <LumiText variant="label">Hodnoty</LumiText>
          {table.map((row) => (
            <View
              key={`${row.label}-${row.value}`}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
            >
              <LumiText tone="muted" style={{ flex: 1 }}>
                {row.label}
              </LumiText>
              <LumiText>{row.value}</LumiText>
            </View>
          ))}
        </View>
      ) : null}
      {footer ? <View style={{ marginTop: ui.space.sm }}>{footer}</View> : null}
    </LumiCard>
  );
}
