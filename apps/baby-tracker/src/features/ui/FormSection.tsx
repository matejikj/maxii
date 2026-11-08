import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LumiSectionHeader, LumiText, useLumiTheme } from '@lumi/forest-design/native';

export type FormSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Groups related care fields without inventing a second card system. */
export function FormSection({ title, description, children, style }: FormSectionProps) {
  const { ui } = useLumiTheme();
  return (
    <View style={[styles.root, { gap: ui.space.md }, style]} accessibilityRole="summary">
      <LumiSectionHeader title={title} />
      {description ? (
        <LumiText tone="muted" variant="caption">
          {description}
        </LumiText>
      ) : null}
      <View style={{ gap: ui.space.md }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
});
