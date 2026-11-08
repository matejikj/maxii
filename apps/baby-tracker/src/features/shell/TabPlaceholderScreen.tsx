import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiCard, LumiEmptyState, LumiText, useLumiTheme } from '@lumi/forest-design/native';

type TabPlaceholderScreenProps = {
  title: string;
  description: string;
  headerRight?: React.ReactNode;
};

export function TabPlaceholderScreen({ title, description, headerRight }: TabPlaceholderScreenProps) {
  const { colors } = useLumiTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View style={styles.headingText}>
            <LumiText variant="caption" tone="accent">
              LUMI
            </LumiText>
            <LumiText variant="h1" accessibilityRole="header">
              {title}
            </LumiText>
          </View>
          {headerRight}
        </View>
        <LumiCard>
          <LumiEmptyState title={title} description={description} />
        </LumiCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 24,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  headingText: { flex: 1, gap: 8 },
});
