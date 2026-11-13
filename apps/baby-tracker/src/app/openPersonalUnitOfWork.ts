import { Platform } from 'react-native';
import type { UnitOfWorkFactory } from '../domain';
import type { ChildPrivateSyncStateStore } from '../domain/sync/childPrivateSyncStateStore';
import {
  createChildPrivateSyncStoreFromRuntime,
  createCommandDispatcher,
  createReadModelInvalidator,
  type ApplicationServices,
  type DispatchMetricsSink,
} from '../application';
import type { LogicalCheckpointVault } from '../infrastructure/database/logicalCheckpointVault';
import { openPlatformLogicalCheckpointVault } from '../infrastructure/database/durableLogicalCheckpointVault';
import { PRIVATE_DATABASE_NAME } from '../infrastructure/database/native/databaseNames';
import type { DatabaseKeyStore } from '../infrastructure/database/native/databaseKeyStoreTypes';
import type { DatabasePresence } from '../infrastructure/database/native/databasePresence';
import type { SqlDatabaseOpener } from '../infrastructure/database/native/sqlConnection';
import { WEB_DIARY_DATABASE_NAME } from '../infrastructure/database/web/lumiWebDatabase';
import { WEB_STORAGE_LIMITS } from '../infrastructure/database/web/webLimits';
import {
  createPlatformReminderSchedulerAsync,
  type ReminderScheduler,
} from '../infrastructure/notifications/reminderScheduler';
import {
  openPlatformAppLockStore,
  type AppLockStore,
} from '../infrastructure/security/appLockStore';
import {
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from './remoteServicesBoundary';

export type OpenedPersonalRuntime = {
  unitOfWork: UnitOfWorkFactory;
  /** Local recovery points kept outside the live diary so replace import can roll back. */
  checkpoints: LogicalCheckpointVault;
  reminders: ReminderScheduler;
  appLock: AppLockStore;
  databaseName: string;
  keyStore?: DatabaseKeyStore;
  presence?: DatabasePresence;
  close: () => Promise<void>;
  deleteDurableStore: () => Promise<void>;
  /** Web diary handle for durable photo metadata; absent on native. */
  webDb?: import('../infrastructure/database/web/lumiWebDatabase').LumiWebDatabase;
  /**
   * Durable local child-private outbox/inbox snapshot for this diary.
   * Enqueue stays local without a sync backend; network ticks stay cold.
   */
  childPrivateSyncStore: ChildPrivateSyncStateStore;
};

/**
 * Opens the personal diary adapters only. Auth/sync clients stay cold unless the
 * family remote boundary is explicitly configured.
 */
export async function openPersonalUnitOfWork(
  services: ApplicationServices,
): Promise<OpenedPersonalRuntime> {
  const remote = resolveRemoteServicesBoundary();
  if (shouldInitializeRemoteClients(remote)) {
    throw new Error('Remote family clients are configured but not wired in personal mode yet.');
  }

  const checkpoints = await openPlatformLogicalCheckpointVault();
  const reminders = await createPlatformReminderSchedulerAsync();
  const appLock = await openPlatformAppLockStore();

  if (Platform.OS === 'web') {
    const web = await import('../infrastructure/database/web');
    const databaseName = WEB_DIARY_DATABASE_NAME;
    const handle = await web.openWebDatabase({
      now: services.clock.now(),
      faults: services.faults,
      databaseName,
    });
    const unitOfWork = web.createWebUnitOfWorkFactory(handle, {
      faults: services.faults,
      nowMs: () => services.clock.now().epochMs,
    });
    const childPrivateSyncStore = createChildPrivateSyncStoreFromRuntime({
      webDb: handle.db,
    });
    return {
      unitOfWork,
      checkpoints,
      reminders,
      appLock,
      databaseName,
      close: async () => handle.close(),
      deleteDurableStore: async () => {
        const Dexie = (await import('dexie')).default;
        await Dexie.delete(databaseName);
        await Dexie.delete(WEB_STORAGE_LIMITS.checkpointDatabaseName);
        const { clearPersonalAttachmentStorage } =
          await import('../infrastructure/attachments/clearAttachmentStorage');
        await clearPersonalAttachmentStorage();
      },
      webDb: handle.db,
      childPrivateSyncStore,
    };
  }

  const native = await import('../infrastructure/database/native');
  const databaseName = PRIVATE_DATABASE_NAME;
  const keyStoreMod = await native.loadSecureStoreDatabaseKeyStore();
  const keyStore = keyStoreMod.createSecureStoreDatabaseKeyStore();
  const presence = await (
    await native.loadSecureStoreDatabasePresence()
  ).createSecureStoreDatabasePresence();
  const openerMod = await native.loadExpoSqlOpener();
  const opener: SqlDatabaseOpener = openerMod.createExpoSqlOpener();

  const database = await native.openPrivateDatabase({
    databaseName,
    keyStore,
    presence,
    opener,
    faults: services.faults,
    now: services.clock.now(),
  });
  const unitOfWork = native.createNativeUnitOfWorkFactory(database, {
    faults: services.faults,
    nowMs: () => services.clock.now().epochMs,
  });
  const childPrivateSyncStore = createChildPrivateSyncStoreFromRuntime({
    nativeConnection: database.connection,
  });
  return {
    unitOfWork,
    checkpoints,
    reminders,
    appLock,
    databaseName,
    keyStore,
    presence,
    close: () => database.close(),
    deleteDurableStore: async () => {
      await opener.delete(databaseName);
      const { clearPersonalAttachmentStorage } =
        await import('../infrastructure/attachments/clearAttachmentStorage');
      await clearPersonalAttachmentStorage();
    },
    childPrivateSyncStore,
  };
}

export function wirePersonalCommands(
  services: ApplicationServices,
  unitOfWork: UnitOfWorkFactory,
  options: {
    metrics?: DispatchMetricsSink;
    metricsPlatform?: string;
  } = {},
): ApplicationServices {
  const readModels = createReadModelInvalidator();
  const commands = createCommandDispatcher({
    unitOfWork,
    clock: services.clock,
    faults: services.faults,
    onCommitted: (topics) => readModels.notifyCommitted(topics),
    ...(options.metrics ? { metrics: options.metrics } : {}),
    ...(options.metricsPlatform ? { metricsPlatform: options.metricsPlatform } : {}),
  });
  return {
    ...services,
    unitOfWork,
    commands,
    readModels,
  };
}
