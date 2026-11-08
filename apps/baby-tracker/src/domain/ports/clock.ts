/**
 * Domain and use cases receive time through this port so DST, freezes and
 * fault-injection tests never depend on the ambient wall clock.
 */
export type Instant = {
  /** UTC milliseconds since Unix epoch. */
  epochMs: number;
};

export type Clock = {
  now(): Instant;
};
