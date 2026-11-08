import Dexie, { type Table } from 'dexie';

/**
 * Web storage uses IndexedDB through Dexie with the same logical stores the
 * native SQLCipher adapter will expose via domain ports. This adapter is the
 * web half of the personal offline client; it does not claim hardware-backed
 * encryption equivalent to SQLCipher.
 */
export type WebCareEventRow = {
  eventId: string;
  childId: string;
  type: string;
  recordedAtIso: string;
  note: string | null;
};

export type WebMetaRow = {
  key: string;
  value: string;
};

export class LumiWebDatabase extends Dexie {
  careEvents!: Table<WebCareEventRow, string>;
  meta!: Table<WebMetaRow, string>;

  constructor(databaseName = 'lumi-web') {
    super(databaseName);
    this.version(1).stores({
      careEvents: 'eventId, childId, recordedAtIso, type',
      meta: 'key',
    });
  }
}

/**
 * Proves a durable IndexedDB write/read cycle and that a second connection sees
 * the committed row. Used during stack verification; product repositories come later.
 */
export async function runIndexedDbAdapterProbe(
  databaseName = `lumi-web-probe-${Date.now()}`,
): Promise<{ wrote: string; read: string }> {
  const first = new LumiWebDatabase(databaseName);
  const marker = `web-${Date.now()}`;
  try {
    await first.meta.put({ key: 'probe', value: marker });
  } finally {
    first.close();
  }

  const second = new LumiWebDatabase(databaseName);
  try {
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
