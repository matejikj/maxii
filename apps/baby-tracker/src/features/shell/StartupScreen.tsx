import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { StartupPresentation } from '../../application/startupState';

type StartupScreenProps = {
  presentation: StartupPresentation;
  errorMessage?: string | null;
  onRetry?: () => void;
};

export function StartupScreen({ presentation, errorMessage = null, onRetry }: StartupScreenProps) {
  const { colors } = useLumiTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <LumiText variant="caption" tone="accent">
          LUMI
        </LumiText>
        <LumiText variant="h1" accessibilityRole="header">
          {presentation.titleCs}
        </LumiText>
        <LumiText tone="muted">{presentation.bodyCs}</LumiText>
        {errorMessage ? (
          <LumiCard>
            <LumiText tone="muted">{errorMessage}</LumiText>
          </LumiCard>
        ) : null}
        {onRetry && !presentation.allowsCareEntry ? (
          <LumiButton title="Zkusit znovu" onPress={onRetry} fullWidth />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    padding: 24,
    gap: 16,
    justifyContent: 'center',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
});
