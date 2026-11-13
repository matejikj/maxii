import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LumiText } from './LumiText';
import { LumiButton } from './LumiButton';
export interface LumiSectionHeaderProps {
  title: string;
  subtitle?: string;
  actionTitle?: string;
  onAction?: () => void;
}
export function LumiSectionHeader({
  title,
  subtitle,
  actionTitle,
  onAction,
}: LumiSectionHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        <LumiText variant="h2" accessibilityRole="header">
          {title}
        </LumiText>
        {subtitle && (
          <LumiText tone="muted" variant="caption">
            {subtitle}
          </LumiText>
        )}
      </View>
      {actionTitle && onAction ? (
        <LumiButton variant="ghost" size="compact" title={actionTitle} onPress={onAction} />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  copy: { flex: 1, gap: 4 },
});
