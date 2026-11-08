import type { Clock, Instant } from '../../domain';

export function createFrozenClock(epochMs: number): Clock {
  const instant: Instant = { epochMs };
  return {
    now() {
      return instant;
    },
  };
}
