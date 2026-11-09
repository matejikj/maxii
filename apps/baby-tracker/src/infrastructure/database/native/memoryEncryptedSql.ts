import { EncryptedDatabaseError } from './cipherGuard';
import type { SqlBindValue, SqlConnection, SqlDatabaseOpener } from './sqlConnection';

type Row = Record<string, SqlBindValue>;

type Table = {
  rows: Row[];
  autoIncrement: number;
};

type DatabaseState = {
  keyHex: string | null;
  unlocked: boolean;
  tables: Map<string, Table>;
};

/**
 * Contract-test double for SQLCipher behaviour: without the correct key the
 * store stays opaque, exclusive transactions roll back, and serialize captures
 * a durable snapshot. Not a cryptographic cipher — production uses expo-sqlite.
 */
export function createMemoryEncryptedSqlOpener(options: {
  cipherVersion?: string;
  /** When false, assertSqlCipherAvailable-style probes fail. */
  cipherAvailable?: boolean;
} = {}): SqlDatabaseOpener & {
  cipherVersion: string;
  cipherAvailable: boolean;
  getRawState(name: string): DatabaseState | undefined;
} {
  const files = new Map<string, DatabaseState>();
  const cipherVersion = options.cipherVersion ?? '4.17.0-memory-test';
  const cipherAvailable = options.cipherAvailable ?? true;

  return {
    cipherVersion,
    cipherAvailable,
    getRawState(name) {
      return files.get(name);
    },
    async exists(name) {
      return files.has(name);
    },
    async delete(name) {
      files.delete(name);
    },
    async open(name) {
      let state = files.get(name);
      if (state == null) {
        state = { keyHex: null, unlocked: false, tables: new Map() };
        files.set(name, state);
      }
      // Each connection must re-apply PRAGMA key, matching SQLCipher behaviour.
      state.unlocked = false;
      return createConnection(state, {
        cipherVersion,
        cipherAvailable,
        persistSnapshot: (snapshot) => {
          // Mutate the canonical file entry in place so close/reopen share state.
          state.keyHex = snapshot.keyHex;
          state.unlocked = snapshot.unlocked;
          state.tables = snapshot.tables;
          files.set(name, state);
        },
      });
    },
  };
}

function createConnection(
  state: DatabaseState,
  meta: {
    cipherVersion: string;
    cipherAvailable: boolean;
    persistSnapshot: (state: DatabaseState) => void;
  },
): SqlConnection {
  let transactionBackup: ReturnType<typeof cloneState> | null = null;

  const api: SqlConnection = {
    async execAsync(source) {
      assertUnlocked(state);
      for (const statement of splitStatements(source)) {
        await execute(state, statement, []);
      }
      meta.persistSnapshot(state);
    },
    async runAsync(source, ...params) {
      assertUnlocked(state);
      const changes = await execute(state, source, params);
      meta.persistSnapshot(state);
      return { changes };
    },
    async getFirstAsync<T>(source: string, ...params: SqlBindValue[]) {
      assertUnlocked(state);
      const rows = await query(state, source, params);
      return (rows[0] as T | undefined) ?? null;
    },
    async getAllAsync<T>(source: string, ...params: SqlBindValue[]) {
      assertUnlocked(state);
      return (await query(state, source, params)) as T[];
    },
    async withExclusiveTransactionAsync(task) {
      assertUnlocked(state);
      const before = cloneState(state);
      try {
        await task(api);
        meta.persistSnapshot(state);
      } catch (error) {
        restoreState(state, before);
        meta.persistSnapshot(state);
        throw error;
      }
    },
    async serializeAsync() {
      assertUnlocked(state);
      return new TextEncoder().encode(JSON.stringify(serializeState(state)));
    },
    async closeAsync() {
      state.unlocked = false;
    },
  };

  // PRAGMA handlers piggy-back through exec/run before unlock checks for keying.
  const originalExec = api.execAsync.bind(api);
  api.execAsync = async (source) => {
    if (await handlePragma(state, source, meta)) return;
    const txn = source.trim().toUpperCase();
    if (
      txn === 'BEGIN' ||
      txn === 'BEGIN IMMEDIATE' ||
      txn === 'BEGIN DEFERRED' ||
      txn === 'BEGIN EXCLUSIVE' ||
      txn === 'BEGIN TRANSACTION'
    ) {
      assertUnlocked(state);
      if (transactionBackup == null) {
        transactionBackup = cloneState(state);
      }
      return;
    }
    if (txn === 'COMMIT' || txn === 'END' || txn === 'END TRANSACTION') {
      assertUnlocked(state);
      transactionBackup = null;
      meta.persistSnapshot(state);
      return;
    }
    if (txn === 'ROLLBACK' || txn === 'ROLLBACK TRANSACTION') {
      assertUnlocked(state);
      if (transactionBackup != null) {
        restoreState(state, transactionBackup);
        transactionBackup = null;
      }
      meta.persistSnapshot(state);
      return;
    }
    return originalExec(source);
  };
  const originalRun = api.runAsync.bind(api);
  api.runAsync = async (source, ...params) => {
    if (await handlePragma(state, source, meta)) return { changes: 0 };
    return originalRun(source, ...params);
  };
  const originalFirst = api.getFirstAsync.bind(api);
  api.getFirstAsync = async <T>(source: string, ...params: SqlBindValue[]) => {
    const pragma = await handlePragmaSelect<T>(state, source, meta);
    if (pragma !== undefined) return pragma;
    return originalFirst<T>(source, ...params);
  };

  return api;
}

