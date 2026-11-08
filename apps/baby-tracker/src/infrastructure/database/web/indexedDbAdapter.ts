import { LumiWebDatabase } from './lumiWebDatabase';

export { LumiWebDatabase } from './lumiWebDatabase';

/**
 * Proves a durable IndexedDB write/read cycle and that a second connection sees
 * the committed row. Used during stack verification alongside the diary adapter.
 */
export async function runIndexedDbAdapterProbe(
  databaseName = `lumi-web-probe-${Date.now()}`,
): Promise<{ wrote: string; read: string }> {
  const first = new LumiWebDatabase(databaseName);
  const marker = `web-${Date.now()}`;
  try {
    await first.open();
    await first.meta.put({ key: 'probe', value: marker });
  } finally {
    first.close();
  }

  const second = new LumiWebDatabase(databaseName);
  try {
    await second.open();
    const row = await second.meta.get('probe');
    if (row?.value !== marker) {
      throw new Error('IndexedDB probe did not persist the marker across connections.');
    }
    return { wrote: marker, read: row.value };
  } finally {
    second.close();
    await second.delete();
  }
}
