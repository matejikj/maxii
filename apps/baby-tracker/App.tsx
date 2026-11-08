import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LumiThemeProvider } from '@lumi/forest-design/native';
import { HomeScreen } from './src/screens/HomeScreen';
import {
  runStorageProbe,
  type StorageProbeReport,
} from './src/infrastructure/verification/runStorageProbe';

/**
 * Storage probe mode is for development builds that must prove SQLCipher,
 * SecureStore key survival across reopen, and the portable backup codec.
 * It is never a substitute for the product Today screen.
 */
const storageProbeEnabled = process.env.EXPO_PUBLIC_LUMI_STORAGE_PROBE === '1';

export default function App() {
  const [probeReport, setProbeReport] = useState<StorageProbeReport | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  useEffect(() => {
    if (!storageProbeEnabled) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const report = await runStorageProbe();
        if (!cancelled) {
          setProbeReport(report);
          // Structured one-line marker for device log capture without care payloads.
          console.log('LUMI_STORAGE_PROBE_OK', JSON.stringify({
            platform: report.platform,
            cipherVersion: report.nativeCipher?.cipherVersion ?? null,
            reopenedWithKeySucceeded: report.nativeCipher?.reopenedWithKeySucceeded ?? null,
            portableBackupOk: report.portableBackup.roundTripOk,
            limitations: report.limitations,
          }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!cancelled) {
          setProbeError(message);
          console.error('LUMI_STORAGE_PROBE_FAIL', message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaProvider>
      <LumiThemeProvider scene="home" mode="system">
        <HomeScreen probeReport={probeReport} probeError={probeError} />
      </LumiThemeProvider>
    </SafeAreaProvider>
  );
}
