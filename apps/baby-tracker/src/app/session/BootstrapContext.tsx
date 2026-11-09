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
  addChildProfile as persistAddedChildProfile,
  archiveChildProfile as persistArchivedChildProfile,
  ensurePersonalChildProfile,
  ensureDailyLogicalCheckpoint,
  loadMultiChildWorkspace,
  mapBootstrapOpenError,
  markWelcomeCompleted,
  readWelcomePending,
  resolveDefaultTimeZone,
  switchActiveChild as persistActiveChildSwitch,
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
import type { ChildId, ChildProfile, UnitOfWorkFactory } from '../../domain';
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
  /** Optional local photo import for notes/milestones/experiences. */
  attachments: import('../../domain/attachments').AttachmentServices | null;
  /** Family photo transfer queue — cold/disabled while personal mode has no sync. */
  photoTransfer: import('../../application/familyPhotoTransferRuntime').FamilyPhotoTransferRuntime;
  /** Push login/logout into the transfer queue (no-op when sync env is unset). */
  bindPhotoTransferAuth: (
    session: import('../../infrastructure/family/familyAuthPort').FamilyAuthSession | null,
  ) => void;
  /** Select the family whose photos may upload/download. */
  bindPhotoTransferFamily: (familyId: string | null) => void;
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
  webDb?: import('../../infrastructure/database/web/lumiWebDatabase').LumiWebDatabase;
}>;

export type BootstrapContextValue = {
  phase: StartupPhase;
  profile: ChildProfile | null;
  /** All local profiles including archived ones used for history/export labels. */
  profiles: ChildProfile[];
  /** Active profiles offered in the header switcher. */
  activeProfiles: ChildProfile[];
  welcomePending: boolean;
  errorMessage: string | null;
  presentation: ReturnType<typeof presentStartupPhase>;
  /** Present once the personal diary adapters and command bus are ready. */
  runtime: PersonalRuntime | null;
  skipWelcome: () => Promise<void>;
  saveProfile: (profile: ChildProfile) => Promise<void>;
  switchChild: (childId: ChildId) => Promise<void>;
  addChild: (input: { displayName: string; birthDate?: ChildProfile['birthDate'] }) => Promise<ChildProfile>;
  archiveChild: (childId: ChildId) => Promise<void>;
  refreshChildren: () => Promise<void>;
  /** Confirmed full local wipe; restarts bootstrap for a clean first launch. */
  wipeAllLocalData: () => Promise<PersonalWipeResult>;
  retry: () => void;
};

