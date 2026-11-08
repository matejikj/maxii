import type { Clock } from '../../domain';

export function createSystemClock(): Clock {
  return {
    now() {
      return { epochMs: Date.now() };
    },
  };
}
