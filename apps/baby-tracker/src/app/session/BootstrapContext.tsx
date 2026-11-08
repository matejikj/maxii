import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ensurePersonalChildProfile,
  ensureDailyLogicalCheckpoint,
  mapBootstrapOpenError,
  markWelcomeCompleted,
  readWelcomePending,
  resolveDefaultTimeZone,
  updatePersonalProfile,
  wipePersonalData,
  type PersonalBootstrapResult,
  type PersonalWipeResult,
} from '../../application';
import type {
  CareOverviewCache,
  CommandDispatcher,
  ReadModelInvalidator,
} from '../../application';
import { createCareOverviewCache } from '../../application';
import { presentStartupPhase, type StartupPhase } from '../../application/startupState';
import type { ChildProfile, UnitOfWorkFactory } from '../../domain';
import type { LogicalCheckpointVault } from '../../infrastructure/database/logicalCheckpointVault';
import type { DatabaseKeyStore } from '../../infrastructure/database/native/databaseKeyStoreTypes';
import type { DatabasePresence } from '../../infrastructure/database/native/databasePresence';
import type { ReminderScheduler } from '../../infrastructure/notifications/reminderScheduler';
import type { AppLockStore } from '../../infrastructure/security/appLockStore';
import {
  createLocalOperationMetrics,
  type LocalOperationMetrics,
} from '../../ops';
import { wirePersonalCommands } from '../openPersonalUnitOfWork';
import { useCompositionRoot } from '../providers';

export type PersonalRuntime = {
  unitOfWork: UnitOfWorkFactory;
  commands: CommandDispatcher;
  readModels: ReadModelInvalidator;
  /** Derived day/week totals; cleared on care commits without touching diary rows. */
  overviewCache: CareOverviewCache;
  /** Device-local recovery points outside the live diary tables. */
  checkpoints: LogicalCheckpointVault;
  reminders: ReminderScheduler;
  appLock: AppLockStore;
  /** Allowlisted local command outcome counters for support reports. */
  operationMetrics: LocalOperationMetrics;
  databaseName: string;
  keyStore?: DatabaseKeyStore;
  presence?: DatabasePresence;
  close: () => Promise<void>;
  deleteDurableStore: () => Promise<void>;
};

export type OpenPersonalDiary = () => Promise<{
  unitOfWork: UnitOfWorkFactory;
  checkpoints: LogicalCheckpointVault;
  reminders: ReminderScheduler;
  appLock: AppLockStore;
  databaseName: string;
  keyStore?: DatabaseKeyStore;
  presence?: DatabasePresence;
  close: () => Promise<void>;
  deleteDurableStore: () => Promise<void>;
}>;

export type BootstrapContextValue = {
  phase: StartupPhase;
  profile: ChildProfile | null;
  welcomePending: boolean;
  errorMessage: string | null;
  presentation: ReturnType<typeof presentStartupPhase>;
  /** Present once the personal diary adapters and command bus are ready. */
  runtime: PersonalRuntime | null;
  skipWelcome: () => Promise<void>;
  saveProfile: (profile: ChildProfile) => Promise<void>;
  /** Confirmed full local wipe; restarts bootstrap for a clean first launch. */
  wipeAllLocalData: () => Promise<PersonalWipeResult>;
  retry: () => void;
};

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

