import { Platform } from 'react-native';
import { runEncryptedDatabaseProbe } from '../database/native/encryptedDatabase';
import { createSecureStoreDatabaseKeyStore } from '../database/native/databaseKeyStore';
import { runIndexedDbAdapterProbe } from '../database/web/indexedDbAdapter';
import { runStackCompatibilityChecks } from './stackCompatibility';
import { createDiscardableQueryClient, loadNavigationModules } from './navigationQuerySmoke';
import {
  DEFAULT_ARGON2ID_PARAMS,
  openPortableBackup,
  sealPortableBackup,
  serializePortableBackup,
  parsePortableBackup,
} from '../crypto/portableBackup';
import { utf8ToBytes } from '@noble/hashes/utils.js';

export type StorageProbeReport = {
  atIso: string;
  platform: string;
  stack: ReturnType<typeof runStackCompatibilityChecks>;
  navigationLoaded: boolean;
  queryClientCreated: boolean;
  portableBackup: {
    envelopeBytes: number;
    roundTripOk: boolean;
  };
  webIndexedDb?: { wrote: string; read: string };
  nativeCipher?: Awaited<ReturnType<typeof runEncryptedDatabaseProbe>>;
  limitations: string[];
};

/**
 * Runs the technical probes that can execute in the current runtime. Native
 * SQLCipher checks only run on iOS/Android development builds; web IndexedDB
 * runs in browsers. Results are structured for local evidence, not analytics.
 */
export async function runStorageProbe(): Promise<StorageProbeReport> {
  const limitations: string[] = [];
  const stack = runStackCompatibilityChecks();
  await loadNavigationModules();
  const queryClient = createDiscardableQueryClient();
  queryClient.clear();

  const password = 'probe-recovery-password';
  const sealed = sealPortableBackup(utf8ToBytes('{"probe":true}'), password, {
    ...DEFAULT_ARGON2ID_PARAMS,
    t: 1,
    m: 64,
  });
  const serialized = serializePortableBackup(sealed);
  const opened = openPortableBackup(parsePortableBackup(serialized), password);
  const roundTripOk = new TextDecoder().decode(opened) === '{"probe":true}';

  const report: StorageProbeReport = {
    atIso: new Date().toISOString(),
    platform: Platform.OS,
    stack,
    navigationLoaded: true,
    queryClientCreated: true,
    portableBackup: {
      envelopeBytes: serialized.length,
      roundTripOk,
    },
    limitations,
  };

  if (Platform.OS === 'web') {
    report.webIndexedDb = await runIndexedDbAdapterProbe();
    limitations.push(
      'Web IndexedDB probe does not provide SQLCipher-equivalent protection for the diary.',
    );
  } else if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      report.nativeCipher = await runEncryptedDatabaseProbe({
        keyStore: createSecureStoreDatabaseKeyStore(),
      });
    } catch (error) {
      limitations.push(
        `Native cipher probe failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  } else {
    limitations.push(`Unsupported platform for storage probe: ${Platform.OS}`);
  }

  return report;
}