async function handlePragma(
  state: DatabaseState,
  source: string,
  meta: { cipherAvailable: boolean },
): Promise<boolean> {
  const trimmed = source.trim();
  const keyMatch = /^PRAGMA key = '([0-9a-fA-F]+)'$/i.exec(trimmed);
  if (keyMatch) {
    const keyHex = keyMatch[1]!.toLowerCase();
    if (!meta.cipherAvailable) {
      throw new EncryptedDatabaseError(
        'CIPHER_UNAVAILABLE',
        'SQLCipher is not present in this binary.',
      );
    }
    if (state.keyHex == null) {
      state.keyHex = keyHex;
      state.unlocked = true;
      return true;
    }
    if (state.keyHex !== keyHex) {
      state.unlocked = false;
      throw new EncryptedDatabaseError('OPEN_FAILED', 'Encrypted database rejected the key.');
    }
    state.unlocked = true;
    return true;
  }
  if (/^PRAGMA foreign_keys = ON$/i.test(trimmed) || /^PRAGMA journal_mode/i.test(trimmed)) {
    return true;
  }
  return false;
}

async function handlePragmaSelect<T>(
  state: DatabaseState,
  source: string,
  meta: { cipherVersion: string; cipherAvailable: boolean },
): Promise<T | null | undefined> {
  if (/^PRAGMA cipher_version$/i.test(source.trim())) {
    if (!meta.cipherAvailable) return null;
    return { cipher_version: meta.cipherVersion } as T;
  }
  if (/^PRAGMA key/i.test(source.trim())) {
    return undefined;
  }
  void state;
  return undefined;
}

function assertUnlocked(state: DatabaseState): void {
  if (!state.unlocked) {
    throw new EncryptedDatabaseError(
      'OPEN_FAILED',
      'Database is locked; ciphertext is unreadable without the correct key.',
    );
  }
}

function normalizeSql(source: string): string {
  return source.replace(/\s+/g, ' ').trim();
}

async function execute(state: DatabaseState, source: string, params: SqlBindValue[]): Promise<number> {
  const sql = normalizeSql(source);
  if (/^CREATE TABLE IF NOT EXISTS schema_migrations\b/i.test(sql)) {
    ensureTable(state, 'schema_migrations');
    return 0;
  }
  if (/^CREATE TABLE\b/i.test(sql) || /^CREATE UNIQUE INDEX\b/i.test(sql) || /^CREATE INDEX\b/i.test(sql)) {
    const table = tableNameFromCreate(sql);
    if (table) ensureTable(state, table);
    return 0;
  }
  // Column additions are no-ops for the in-memory double; rows gain fields on insert.
  if (/^ALTER TABLE\b/i.test(sql) || /^CREATE INDEX IF NOT EXISTS\b/i.test(sql)) {
    return 0;
  }
  if (/^INSERT INTO\b/i.test(sql)) {
    return insertRow(state, sql, params);
  }
  if (/^DELETE FROM\b/i.test(sql)) {
    return deleteRows(state, sql, params);
  }
  if (/^UPDATE\b/i.test(sql)) {
    return updateRows(state, sql, params);
  }
  return 0;
}

