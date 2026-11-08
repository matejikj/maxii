import type { FaultInjection, FaultKind } from '../../domain';

export function createInertFaultInjection(): FaultInjection {
  return {
    shouldFail() {
      return false;
    },
  };
}

export function createControlledFaultInjection(active: ReadonlySet<FaultKind>): FaultInjection {
  return {
    shouldFail(kind) {
      return active.has(kind);
    },
  };
}
