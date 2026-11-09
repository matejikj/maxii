import type { FamilyAccessCredentials } from './familyAccessCredentials';

/**
 * Optional family login port. Personal mode never constructs an implementation
 * unless the remote boundary is explicitly configured.
 */
export type FamilyAuthSession = {
  readonly appUserId: string;
  readonly accessTokenExpiresAt: string;
  readonly transport: 'bearer' | 'cookie';
  /** Present for native bearer login — never persisted to disk/localStorage. */
  readonly accessToken: string | null;
  /** Present for cookie BFF login so mutating requests can double-submit CSRF. */
  readonly csrfToken: string | null;
};

export type FamilyAuthPort = {
  readonly beginBrowserLogin: () => Promise<{ state: string; authorizationUrl: string }>;
  readonly completeBrowserLogin: (input: {
    readonly code: string;
    readonly state: string;
  }) => Promise<FamilyAuthSession>;
  readonly logout: () => Promise<{ preservedLocalDrafts: true }>;
  readonly currentSession: () => Promise<FamilyAuthSession | null>;
  /** Credentials for authenticated family API calls — null when logged out. */
  readonly getAccessCredentials: () => Promise<FamilyAccessCredentials | null>;
};

export function credentialsFromFamilyAuthSession(
  session: FamilyAuthSession | null,
): FamilyAccessCredentials | null {
  if (!session) return null;
  if (session.transport === 'bearer' && session.accessToken) {
    return { kind: 'bearer', accessToken: session.accessToken };
  }
  if (session.transport === 'cookie' && session.csrfToken) {
    return { kind: 'cookie', csrfToken: session.csrfToken };
  }
  return null;
}

export function createDisabledFamilyAuthPort(): FamilyAuthPort {
  const blocked = async (): Promise<never> => {
    throw new Error('Family authentication is not configured in personal mode.');
  };
  return {
    beginBrowserLogin: blocked,
    completeBrowserLogin: blocked,
    logout: async () => ({ preservedLocalDrafts: true }),
    currentSession: async () => null,
    getAccessCredentials: async () => null,
  };
}
