/**
 * Honest web storage limits. The UI must surface these instead of claiming
 * hardware-backed encryption or guaranteed persistence after browser data wipe.
 */
export const WEB_STORAGE_LIMITS = {
  encryptionClaim: false,
  encryptionDescription:
    'IndexedDB is origin-isolated browser storage. It is not equivalent to SQLCipher or a hardware keystore.',
  persistenceGuarantee: false,
  persistenceDescription:
    'Private/incognito mode, user clears, quota eviction and OS storage pressure can delete the diary. Requesting persistent storage is best-effort only.',
  backupIsSeparate: true,
  secretsInLocalStorage: false,
  secretsInUrl: false,
  databaseName: 'lumi-web-diary',
  /** Must stay distinct from the diary so SW cache refresh cannot wipe care data. */
  cacheDatabaseName: 'lumi-web-app-cache',
  lockDatabaseName: 'lumi-web-diary-locks',
  /** Logical recovery points live outside the live diary so replace-import cannot erase them. */
  checkpointDatabaseName: 'lumi-web-logical-checkpoints',
  supportedBrowsers: [
    'Safari (current macOS/iOS)',
    'Chrome (current desktop)',
    'Firefox (current desktop)',
  ],
} as const;

export type WebStorageCapabilityReport = {
  indexedDbAvailable: boolean;
  persistenceGranted: boolean | null;
  quotaBytes: number | null;
  usageBytes: number | null;
  privateModeSuspected: boolean;
  limits: typeof WEB_STORAGE_LIMITS;
};

export async function probeWebStorageCapabilities(
  options: {
    estimate?: () => Promise<{ quota?: number; usage?: number }>;
    persist?: () => Promise<boolean>;
    persisted?: () => Promise<boolean>;
    indexedDb?: IDBFactory | null;
  } = {},
): Promise<WebStorageCapabilityReport> {
  const indexedDb = options.indexedDb ?? (typeof indexedDB !== 'undefined' ? indexedDB : null);
  const indexedDbAvailable = indexedDb != null;

  let persistenceGranted: boolean | null = null;
  let privateModeSuspected = false;
  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;

  if (indexedDbAvailable) {
    try {
      const persisted =
        options.persisted ??
        (typeof navigator !== 'undefined' && navigator.storage?.persisted
          ? () => navigator.storage.persisted()
          : null);
      if (persisted) {
        persistenceGranted = await persisted();
      }
    } catch {
      privateModeSuspected = true;
      persistenceGranted = false;
    }

    try {
      const estimate =
        options.estimate ??
        (typeof navigator !== 'undefined' && navigator.storage?.estimate
          ? () => navigator.storage.estimate()
          : null);
      if (estimate) {
        const result = await estimate();
        quotaBytes = result.quota ?? null;
        usageBytes = result.usage ?? null;
      }
    } catch {
      privateModeSuspected = true;
    }
  } else {
    privateModeSuspected = true;
  }

  return {
    indexedDbAvailable,
    persistenceGranted,
    quotaBytes,
    usageBytes,
    privateModeSuspected,
    limits: WEB_STORAGE_LIMITS,
  };
}

/** Refuse to place diary secrets in URL or localStorage — those are not vaults. */
export function assertNoSensitiveWebSideChannel(
  target: 'localStorage' | 'sessionStorage' | 'url',
): void {
  throw new Error(
    `Refusing to store diary secrets in ${target}; use IndexedDB diary records or an explicit encrypted export instead.`,
  );
}