async function query(state: DatabaseState, source: string, params: SqlBindValue[]): Promise<Row[]> {
  const sql = normalizeSql(source);
  if (/^SELECT COALESCE\(MAX\(version\), 0\) AS version FROM schema_migrations$/i.test(sql)) {
    const table = ensureTable(state, 'schema_migrations');
    const max = table.rows.reduce((acc, row) => Math.max(acc, Number(row.version ?? 0)), 0);
    return [{ version: max }];
  }
  if (/^SELECT version, checksum FROM schema_migrations ORDER BY version$/i.test(sql)) {
    return [...ensureTable(state, 'schema_migrations').rows].sort(
      (a, b) => Number(a.version) - Number(b.version),
    );
  }
  const byId = /^SELECT (.+) FROM (\w+) WHERE (\w+) = \?$/i.exec(sql);
  if (byId) {
    const table = ensureTable(state, byId[2]!);
    const column = byId[3]!;
    return table.rows.filter((row) => row[column] === params[0]);
  }
  const activeSession =
    /^SELECT (.+) FROM sessions WHERE child_id = \? AND kind = \? AND status IN \('running', 'paused'\)/i.exec(
      sql,
    );
  if (activeSession) {
    const table = ensureTable(state, 'sessions');
    return table.rows.filter(
      (row) =>
        row.child_id === params[0] &&
        row.kind === params[1] &&
        (row.status === 'running' || row.status === 'paused'),
    );
  }
  if (/FROM change_notifications/i.test(sql)) {
    return [...ensureTable(state, 'change_notifications').rows];
  }
  const careById =
    /^SELECT .+ FROM care_events WHERE event_id = \?$/i.exec(sql);
  if (careById) {
    return ensureTable(state, 'care_events').rows.filter((row) => row.event_id === params[0]);
  }
  const careRecent =
    /^SELECT .+ FROM care_events WHERE child_id = \? ORDER BY sort_at_ms DESC(?:, event_id DESC)? LIMIT \?$/i.exec(
      sql,
    );
  if (careRecent) {
    const limit = Number(params[1] ?? 0);
    return sortCareDesc(
      ensureTable(state, 'care_events').rows.filter((row) => row.child_id === params[0]),
    ).slice(0, Number.isFinite(limit) ? limit : 0);
  }
  const carePage =
    /^SELECT .+ FROM care_events WHERE child_id = \? AND \( sort_at_ms < \? OR \(sort_at_ms = \? AND event_id < \?\) \) ORDER BY sort_at_ms DESC, event_id DESC LIMIT \?$/i.exec(
      sql,
    );
  if (carePage) {
    const beforeSort = Number(params[1]);
    const beforeId = String(params[3]);
    const limit = Number(params[4] ?? 0);
    return sortCareDesc(
      ensureTable(state, 'care_events').rows.filter((row) => {
        if (row.child_id !== params[0]) return false;
        const sortAt = Number(row.sort_at_ms);
        if (sortAt < beforeSort) return true;
        if (sortAt > beforeSort) return false;
        return String(row.event_id) < beforeId;
      }),
    ).slice(0, Number.isFinite(limit) ? limit : 0);
  }
  const careRange =
    /^SELECT .+ FROM care_events WHERE child_id = \? AND sort_at_ms >= \? AND sort_at_ms < \? ORDER BY sort_at_ms DESC(?:, event_id DESC)?$/i.exec(
      sql,
    );
  if (careRange) {
    const fromMs = Number(params[1]);
    const toMs = Number(params[2]);
    return sortCareDesc(
      ensureTable(state, 'care_events').rows.filter(
        (row) =>
          row.child_id === params[0] &&
          Number(row.sort_at_ms) >= fromMs &&
          Number(row.sort_at_ms) < toMs,
      ),
    );
  }
  const careByChild =
    /^SELECT .+ FROM care_events WHERE child_id = \?$/i.exec(sql);
  if (careByChild) {
    return ensureTable(state, 'care_events').rows.filter((row) => row.child_id === params[0]);
  }
  if (/FROM care_events c INNER JOIN search_documents s/i.test(sql)) {
    const needle = unwrapLike(String(params[1] ?? ''));
    const hasCursor = params.length >= 6;
    const beforeSort = hasCursor ? Number(params[2]) : null;
    const beforeId = hasCursor ? String(params[4]) : null;
    const limit = Number(params[hasCursor ? 5 : 2] ?? 0);
    const docs = ensureTable(state, 'search_documents').rows.filter((row) => {
      if (row.child_id !== params[0]) return false;
      if (!String(row.text_normalized ?? '').includes(needle)) return false;
      if (beforeSort == null || beforeId == null) return true;
      const sortAt = Number(row.sort_at_ms);
      if (sortAt < beforeSort) return true;
      if (sortAt > beforeSort) return false;
      return String(row.entity_id) < beforeId;
    });
    const care = ensureTable(state, 'care_events');
    const events = docs
      .map((doc) => care.rows.find((row) => row.event_id === doc.entity_id))
      .filter((row): row is Row => row != null);
    return sortCareDesc(events).slice(0, Number.isFinite(limit) ? limit : 0);
  }
  const draftsByChild =
    /^SELECT payload_json FROM drafts WHERE child_id = \? ORDER BY updated_at_ms DESC(?:, draft_id DESC)?$/i.exec(
      sql,
    );
  if (draftsByChild) {
    return ensureTable(state, 'drafts')
      .rows.filter((row) => row.child_id === params[0])
      .slice()
      .sort((a, b) => {
        const updated = Number(b.updated_at_ms) - Number(a.updated_at_ms);
        if (updated !== 0) return updated;
        return String(b.draft_id) < String(a.draft_id) ? -1 : 1;
      });
  }
  if (/FROM search_documents/i.test(sql)) {
    return [...ensureTable(state, 'search_documents').rows];
  }
  if (/FROM care_events/i.test(sql)) {
    return [...ensureTable(state, 'care_events').rows];
  }
  if (/^SELECT \* FROM deletion_markers$/i.test(sql)) {
    return [...ensureTable(state, 'deletion_markers').rows];
  }
  if (/FROM deletion_markers/i.test(sql)) {
    return [...ensureTable(state, 'deletion_markers').rows];
  }
  if (/FROM revisions/i.test(sql)) {
    return [...ensureTable(state, 'revisions').rows];
  }
  if (/FROM operation_receipts/i.test(sql)) {
    return [...ensureTable(state, 'operation_receipts').rows];
  }
  if (/FROM sessions/i.test(sql)) {
    return [...ensureTable(state, 'sessions').rows];
  }
  if (/FROM drafts/i.test(sql)) {
    return [...ensureTable(state, 'drafts').rows];
  }
  if (/^SELECT payload_json FROM child_profiles$/i.test(sql) || /^SELECT \* FROM child_profiles$/i.test(sql)) {
    return [...ensureTable(state, 'child_profiles').rows];
  }
  if (/FROM child_profiles/i.test(sql)) {
    return [...ensureTable(state, 'child_profiles').rows];
  }
  if (/FROM app_meta/i.test(sql)) {
    return [...ensureTable(state, 'app_meta').rows];
  }
  const photoByEvent =
    /^SELECT .+ FROM photo_attachments WHERE event_id = \? ORDER BY order_index ASC(?:, attachment_id ASC)?$/i.exec(
      sql,
    );
  if (photoByEvent) {
    return ensureTable(state, 'photo_attachments')
      .rows.filter((row) => row.event_id === params[0])
      .slice()
      .sort((a, b) => {
        const order = Number(a.order_index) - Number(b.order_index);
        if (order !== 0) return order;
        return String(a.attachment_id).localeCompare(String(b.attachment_id));
      });
  }
  if (/FROM photo_attachments/i.test(sql)) {
    return [...ensureTable(state, 'photo_attachments').rows];
  }
  if (/FROM photo_attachment_jobs WHERE event_id = \?/i.test(sql)) {
    return ensureTable(state, 'photo_attachment_jobs').rows.filter(
      (row) => row.event_id === params[0],
    );
  }
  if (/FROM photo_attachment_jobs/i.test(sql)) {
    return [...ensureTable(state, 'photo_attachment_jobs').rows];
  }
  const projectsByChild =
    /^SELECT .+ FROM projects WHERE child_id = \? ORDER BY updated_at_ms DESC(?:, project_id DESC)?$/i.exec(
      sql,
    );
  if (projectsByChild) {
    return ensureTable(state, 'projects')
      .rows.filter((row) => row.child_id === params[0])
      .slice()
      .sort((a, b) => {
        const updated = Number(b.updated_at_ms) - Number(a.updated_at_ms);
        if (updated !== 0) return updated;
        return String(b.project_id).localeCompare(String(a.project_id));
      });
  }
  if (/^SELECT project_id FROM projects WHERE child_id = \?$/i.test(sql)) {
    return ensureTable(state, 'projects').rows.filter((row) => row.child_id === params[0]);
  }
  if (/FROM projects/i.test(sql)) {
    return [...ensureTable(state, 'projects').rows]
      .slice()
      .sort((a, b) => {
        const updated = Number(b.updated_at_ms) - Number(a.updated_at_ms);
        if (updated !== 0) return updated;
        return String(b.project_id).localeCompare(String(a.project_id));
      });
  }
  const portfolioByChild =
    /^SELECT .+ FROM portfolio_items WHERE child_id = \? ORDER BY created_at_ms DESC(?:, portfolio_item_id DESC)?$/i.exec(
      sql,
    );
  if (portfolioByChild) {
    return ensureTable(state, 'portfolio_items')
      .rows.filter((row) => row.child_id === params[0])
      .slice()
      .sort((a, b) => Number(b.created_at_ms) - Number(a.created_at_ms));
  }
  const portfolioByProject =
    /^SELECT .+ FROM portfolio_items WHERE project_id = \? ORDER BY created_at_ms DESC(?:, portfolio_item_id DESC)?$/i.exec(
      sql,
    );
  if (portfolioByProject) {
    return ensureTable(state, 'portfolio_items')
      .rows.filter((row) => row.project_id === params[0])
      .slice()
      .sort((a, b) => Number(b.created_at_ms) - Number(a.created_at_ms));
  }
  if (/^SELECT portfolio_item_id FROM portfolio_items WHERE child_id = \?$/i.test(sql)) {
    return ensureTable(state, 'portfolio_items').rows.filter((row) => row.child_id === params[0]);
  }
  if (/FROM portfolio_items/i.test(sql)) {
    return [...ensureTable(state, 'portfolio_items').rows];
  }
  const sharesByOwner =
    /^SELECT .+ FROM share_snapshots WHERE owner_app_user_id = \? ORDER BY created_at_ms DESC(?:, share_id DESC)?$/i.exec(
      sql,
    );
  if (sharesByOwner) {
    return ensureTable(state, 'share_snapshots')
      .rows.filter((row) => row.owner_app_user_id === params[0])
      .slice()
      .sort((a, b) => Number(b.created_at_ms) - Number(a.created_at_ms));
  }
  const sharesBySource =
    /^SELECT .+ FROM share_snapshots WHERE source_project_id = \? ORDER BY created_at_ms DESC(?:, share_id DESC)?$/i.exec(
      sql,
    );
  if (sharesBySource) {
    return ensureTable(state, 'share_snapshots')
      .rows.filter((row) => row.source_project_id === params[0])
      .slice()
      .sort((a, b) => Number(b.created_at_ms) - Number(a.created_at_ms));
  }
  if (/FROM share_snapshots/i.test(sql)) {
    return [...ensureTable(state, 'share_snapshots').rows];
  }
  return [];
}

