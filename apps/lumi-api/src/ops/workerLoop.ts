import type { JobQueue, WorkerJob } from './jobQueue.ts';

export type WorkerLoopOptions = {
  readonly workerId: string;
  readonly queue: JobQueue;
  readonly leaseMs?: number;
  readonly pollMs?: number;
  readonly handle?: (job: WorkerJob) => Promise<void>;
  readonly signal?: AbortSignal;
};

/**
 * Single-flight worker loop. Sessions/jobs stay in the shared queue — process
 * memory is never the only copy of work state.
 */
export async function runWorkerLoop(options: WorkerLoopOptions): Promise<{
  readonly processed: number;
  readonly stoppedReason: 'signal' | 'idle-drain';
}> {
  const leaseMs = options.leaseMs ?? 15_000;
  const pollMs = options.pollMs ?? 50;
  const handle =
    options.handle ??
    (async (job: WorkerJob) => {
      const known =
        job.kind === 'health.ping' ||
        job.kind === 'ops.noop' ||
        job.kind === 'backup.daily' ||
        job.kind === 'backup.retention.prune' ||
        job.kind === 'erasure.registry.sync';
      if (!known) {
        throw new Error(`unsupported_job:${job.kind}`);
      }
      // Default loop only acknowledges job kinds; production wires backup handlers.
    });

  let processed = 0;
  while (!options.signal?.aborted) {
    const job = await options.queue.claim(options.workerId, leaseMs);
    if (!job) {
      if (options.signal?.aborted) break;
      await sleep(pollMs, options.signal);
      // Optional idle exit for tests: if queue empty after wait, caller can abort.
      continue;
    }
    try {
      await handle(job);
      const ok = await options.queue.complete(job.jobId, options.workerId);
      if (!ok) throw new Error('lease_lost');
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await options.queue.fail(job.jobId, options.workerId, message);
    }
  }
  return {
    processed,
    stoppedReason: options.signal?.aborted ? 'signal' : 'idle-drain',
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
