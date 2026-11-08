import React from 'react';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LumiCard, LumiCharacter, LumiEmptyState, LumiText, useLumiTheme,
} from '@lumi/forest-design/native';
import type { StorageProbeReport } from '../../infrastructure/verification/runStorageProbe';

type HomeScreenProps = {
  probeReport?: StorageProbeReport | null;
  probeError?: string | null;
};

/**
 * Temporary Today shell: brand, calm empty state, optional storage-probe
 * diagnostics. Product care actions replace the empty card in later work.
 */
export function HomeScreen({ probeReport = null, probeError = null }: HomeScreenProps) {
  const { colors, mode } = useLumiTheme();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <LumiText variant="caption" tone="accent">LUMI</LumiText>
          <LumiText variant="h1" accessibilityRole="header">Deník miminka</LumiText>
          <LumiText tone="muted">Malé chvíle, které tvoří váš den.</LumiText>
        </View>
        <LumiCard>
          <LumiEmptyState
            illustration={<LumiCharacter species="rabbit" expression="happy" />}
            title="Každý den spolu"
            description="Tady bude místo pro přehled krmení, spánku a péče o vaše miminko. Zatím tu nejsou žádné záznamy."
          />
        </LumiCard>
        {probeError ? (
          <LumiCard>
            <LumiText variant="h2">Ověření úložiště selhalo</LumiText>
            <LumiText tone="muted">{probeError}</LumiText>
          </LumiCard>
        ) : null}
        {probeReport ? (
          <LumiCard>
            <LumiText variant="h2">Ověření úložiště</LumiText>
            <LumiText tone="muted">
              {`Platforma ${probeReport.platform}. Přenosná záloha ${probeReport.portableBackup.roundTripOk ? 'v pořádku' : 'selhala'}.`}
            </LumiText>
            {probeReport.nativeCipher ? (
              <LumiText tone="muted">
                {`SQLCipher ${probeReport.nativeCipher.cipherVersion}; zápis a znovuotevření s klíčem ${probeReport.nativeCipher.reopenedWithKeySucceeded ? 'prokázány' : 'neprokázány'}.`}
              </LumiText>
            ) : null}
            {probeReport.webIndexedDb ? (
              <LumiText tone="muted">
                IndexedDB zápis přežil druhé spojení.
              </LumiText>
            ) : null}
          </LumiCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, padding: 24, gap: 24, width: '100%', maxWidth: 600, alignSelf: 'center' },
  heading: { gap: 8 },
});
