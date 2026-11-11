import React, { useCallback, useEffect, useState } from 'react';
import { StartupScreen } from '../features/shell/StartupScreen';
import {
  runStorageProbe,
  type StorageProbeReport,
} from '../infrastructure/verification/runStorageProbe';
import { loadPublicAppConfig } from './config';
import { RootNavigator } from './navigation/RootNavigator';
import { openPersonalUnitOfWork } from './openPersonalUnitOfWork';
import {
  personalModeBlocksOnMissingBackend,
  resolveRemoteServicesBoundary,
} from './remoteServicesBoundary';
import { AppLockGate } from '../features/shell/AppLockGate';
import { AppProviders, useCompositionRoot } from './providers';
import { BootstrapProvider, useBootstrap } from './session/BootstrapContext';
import { HistoryTabProvider } from './session/HistoryTabContext';
import { MotionPreferenceBridge } from './session/MotionPreferenceBridge';
import { PreferencesProvider } from './session/PreferencesContext';
import { ThemePreferenceBridge } from './session/ThemePreferenceBridge';
import { ContentPackProvider } from './session/ContentPackContext';
import { registerPublicServiceWorker } from './registerPublicServiceWorker';

const config = loadPublicAppConfig();
registerPublicServiceWorker();

function StorageProbeHost({ children }: { children: React.ReactNode }) {
  const { logger } = useCompositionRoot();
  const [probeReport, setProbeReport] = useState<StorageProbeReport | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  useEffect(() => {
    if (!config.storageProbeEnabled) return;
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
          console.log(
            'LUMI_STORAGE_PROBE_OK',
            JSON.stringify({
              platform: report.platform,
              cipherVersion: report.nativeCipher?.cipherVersion ?? null,
              reopenedWithKeySucceeded: report.nativeCipher?.reopenedWithKeySucceeded ?? null,
              portableBackupOk: report.portableBackup.roundTripOk,
              limitations: report.limitations,
            }),
          );
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

  void probeReport;
  void probeError;
  return <>{children}</>;
}

function PersonalAppShell() {
  const bootstrap = useBootstrap();
  const remote = resolveRemoteServicesBoundary();
  // Prove personal mode never treats missing backend as a blocking startup error.
  void personalModeBlocksOnMissingBackend(remote);

  if (
    bootstrap.phase === 'initializing' ||
    bootstrap.phase === 'migrating' ||
    bootstrap.phase === 'key_unavailable' ||
    bootstrap.phase === 'recovery_required' ||
    bootstrap.phase === 'database_error'
  ) {
    const canRetry =
      bootstrap.phase === 'key_unavailable' ||
      bootstrap.phase === 'recovery_required' ||
      bootstrap.phase === 'database_error';
    return (
      <StartupScreen
        presentation={bootstrap.presentation}
        errorMessage={bootstrap.errorMessage}
        {...(canRetry ? { onRetry: bootstrap.retry } : {})}
      />
    );
  }

  return <RootNavigator />;
}

function BootstrappedApp() {
  const { services } = useCompositionRoot();
  const openPersonalDiary = useCallback(async () => {
    const opened = await openPersonalUnitOfWork(services);
    return {
      unitOfWork: opened.unitOfWork,
      checkpoints: opened.checkpoints,
      reminders: opened.reminders,
      appLock: opened.appLock,
      databaseName: opened.databaseName,
      ...(opened.keyStore ? { keyStore: opened.keyStore } : {}),
      ...(opened.presence ? { presence: opened.presence } : {}),
      ...(opened.webDb ? { webDb: opened.webDb } : {}),
      childPrivateSyncStore: opened.childPrivateSyncStore,
      close: opened.close,
      deleteDurableStore: opened.deleteDurableStore,
    };
  }, [services]);

  return (
    <BootstrapProvider openPersonalDiary={openPersonalDiary}>
      <PreferencesProvider>
        <ThemePreferenceBridge>
          <ContentPackProvider>
            <MotionPreferenceBridge>
              <AppLockGate>
                <HistoryTabProvider>
                  <PersonalAppShell />
                </HistoryTabProvider>
              </AppLockGate>
            </MotionPreferenceBridge>
          </ContentPackProvider>
        </ThemePreferenceBridge>
      </PreferencesProvider>
    </BootstrapProvider>
  );
}

export function AppRoot() {
  return (
    <AppProviders>
      <StorageProbeHost>
        <BootstrappedApp />
      </StorageProbeHost>
    </AppProviders>
  );
}
