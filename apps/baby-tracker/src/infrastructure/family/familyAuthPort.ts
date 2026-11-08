/**
 * Optional family login port. Personal mode never constructs an implementation
 * unless the remote boundary is explicitly configured.
 */
export type FamilyAuthSession = {
  readonly appUserId: string;
  readonly accessTokenExpiresAt: string;
};

export type FamilyAuthPort = {
  readonly beginBrowserLogin: () => Promise<{ state: string; authorizationUrl: string }>;
  readonly completeBrowserLogin: (input: {
    readonly code: string;
    readonly state: string;
  }) => Promise<FamilyAuthSession>;
  readonly logout: () => Promise<{ preservedLocalDrafts: true }>;
  readonly currentSession: () => Promise<FamilyAuthSession | null>;
};

export function createDisabledFamilyAuthPort(): FamilyAuthPort {
  const blocked = async (): Promise<never> => {
    throw new Error('Family authentication is not configured in personal mode.');
  };
  return {
    beginBrowserLogin: blocked,
    completeBrowserLogin: blocked,
    logout: async () => ({ preservedLocalDrafts: true }),
    currentSession: async () => null,
  };
}
