/**
 * Single-writer queue for the private database. Long reads should use separate
 * connections later; all durable writes share this lane so a diaper commit
 * cannot interleave with an unrelated migration mid-statement.
 */
export type WriteQueue = {
  run<T>(task: () => Promise<T>): Promise<T>;
};

export function createWriteQueue(): WriteQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const next = tail.then(task, task);
      // Keep the chain alive even when a task rejects so later writes still run.
      tail = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}
