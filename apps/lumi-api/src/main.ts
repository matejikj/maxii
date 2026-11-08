import { randomUUID } from 'node:crypto';
import { loadApiConfig } from './config/env.ts';
import { createAppDbPool } from './db/pool.ts';
import { createFamilyApi } from './http/createServer.ts';
import { createMemoryJobQueue, createPostgresJobQueue } from './ops/jobQueue.ts';
import { runWorkerLoop } from './ops/workerLoop.ts';

async function main(): Promise<void> {
  const config = loadApiConfig();

  if (config.role === 'worker') {
    const queue = config.databaseUrl
      ? createPostgresJobQueue(createAppDbPool(config.databaseUrl))
      : createMemoryJobQueue();
    const controller = new AbortController();
    const onStop = () => controller.abort();
    process.once('SIGINT', onStop);
    process.once('SIGTERM', onStop);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: 'lumi_worker_starting',
        workerId: config.workerId,
        databaseConfigured: config.databaseUrl != null,
      }),
    );
    const result = await runWorkerLoop({
      workerId: config.workerId || `worker-${randomUUID()}`,
      queue,
      leaseMs: config.workerLeaseMs,
      pollMs: config.workerPollMs,
      signal: controller.signal,
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: 'lumi_worker_stopped', ...result }));
    return;
  }

  const { app } = await createFamilyApi(config);
  await app.listen({ host: config.host, port: config.port });
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      event: 'lumi_api_listening',
      role: config.role,
      host: config.host,
      port: config.port,
      databaseConfigured: config.databaseUrl != null,
      // Explicit non-claim: transport TLS via Caddy is not end-to-end encryption of diary content.
      e2ee: false,
    }),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
