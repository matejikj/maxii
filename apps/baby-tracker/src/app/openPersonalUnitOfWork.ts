import { Platform } from 'react-native';
import type { UnitOfWorkFactory } from '../domain';
import { createCommandDispatcher, createReadModelInvalidator } from '../application';
import type { ApplicationServices } from '../application';
import { resolveRemoteServicesBoundary, shouldInitializeRemoteClients } from './remoteServicesBoundary';

export type OpenedPersonalRuntime = {
  unitOfWork: UnitOfWorkFactory;
  close: () => Promise<void>;
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

  if (Platform.OS === 'web') {
    const web = await import('../infrastructure/database/web');
    const handle = await web.openWebDatabase({
      now: services.clock.now(),
      faults: services.faults,
    });
    const unitOfWork = web.createWebUnitOfWorkFactory(handle, {
      faults: services.faults,
      nowMs: () => services.clock.now().epochMs,
    });
    return {
      unitOfWork,
      close: async () => handle.close(),
    };
  }

  const native = await import('../infrastructure/database/native');
  const database = await native.openPrivateDatabase({
    faults: services.faults,
    now: services.clock.now(),
  });
  const unitOfWork = native.createNativeUnitOfWorkFactory(database, {
    faults: services.faults,
    nowMs: () => services.clock.now().epochMs,
  });
  return {
    unitOfWork,
    close: () => database.close(),
  };
}

export function wirePersonalCommands(
  services: ApplicationServices,
  unitOfWork: UnitOfWorkFactory,
): ApplicationServices {
  const readModels = createReadModelInvalidator();
  const commands = createCommandDispatcher({
    unitOfWork,
    clock: services.clock,
    faults: services.faults,
    onCommitted: (topics) => readModels.notifyCommitted(topics),
  });
  return {
    ...services,
    unitOfWork,
    commands,
    readModels,
  };
}
