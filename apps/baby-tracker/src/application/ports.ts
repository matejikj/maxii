import type { Clock, FaultInjection, IdGenerator, OutboxPort, UnitOfWorkFactory } from '../domain';
import type { CommandDispatcher } from './commandDispatcher';
import type { ReadModelInvalidator } from './readModelInvalidation';

/**
 * Shared application services injected at the composition root.
 * UnitOfWork and the command dispatcher are wired once storage adapters exist;
 * personal mode still runs without network or login.
 */
export type ApplicationServices = {
  clock: Clock;
  ids: IdGenerator;
  faults: FaultInjection;
  unitOfWork?: UnitOfWorkFactory;
  commands?: CommandDispatcher;
  readModels?: ReadModelInvalidator;
  outbox?: OutboxPort;
};
