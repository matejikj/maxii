import {
  AppError,
  createChildProfile,
  isAppError,
  type ChildId,
  type ChildProfile,
  type Clock,
  type IdGenerator,
  type UnitOfWorkFactory,
} from '../domain';
import { asChildId } from '../domain';
import type { StartupPhase } from './startupState';

export const DEFAULT_CHILD_DISPLAY_NAME = 'Miminko';
export const META_ACTIVE_CHILD_ID = 'active_child_id';
export const META_WELCOME_COMPLETED = 'welcome_completed';
export const META_BOOTSTRAP_COMPLETED = 'personal_bootstrap_completed';

export type PersonalBootstrapResult = {
  phase: StartupPhase;
  profile: ChildProfile | null;
  welcomePending: boolean;
  error: AppError | null;
};

/**
 * Ensures exactly one local child for personal mode. Concurrent or repeated
 * starts reuse the existing profile instead of minting a second Miminko.
 */
export async function ensurePersonalChildProfile(
  unitOfWork: UnitOfWorkFactory,
  deps: {
    ids: IdGenerator;
    clock: Clock;
    summaryTimeZone: string;
    displayName?: string;
  },
): Promise<ChildProfile> {
  return unitOfWork.run(async (uow) => {
    const existing = await uow.profiles.list();
    if (existing.length > 0) {
      const profile = existing[0]!;
      await uow.meta.set(META_ACTIVE_CHILD_ID, profile.childId);
      await uow.meta.set(META_BOOTSTRAP_COMPLETED, String(deps.clock.now().epochMs));
      return profile;
    }

    // Second look after listing protects against a racing writer in the same DB.
    const activeId = await uow.meta.get(META_ACTIVE_CHILD_ID);
    if (activeId) {
      const byMeta = await uow.profiles.get(asChildId(activeId));
      if (byMeta) return byMeta;
    }

    const childId = asChildId(deps.ids.createId('child'));
    const profile = createChildProfile({
      childId,
      displayName: deps.displayName ?? DEFAULT_CHILD_DISPLAY_NAME,
      birthDate: null,
      summaryTimeZone: deps.summaryTimeZone,
    });
    await uow.profiles.save(profile);
    await uow.meta.set(META_ACTIVE_CHILD_ID, profile.childId);
    await uow.meta.set(META_BOOTSTRAP_COMPLETED, String(deps.clock.now().epochMs));
    return profile;
  });
}

export async function readWelcomePending(unitOfWork: UnitOfWorkFactory): Promise<boolean> {
  return unitOfWork.run(async (uow) => {
    const value = await uow.meta.get(META_WELCOME_COMPLETED);
    return value !== '1';
  });
}

export async function markWelcomeCompleted(unitOfWork: UnitOfWorkFactory): Promise<void> {
  await unitOfWork.run(async (uow) => {
    await uow.meta.set(META_WELCOME_COMPLETED, '1');
  });
}

export async function updatePersonalProfile(
  unitOfWork: UnitOfWorkFactory,
  profile: ChildProfile,
): Promise<ChildProfile> {
  return unitOfWork.run(async (uow) => {
    const current = await uow.profiles.get(profile.childId);
    if (!current) {
      throw new AppError('NOT_FOUND', 'Child profile was not found', {
        details: { reason: 'profile_missing' },
      });
    }
    await uow.profiles.save(profile);
    return profile;
  });
}

export function mapBootstrapOpenError(error: unknown): PersonalBootstrapResult {
  if (isAppError(error)) {
    if (error.code === 'CRYPTO' || error.details.reason === 'keystore' || error.code === 'UNAVAILABLE') {
      return {
        phase: 'key_unavailable',
        profile: null,
        welcomePending: false,
        error,
      };
    }
    if (error.details.reason === 'storage_corrupt' || error.code === 'STORAGE') {
      const recovery =
        String(error.details.reason ?? '').includes('corrupt') ||
        String(error.message).toLowerCase().includes('corrupt');
      return {
        phase: recovery ? 'recovery_required' : 'database_error',
        profile: null,
        welcomePending: false,
        error,
      };
    }
  }
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (/key|keystore|cipher/i.test(message) || name.includes('KeyStore')) {
    return {
      phase: 'key_unavailable',
      profile: null,
      welcomePending: false,
      error: isAppError(error)
        ? error
        : new AppError('CRYPTO', 'Database key is unavailable', {
            details: { reason: 'keystore' },
            cause: error,
          }),
    };
  }
  if (/corrupt|integrity/i.test(message)) {
    return {
      phase: 'recovery_required',
      profile: null,
      welcomePending: false,
      error: isAppError(error)
        ? error
        : new AppError('STORAGE', 'Database requires recovery', {
            details: { reason: 'storage_corrupt' },
            cause: error,
          }),
    };
  }
  return {
    phase: 'database_error',
    profile: null,
    welcomePending: false,
    error: isAppError(error)
      ? error
      : new AppError('STORAGE', 'Local database failed to open', {
          details: { reason: 'database_open' },
          cause: error,
        }),
  };
}

export function resolveDefaultTimeZone(fallback = 'Europe/Prague'): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && zone.length > 0 ? zone : fallback;
  } catch {
    return fallback;
  }
}

export type { ChildId };
