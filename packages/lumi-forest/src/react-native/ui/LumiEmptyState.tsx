import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LumiText } from './LumiText';
import { LumiButton } from './LumiButton';
export interface LumiEmptyStateProps {
  title: string;
  description: string;
  illustration?: React.ReactNode;
  actionTitle?: string;
  onAction?: () => void;
}
export function LumiEmptyState({
  title,
  description,
  illustration,
  actionTitle,
  onAction,
}: LumiEmptyStateProps) {
  return (
    <View style={styles.container}>
      {illustration}
      <LumiText variant="h3" style={styles.center}>
        {title}
      </LumiText>
      <LumiText tone="muted" style={styles.center}>
        {description}
      </LumiText>
      {actionTitle && onAction && <LumiButton title={actionTitle} onPress={onAction} />}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12, paddingVertical: 24, paddingHorizontal: 20 },
  center: { textAlign: 'center' },
});