export const BootstrapContext = createContext<BootstrapContextValue | null>(null);

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
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [activeProfiles, setActiveProfiles] = useState<ChildProfile[]>([]);
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
      const attachmentModule = await import('../../infrastructure/attachments/createPersonalAttachmentServices');
      const { createFamilyPhotoTransferSessionBinding } = await import(
        '../../application/bindFamilyPhotoTransferSession'
      );
      const { resolveRemoteServicesBoundary } = await import('../remoteServicesBoundary');
      // Binding stays cold unless EXPO_PUBLIC_LUMI_SYNC_ENABLED and a login exist.
      const photoTransferBinding = createFamilyPhotoTransferSessionBinding({
        boundary: resolveRemoteServicesBoundary(),
      });
      const next: PersonalRuntime = {
        unitOfWork: opened.unitOfWork,
        commands: wired.commands!,
        readModels,
        overviewCache,
        checkpoints: opened.checkpoints,
        reminders: opened.reminders,
        attachments: attachmentModule.createPersonalAttachmentServices({
          unitOfWork: opened.unitOfWork,
          ...(opened.webDb ? { webDb: opened.webDb } : {}),
        }),
        photoTransfer: photoTransferBinding.runtime,
        bindPhotoTransferAuth: photoTransferBinding.bindAuthSession,
        bindPhotoTransferFamily: photoTransferBinding.bindActiveFamily,
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

  const applyWorkspace = useCallback(
    (workspace: Awaited<ReturnType<typeof loadMultiChildWorkspace>>) => {
      setProfiles(workspace.profiles);
      setActiveProfiles(workspace.activeProfiles);
      if (workspace.activeChild) {
        setResult((current) => ({ ...current, profile: workspace.activeChild }));
      }
    },
    [],
  );

  const refreshChildren = useCallback(async () => {
    const personal = await resolveRuntime();
    applyWorkspace(await loadMultiChildWorkspace(personal.unitOfWork));
  }, [applyWorkspace, resolveRuntime]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setResult({
        phase: 'migrating',
        profile: null,
        welcomePending: false,
        error: null,
      });
      setProfiles([]);
      setActiveProfiles([]);
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
        const workspace = await loadMultiChildWorkspace(personal.unitOfWork);
        if (cancelled) return;
        setRuntime(personal);
        setProfiles(workspace.profiles);
        setActiveProfiles(workspace.activeProfiles);
        setResult({
          phase: welcomePending ? 'welcome' : 'ready',
          profile: workspace.activeChild ?? profile,
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
        setProfiles([]);
        setActiveProfiles([]);
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
      applyWorkspace(await loadMultiChildWorkspace(personal.unitOfWork));
    },
    [applyWorkspace, resolveRuntime],
  );

  const switchChild = useCallback(
    async (childId: ChildId) => {
      const personal = await resolveRuntime();
      const next = await persistActiveChildSwitch(personal.unitOfWork, childId);
      personal.overviewCache.invalidate();
      setResult((current) => ({ ...current, profile: next }));
      applyWorkspace(await loadMultiChildWorkspace(personal.unitOfWork));
      personal.readModels.notifyCommitted(['profile', 'care', 'sessions']);
    },
    [applyWorkspace, resolveRuntime],
  );

  const addChild = useCallback(
    async (input: { displayName: string; birthDate?: ChildProfile['birthDate'] }) => {
      const personal = await resolveRuntime();
      const zone = result.profile?.settings.summaryTimeZone ?? resolveDefaultTimeZone();
      const created = await persistAddedChildProfile(personal.unitOfWork, {
        ids: services.ids,
        displayName: input.displayName,
        birthDate: input.birthDate ?? null,
        summaryTimeZone: zone,
        activate: true,
      });
      personal.overviewCache.invalidate();
      setResult((current) => ({ ...current, profile: created }));
      applyWorkspace(await loadMultiChildWorkspace(personal.unitOfWork));
      personal.readModels.notifyCommitted(['profile', 'care', 'sessions']);
      return created;
    },
    [applyWorkspace, resolveRuntime, result.profile?.settings.summaryTimeZone, services.ids],
  );

  const archiveChild = useCallback(
    async (childId: ChildId) => {
      const personal = await resolveRuntime();
      const archived = await persistArchivedChildProfile(personal.unitOfWork, {
        childId,
        archivedAtMs: services.clock.now().epochMs,
      });
      personal.overviewCache.invalidate();
      setResult((current) => ({ ...current, profile: archived.activeChild }));
      applyWorkspace(await loadMultiChildWorkspace(personal.unitOfWork));
      personal.readModels.notifyCommitted(['profile', 'care', 'sessions']);
    },
    [applyWorkspace, resolveRuntime, services.clock],
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
    setProfiles([]);
    setActiveProfiles([]);
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
      profiles,
      activeProfiles,
      welcomePending: result.welcomePending,
      errorMessage: result.error?.message ?? null,
      presentation: presentStartupPhase(result.phase),
      runtime,
      skipWelcome,
      saveProfile,
      switchChild,
      addChild,
      archiveChild,
      refreshChildren,
      wipeAllLocalData,
      retry: () => setAttempt((n) => n + 1),
    }),
    [
      activeProfiles,
      addChild,
      archiveChild,
      profiles,
      refreshChildren,
      result,
      runtime,
      saveProfile,
      skipWelcome,
      switchChild,
      wipeAllLocalData,
    ],
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
