import type {
  Clock,
  FaultInjection,
  IdGenerator,
  UnitOfWorkFactory,
} from '../domain';

/**
 * Shared application services injected at the composition root.
 * UnitOfWork is optional until encrypted/web storage adapters land; personal
 * mode still runs with clock/ids alone.
 */
export type ApplicationServices = {
  clock: Clock;
  ids: IdGenerator;
  faults: FaultInjection;
  unitOfWork?: UnitOfWorkFactory;
};
