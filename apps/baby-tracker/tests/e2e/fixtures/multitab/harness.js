/* global Dexie */
(function () {
  const WRITE_LEASE_ID = 'write';
  const LEASE_TTL_MS = 1500;

  class LockDb extends Dexie {
    constructor(name) {
      super(name);
      this.version(1).stores({ leases: 'leaseId, ownerTabId, expiresAtMs' });
    }
  }

  class DiaryDb extends Dexie {
    constructor(name) {
      super(name);
      this.version(1).stores({
        sessions: 'sessionId, [childId+kind], status',
        meta: 'key',
      });
    }
  }

  function api(tabId, lockName, diaryName, nowFn) {
    const locks = new LockDb(lockName);
    const diary = new DiaryDb(diaryName);
    const now = nowFn || (() => Date.now());

    async function reclaim() {
      await locks.open();
      const rows = await locks.leases.toArray();
      const t = now();
      for (const row of rows) {
        if (row.expiresAtMs <= t) await locks.leases.delete(row.leaseId);
      }
    }

    return {
      tabId,
      async acquireWrite() {
        await reclaim();
        await locks.transaction('rw', locks.leases, async () => {
          const existing = await locks.leases.get(WRITE_LEASE_ID);
          const t = now();
          if (existing && existing.expiresAtMs > t && existing.ownerTabId !== tabId) {
            throw new Error('tab_lease_held');
          }
          await locks.leases.put({
            leaseId: WRITE_LEASE_ID,
            ownerTabId: tabId,
            expiresAtMs: t + LEASE_TTL_MS,
          });
        });
      },
      async releaseWrite() {
        await locks.open();
        const existing = await locks.leases.get(WRITE_LEASE_ID);
        if (existing && existing.ownerTabId === tabId) {
          await locks.leases.delete(WRITE_LEASE_ID);
        }
      },
      async startSleep(sessionId) {
        await diary.open();
        await diary.transaction('rw', diary.sessions, async () => {
          const clash = await diary.sessions
            .where('[childId+kind]')
            .equals(['child_1', 'sleep'])
            .filter((row) => row.status === 'running')
            .first();
          if (clash) throw new Error('active_session_exists');
          await diary.sessions.put({
            sessionId,
            childId: 'child_1',
            kind: 'sleep',
            status: 'running',
          });
        });
      },
      async advanceClock(ms) {
        // Harness clock is controlled by the test via shared localStorage tick.
        const key = `${lockName}:clock`;
        const base = Number(localStorage.getItem(key) || String(Date.now()));
        localStorage.setItem(key, String(base + ms));
      },
    };
  }

  window.LumiMultitabHarness = {
    create(tabId, lockName, diaryName) {
      const clockKey = `${lockName}:clock`;
      if (!localStorage.getItem(clockKey)) {
        localStorage.setItem(clockKey, String(Date.now()));
      }
      return api(tabId, lockName, diaryName, () => Number(localStorage.getItem(clockKey)));
    },
    bumpClock(lockName, ms) {
      const clockKey = `${lockName}:clock`;
      const base = Number(localStorage.getItem(clockKey) || String(Date.now()));
      localStorage.setItem(clockKey, String(base + ms));
    },
  };

  document.getElementById('status').textContent = 'harness-ready';
})();
