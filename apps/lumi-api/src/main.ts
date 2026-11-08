import { loadApiConfig } from './config/env.ts';
import { createFamilyApi } from './http/createServer.ts';

async function main(): Promise<void> {
  const config = loadApiConfig();
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
    }),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
