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
  mapBootstrapOpenError,
  markWelcomeCompleted,
  readWelcomePending,
  resolveDefaultTimeZone,
  updatePersonalProfile,
  type PersonalBootstrapResult,
} from '../../application/personalBootstrap';
import type { CommandDispatcher, ReadModelInvalidator } from '../../application';
import { presentStartupPhase, type StartupPhase } from '../../application/startupState';
import type { ChildProfile, UnitOfWorkFactory } from '../../domain';
import { wirePersonalCommands } from '../openPersonalUnitOfWork';
import { useCompositionRoot } from '../providers';

export type PersonalRuntime = {
  unitOfWork: UnitOfWorkFactory;
  commands: CommandDispatcher;
  readModels: ReadModelInvalidator;
};

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
  retry: () => void;
};

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

export function BootstrapProvider({
  children,
  openUnitOfWork,
}: {
  children: ReactNode;
  openUnitOfWork: () => Promise<UnitOfWorkFactory>;
}) {
  const { services } = useCompositionRoot();
  const cached = useRef<PersonalRuntime | null>(null);
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
    const unitOfWork = await openUnitOfWork();
    const wired = wirePersonalCommands(services, unitOfWork);
    const next: PersonalRuntime = {
      unitOfWork,
      commands: wired.commands!,
      readModels: wired.readModels!,
    };
    cached.current = next;
    return next;
  }, [openUnitOfWork, services]);

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
        setRuntime(null);
        setResult(mapBootstrapOpenError(error));
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
      retry: () => setAttempt((n) => n + 1),
    }),
    [result, runtime, saveProfile, skipWelcome],
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