export function BootstrapProvider({
  children,
  openPersonalDiary,
}: {
  children: ReactNode;
  openPersonalDiary: OpenPersonalDiary;
}) {
  const { services } = useCompositionRoot();
  const cached = useRef<PersonalRuntime | null>(null);
  /** Prevents React Strict Mode from opening the SQLCipher diary twice concurrently. */
  const openInflight = useRef<Promise<PersonalRuntime> | null>(null);
  const [result, setResult] = useState<PersonalBootstrapResult>({
    phase: 'initializing',
    profile: null,
    welcomePending: false,
    error: null,
  });
  const [runtime, setRuntime] = useState<PersonalRuntime | null>(null);
  const [attempt, setAttempt] = useState(0);

  const resolveRuntime = useCallback(async () => {
    if (cached.current) return cached.current;
    if (openInflight.current) return openInflight.current;
    openInflight.current = (async () => {
      const opened = await openPersonalDiary();
      const operationMetrics = createLocalOperationMetrics({
        nowMs: () => services.clock.now().epochMs,
      });
      const wired = wirePersonalCommands(services, opened.unitOfWork, {
        metrics: operationMetrics,
      });
      const overviewCache = createCareOverviewCache();
      const readModels = wired.readModels!;
      readModels.subscribe((topics) => {
        if (
          topics.includes('care') ||
          topics.includes('sessions') ||
          topics.includes('revisions')
        ) {
          overviewCache.invalidate();
        }
      });
      const next: PersonalRuntime = {
        unitOfWork: opened.unitOfWork,
        commands: wired.commands!,
        readModels,
        overviewCache,
        checkpoints: opened.checkpoints,
        reminders: opened.reminders,
        appLock: opened.appLock,
        operationMetrics,
        databaseName: opened.databaseName,
        ...(opened.keyStore ? { keyStore: opened.keyStore } : {}),
        ...(opened.presence ? { presence: opened.presence } : {}),
        close: opened.close,
        deleteDurableStore: opened.deleteDurableStore,
      };
      cached.current = next;
      return next;
    })();
    try {
      return await openInflight.current;
    } finally {
      openInflight.current = null;
    }
  }, [openPersonalDiary, services]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setResult({
        phase: 'migrating',
        profile: null,
        welcomePending: false,
        error: null,
      });
      setRuntime(null);
      try {
        // Fresh attempt may need a new open after a hard failure.
        if (attempt > 0) cached.current = null;
        const personal = await resolveRuntime();
        if (cancelled) return;
        const profile = await ensurePersonalChildProfile(personal.unitOfWork, {
          ids: services.ids,
          clock: services.clock,
          summaryTimeZone: resolveDefaultTimeZone(),
        });
        const welcomePending = await readWelcomePending(personal.unitOfWork);
        if (cancelled) return;
        await ensureDailyLogicalCheckpoint({
          unitOfWork: personal.unitOfWork,
          vault: personal.checkpoints,
          nowMs: services.clock.now().epochMs,
          timeZone: profile.settings.summaryTimeZone,
        });
        if (cancelled) return;
        setRuntime(personal);
        setResult({
          phase: welcomePending ? 'welcome' : 'ready',
          profile,
          welcomePending,
          error: null,
        });
      } catch (error) {
        cached.current = null;
        if (cancelled) return;
        const mapped = mapBootstrapOpenError(error);
        console.error('LUMI_BOOTSTRAP_FAIL', {
          phase: mapped.phase,
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          code:
            error && typeof error === 'object' && 'code' in error
              ? String((error as { code: unknown }).code)
              : null,
          details:
            mapped.error && typeof mapped.error.details === 'object'
              ? mapped.error.details
              : null,
        });
        setRuntime(null);
        setResult(mapped);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, resolveRuntime, services.clock, services.ids]);

  const skipWelcome = useCallback(async () => {
    const personal = await resolveRuntime();
    await markWelcomeCompleted(personal.unitOfWork);
    setResult((current) => ({
      ...current,
      phase: 'ready',
      welcomePending: false,
    }));
  }, [resolveRuntime]);

  const saveProfile = useCallback(
    async (profile: ChildProfile) => {
      const personal = await resolveRuntime();
      const saved = await updatePersonalProfile(personal.unitOfWork, profile);
      setResult((current) => ({ ...current, profile: saved }));
    },
    [resolveRuntime],
  );

  const wipeAllLocalData = useCallback(async () => {
    const personal = await resolveRuntime();
    const wipeResult = await wipePersonalData({
      unitOfWork: personal.unitOfWork,
      checkpoints: personal.checkpoints,
      reminders: personal.reminders,
      appLock: personal.appLock,
      nowMs: services.clock.now().epochMs,
      closeRuntime: personal.close,
      deleteDurableStore: personal.deleteDurableStore,
      databaseName: personal.databaseName,
      ...(personal.keyStore ? { keyStore: personal.keyStore } : {}),
      ...(personal.presence ? { presence: personal.presence } : {}),
    });
    cached.current = null;
    setRuntime(null);
    setResult({
      phase: 'initializing',
      profile: null,
      welcomePending: false,
      error: null,
    });
    setAttempt((n) => n + 1);
    return wipeResult;
  }, [resolveRuntime, services.clock]);

  const value = useMemo<BootstrapContextValue>(
    () => ({
      phase: result.phase,
      profile: result.profile,
      welcomePending: result.welcomePending,
      errorMessage: result.error?.message ?? null,
      presentation: presentStartupPhase(result.phase),
      runtime,
      skipWelcome,
      saveProfile,
      wipeAllLocalData,
      retry: () => setAttempt((n) => n + 1),
    }),
    [result, runtime, saveProfile, skipWelcome, wipeAllLocalData],
  );

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrap(): BootstrapContextValue {
  const value = useContext(BootstrapContext);
  if (!value) {
    throw new Error('Bootstrap context is unavailable outside BootstrapProvider.');
  }
  return value;
}

export function usePersonalRuntime(): PersonalRuntime {
  const { runtime } = useBootstrap();
  if (!runtime) {
    throw new Error('Personal runtime is not ready yet.');
  }
  return runtime;
}
