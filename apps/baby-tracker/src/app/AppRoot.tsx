import React, { useEffect, useState } from 'react';
import { HomeScreen } from '../features/today';
import {
  runStorageProbe,
  type StorageProbeReport,
} from '../infrastructure/verification/runStorageProbe';
import { loadPublicAppConfig } from './config';
import { AppProviders, useCompositionRoot } from './providers';

const config = loadPublicAppConfig();

function StorageProbeHost({ children }: { children: (state: {
  probeReport: StorageProbeReport | null;
  probeError: string | null;
}) => React.ReactNode }) {
  const { logger } = useCompositionRoot();
  const [probeReport, setProbeReport] = useState<StorageProbeReport | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  useEffect(() => {
    if (!config.storageProbeEnabled) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const report = await runStorageProbe();
        if (!cancelled) {
          setProbeReport(report);
          logger.info('storage_probe_ok', {
            platform: report.platform,
            ok: report.portableBackup.roundTripOk,
          });
          // Compact device-log marker without care payloads for evidence capture.
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
          logger.error('storage_probe_fail', { ok: false });
          console.error('LUMI_STORAGE_PROBE_FAIL', message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logger]);

  return <>{children({ probeReport, probeError })}</>;
}

export function AppRoot() {
  return (
    <AppProviders>
      <StorageProbeHost>
        {({ probeReport, probeError }) => (
          <HomeScreen probeReport={probeReport} probeError={probeError} />
        )}
      </StorageProbeHost>
    </AppProviders>
  );
}
