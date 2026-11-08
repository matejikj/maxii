import type { ApplicationServices } from '../application';
import { createCryptoIdGenerator } from '../infrastructure/ids/cryptoIdGenerator';
import { createInertFaultInjection } from '../infrastructure/testing/controlledFaults';
import { createSystemClock } from '../infrastructure/time/systemClock';
import { createLogger, type Logger } from '../infrastructure/telemetry/logger';

export type CompositionRoot = {
  services: ApplicationServices;
  logger: Logger;
};

/**
 * Wires platform adapters for the personal offline client. Family auth, sync
 * workers and remote diagnostics stay absent until explicitly configured later.
 */
export function createCompositionRoot(): CompositionRoot {
  return {
    services: {
      clock: createSystemClock(),
      ids: createCryptoIdGenerator(),
      faults: createInertFaultInjection(),
    },
    logger: createLogger(),
  };
}
