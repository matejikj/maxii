import { AppError } from '../errors';
import type { ActorId, ChildId } from '../ids';
import { canActivateChildPrivateMode } from './privacy';
import type { Project } from './types';
import { PROJECT_LIMITS } from './types';

/**
 * Root tabs for a verified child principal. Caregiver care/history routes stay
 * out of this shell so a theme switch cannot pretend to be a different account.
 */
export type ChildShellTabId = 'today' | 'projects' | 'portfolio' | 'discover';

export type ChildShellTab = {
  readonly id: ChildShellTabId;
  readonly title: string;
  /** Profile/settings live in the header, never as a fifth tab. */
  readonly placement: 'tab';
};

export const CHILD_SHELL_TABS: readonly ChildShellTab[] = [
  { id: 'today', title: 'Dnes', placement: 'tab' },
  { id: 'projects', title: 'Projekty', placement: 'tab' },
  { id: 'portfolio', title: 'Portfolio', placement: 'tab' },
  { id: 'discover', title: 'Objevování', placement: 'tab' },
] as const;

/** Caregiver routes that must never appear inside the child shell. */
export const CHILD_SHELL_FORBIDDEN_ROUTES = [
  'Care',
  'History',
  'care_quick_actions',
  'family_global_search',
  'infant_diary',
] as const;

export type ChildShellForbiddenRoute = (typeof CHILD_SHELL_FORBIDDEN_ROUTES)[number];

export const CHILD_SHELL_FIRST_ENTRY = {
  headline: 'Tvoje projekty jsou tvoje. Ukázat můžeš jen to, co vybereš.',
  canDecline: true,
  includesAbilityTest: false,
  includesCareerPath: false,
} as const;

export type ChildAppPrincipal = {
  readonly appUserId: ActorId;
  /** Visible name/alias only — never date of birth in chrome or deep links. */
  readonly displayAlias: string;
  /**
   * Optional link to a caregiver ChildProfile after explicit activation.
   * Name/DOB alone never invent this binding.
   */
  readonly linkedChildProfileId: ChildId | null;
};

export type ChildShellSession = {
  readonly kind: 'child_shell';
  readonly principal: ChildAppPrincipal;
  readonly tabs: readonly ChildShellTab[];
  readonly firstEntryCompleted: boolean;
};

export type ChildShellActivationGates = {
  readonly verifiedChildIdentity: boolean;
  readonly supportedRecovery: boolean;
  readonly dedicatedDeviceOrAccount: boolean;
  readonly legalOperationalFrameworkReady: boolean;
};

export type ChildShellActivationResult =
  | { readonly ok: true; readonly session: ChildShellSession }
  | {
      readonly ok: false;
      readonly blockers: readonly string[];
      readonly session: null;
    };

const ALIAS_MAX = 40;

/**
 * Alias shown in the child shell header. Rejects empty values and ISO-looking
 * dates so DOB never becomes a decorative or URL identifier.
 */
export function normalizeChildDisplayAlias(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) {
    throw new AppError('VALIDATION', 'Child display alias is required', {
      details: { reason: 'alias_empty' },
    });
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(trimmed)) {
    throw new AppError('VALIDATION', 'Date of birth cannot be used as a display alias', {
      details: { reason: 'alias_looks_like_dob' },
    });
  }
  return trimmed.slice(0, ALIAS_MAX);
}

export function childShellAllowsRoute(route: string): boolean {
  if ((CHILD_SHELL_FORBIDDEN_ROUTES as readonly string[]).includes(route)) {
    return false;
  }
  return CHILD_SHELL_TABS.some((tab) => tab.id === route);
}

/**
 * Attempt to open the child shell. Production gates stay closed until identity,
 * recovery, a dedicated account/device, and the operational framework are ready.
 */
export function attemptChildShellActivation(input: {
  readonly gates: ChildShellActivationGates;
  readonly appUserId: ActorId;
  readonly displayAlias: string;
  readonly linkedChildProfileId?: ChildId | null | undefined;
  readonly firstEntryCompleted?: boolean | undefined;
}): ChildShellActivationResult {
  const activation = canActivateChildPrivateMode(input.gates);
  if (!activation.active) {
    return { ok: false, blockers: activation.blockers, session: null };
  }
  const alias = normalizeChildDisplayAlias(input.displayAlias);
  return {
    ok: true,
    session: {
      kind: 'child_shell',
      principal: {
        appUserId: input.appUserId,
        displayAlias: alias,
        linkedChildProfileId: input.linkedChildProfileId ?? null,
      },
      tabs: CHILD_SHELL_TABS,
      firstEntryCompleted: input.firstEntryCompleted === true,
    },
  };
}

/**
 * Which root navigator to mount. Personal builds stay on the caregiver shell
 * while child gates remain closed — never a hidden-tab disguise.
 */
export function resolveRootShellKind(input: {
  readonly childSession: ChildShellSession | null;
  readonly childPrivateModeActive: boolean;
}): 'caregiver' | 'child' {
  if (
    input.childPrivateModeActive &&
    input.childSession != null &&
    input.childSession.kind === 'child_shell'
  ) {
    return 'child';
  }
  return 'caregiver';
}

/**
 * Switching principals must drop foreign drafts and isolate in-flight work so
 * a previous workspace cannot reopen decrypted under another account.
 */
export function planPrincipalWorkspaceHandoff(input: {
  readonly previousAppUserId: string | null;
  readonly nextAppUserId: string | null;
  readonly openDraftOwnerAppUserId: string | null;
  readonly openJobCount: number;
}): {
  readonly clearOpenDraft: boolean;
  readonly isolateOpenJobs: boolean;
  readonly reopenWrongWorkspace: false;
  readonly switched: boolean;
} {
  const switched =
    input.previousAppUserId != null &&
    input.nextAppUserId != null &&
    input.previousAppUserId !== input.nextAppUserId;
  const draftBelongsElsewhere =
    input.openDraftOwnerAppUserId != null &&
    input.openDraftOwnerAppUserId !== input.nextAppUserId;
  return {
    switched,
    clearOpenDraft: switched && draftBelongsElsewhere,
    isolateOpenJobs: switched && input.openJobCount > 0,
    reopenWrongWorkspace: false,
  };
}

/**
 * Child Today shows at most three own active/idea projects — never a score or
 * missed-task list. Owner filter keeps siblings' private work out.
 */
export function selectChildShellTodayProjects(
  projects: readonly Project[],
  ownerAppUserId: ActorId,
  limit: number = PROJECT_LIMITS.todayActiveProjects,
): Project[] {
  return projects
    .filter(
      (project) =>
        project.scope === 'childPrivate' &&
        project.ownerAppUserId === ownerAppUserId &&
        (project.status === 'active' || project.status === 'idea'),
    )
    .slice(0, Math.max(0, limit));
}

export type ChildShellBlueprint = {
  readonly available: boolean;
  readonly tabs: readonly ChildShellTab[];
  readonly firstEntry: typeof CHILD_SHELL_FIRST_ENTRY;
  readonly forbiddenRoutes: readonly ChildShellForbiddenRoute[];
  readonly profileInHeader: true;
  readonly fifthTab: false;
};
