import type { Clock, FaultInjection, IdGenerator } from '../domain';

/**
 * Shared application services injected at the composition root. Repositories
 * and unit-of-work arrive later with the persistence tasks; ports stay thin.
 */
export type ApplicationServices = {
  clock: Clock;
  ids: IdGenerator;
  faults: FaultInjection;
};
