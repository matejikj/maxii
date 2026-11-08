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
import { presentStartupPhase, type StartupPhase } from '../../application/startupState';
import type { ChildProfile, UnitOfWorkFactory } from '../../domain';
import { useCompositionRoot } from '../providers';

export type BootstrapContextValue = {
  phase: StartupPhase;
  profile: ChildProfile | null;
  welcomePending: boolean;
  errorMessage: string | null;
  presentation: ReturnType<typeof presentStartupPhase>;
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
  const cached = useRef<UnitOfWorkFactory | null>(null);
  const [result, setResult] = useState<PersonalBootstrapResult>({
    phase: 'initializing',
    profile: null,
    welcomePending: false,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  const resolveUnitOfWork = useCallback(async () => {
    if (cached.current) return cached.current;
    const unitOfWork = await openUnitOfWork();
    cached.current = unitOfWork;
    return unitOfWork;
  }, [openUnitOfWork]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setResult({
        phase: 'migrating',
        profile: null,
        welcomePending: false,
        error: null,
      });
      try {
        // Fresh attempt may need a new open after a hard failure.
        if (attempt > 0) cached.current = null;
        const unitOfWork = await resolveUnitOfWork();
        if (cancelled) return;
        const profile = await ensurePersonalChildProfile(unitOfWork, {
          ids: services.ids,
          clock: services.clock,
          summaryTimeZone: resolveDefaultTimeZone(),
        });
        const welcomePending = await readWelcomePending(unitOfWork);
        if (cancelled) return;
        setResult({
          phase: welcomePending ? 'welcome' : 'ready',
          profile,
          welcomePending,
          error: null,
        });
      } catch (error) {
        cached.current = null;
        if (cancelled) return;
        setResult(mapBootstrapOpenError(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, resolveUnitOfWork, services.clock, services.ids]);

  const skipWelcome = useCallback(async () => {
    const unitOfWork = await resolveUnitOfWork();
    await markWelcomeCompleted(unitOfWork);
    setResult((current) => ({
      ...current,
      phase: 'ready',
      welcomePending: false,
    }));
  }, [resolveUnitOfWork]);

  const saveProfile = useCallback(
    async (profile: ChildProfile) => {
      const unitOfWork = await resolveUnitOfWork();
      const saved = await updatePersonalProfile(unitOfWork, profile);
      setResult((current) => ({ ...current, profile: saved }));
    },
    [resolveUnitOfWork],
  );

  const value = useMemo<BootstrapContextValue>(
    () => ({
      phase: result.phase,
      profile: result.profile,
      welcomePending: result.welcomePending,
      errorMessage: result.error?.message ?? null,
      presentation: presentStartupPhase(result.phase),
      skipWelcome,
      saveProfile,
      retry: () => setAttempt((n) => n + 1),
    }),
    [result, saveProfile, skipWelcome],
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