function insertRow(state: DatabaseState, sql: string, params: SqlBindValue[]): number {
  const match = /^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)$/i.exec(sql);
  if (!match) {
    throw new Error(`Unsupported INSERT in memory SQL: ${sql}`);
  }
  const tableName = match[1]!;
  const columns = match[2]!.split(',').map((part) => part.trim());
  const table = ensureTable(state, tableName);
  const row: Row = {};
  let paramIndex = 0;
  for (const column of columns) {
    if (column === 'seq' && /AUTOINCREMENT/i.test(String(table))) {
      table.autoIncrement += 1;
      row.seq = table.autoIncrement;
      continue;
    }
    row[column] = params[paramIndex++] ?? null;
  }
  if (tableName === 'change_notifications' && row.seq == null) {
    table.autoIncrement += 1;
    row.seq = table.autoIncrement;
  }
  if (tableName === 'care_events' || tableName === 'sessions' || tableName === 'drafts') {
    const profiles = ensureTable(state, 'child_profiles');
    if (!profiles.rows.some((profile) => profile.child_id === row.child_id)) {
      throw new Error('FOREIGN KEY constraint failed');
    }
  }
  // Unique active session index simulation.
  if (tableName === 'sessions' && (row.status === 'running' || row.status === 'paused')) {
    const clash = table.rows.find(
      (existing) =>
        existing.child_id === row.child_id &&
        existing.kind === row.kind &&
        (existing.status === 'running' || existing.status === 'paused') &&
        existing.session_id !== row.session_id,
    );
    if (clash) {
      throw new Error('UNIQUE constraint failed: sessions_one_local_active');
    }
  }
  const existingIndex = table.rows.findIndex((existing) => primaryKeyMatch(tableName, existing, row));
  if (existingIndex >= 0) {
    table.rows[existingIndex] = row;
  } else {
    table.rows.push(row);
  }
  return 1;
}

