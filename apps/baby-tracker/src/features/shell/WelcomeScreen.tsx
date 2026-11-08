import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { GuideCompanion } from './GuideCompanion';

type WelcomeScreenProps = {
  childName: string;
  onContinue: () => void;
  onSkip: () => void;
  onOpenProfile: () => void;
};

/**
 * Skippable welcome. Account, permissions, mascot, and birthday are never gates.
 */
export function WelcomeScreen({
  childName,
  onContinue,
  onSkip,
  onOpenProfile,
}: WelcomeScreenProps) {
  const { colors } = useLumiTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <GuideCompanion
          species="rabbit"
          semantic="greeting"
          signatureAction="earPerk"
          testID="welcome-guide"
        />
        <LumiText variant="caption" tone="accent">
          LUMI
        </LumiText>
        <LumiText variant="h1" accessibilityRole="header">
          Vítejte u {childName}
        </LumiText>
        <LumiText tone="muted">
          Můžete hned zapisovat péči. Profil, narozeniny i účet doplníte později — nic z toho teď
          neblokuje deník.
        </LumiText>
        <LumiButton
          title="Pokračovat na Dnes"
          onPress={onContinue}
          fullWidth
          testID="welcome-continue"
        />
        <LumiButton
          title="Přeskočit úvod"
          variant="ghost"
          onPress={onSkip}
          fullWidth
          testID="welcome-skip"
        />
        <LumiButton
          title="Nastavit profil (volitelné)"
          variant="outline"
          onPress={onOpenProfile}
          fullWidth
        />
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