function deleteRows(state: DatabaseState, sql: string, params: SqlBindValue[]): number {
  const clearAll = /^DELETE FROM (\w+)$/i.exec(sql.trim());
  if (clearAll) {
    const table = ensureTable(state, clearAll[1]!);
    const before = table.rows.length;
    table.rows = [];
    return before;
  }
  const match = /^DELETE FROM (\w+) WHERE (\w+) = \?$/i.exec(sql.trim());
  if (!match) throw new Error(`Unsupported DELETE in memory SQL: ${sql}`);
  const table = ensureTable(state, match[1]!);
  const before = table.rows.length;
  table.rows = table.rows.filter((row) => row[match[2]!] !== params[0]);
  return before - table.rows.length;
}

function sortCareDesc(rows: Row[]): Row[] {
  return rows.slice().sort((a, b) => {
    const sortDelta = Number(b.sort_at_ms) - Number(a.sort_at_ms);
    if (sortDelta !== 0) return sortDelta;
    return String(b.event_id) < String(a.event_id) ? -1 : String(b.event_id) > String(a.event_id) ? 1 : 0;
  });
}

function unwrapLike(pattern: string): string {
  return pattern.replace(/^%/, '').replace(/%$/, '').replace(/\\([%_\\])/g, '$1');
}

function updateRows(state: DatabaseState, sql: string, params: SqlBindValue[]): number {
  void state;
  void sql;
  void params;
  throw new Error('UPDATE is not used by the private diary repositories yet');
}

function primaryKeyMatch(tableName: string, existing: Row, next: Row): boolean {
  const key =
    tableName === 'child_profiles'
      ? 'child_id'
      : tableName === 'care_events'
        ? 'event_id'
        : tableName === 'sessions'
          ? 'session_id'
          : tableName === 'drafts'
            ? 'draft_id'
            : tableName === 'revisions'
              ? 'revision_id'
              : tableName === 'operation_receipts'
                ? 'operation_id'
                : tableName === 'deletion_markers'
                  ? 'deletion_id'
                  : tableName === 'app_meta'
                    ? 'key'
                    : tableName === 'schema_migrations'
                      ? 'version'
                      : tableName === 'photo_attachments'
                        ? 'attachment_id'
                        : tableName === 'photo_attachment_jobs'
                          ? 'job_id'
                          : null;
  if (key == null) return false;
  return existing[key] === next[key];
}

function ensureTable(state: DatabaseState, name: string): Table {
  let table = state.tables.get(name);
  if (table == null) {
    table = { rows: [], autoIncrement: 0 };
    state.tables.set(name, table);
  }
  return table;
}

function tableNameFromCreate(sql: string): string | null {
  const match = /CREATE TABLE(?: IF NOT EXISTS)? (\w+)/i.exec(sql);
  return match?.[1] ?? null;
}

function splitStatements(source: string): string[] {
  return source
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function cloneState(state: DatabaseState): DatabaseState {
  return {
    keyHex: state.keyHex,
    unlocked: state.unlocked,
    tables: new Map(
      [...state.tables.entries()].map(([name, table]) => [
        name,
        { autoIncrement: table.autoIncrement, rows: table.rows.map((row) => ({ ...row })) },
      ]),
    ),
  };
}

function restoreState(target: DatabaseState, source: DatabaseState): void {
  target.keyHex = source.keyHex;
  target.unlocked = source.unlocked;
  target.tables = source.tables;
}

function serializeState(state: DatabaseState): unknown {
  return {
    keyHex: state.keyHex,
    tables: Object.fromEntries(
      [...state.tables.entries()].map(([name, table]) => [
        name,
        { autoIncrement: table.autoIncrement, rows: table.rows },
      ]),
    ),
  };
}
