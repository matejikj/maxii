import type { FamilyAccessCredentials } from './familyAccessCredentials';
import {
  credentialsFromFamilyAuthSession,
  type FamilyAuthPort,
  type FamilyAuthSession,
} from './familyAuthPort';

export type BrowserFamilyAuthConfig = {
  readonly apiBaseUrl: string;
  readonly redirectUri: string;
  readonly transport: 'bearer' | 'cookie';
  readonly fetchImpl?: typeof fetch;
};

const KNOWN_AUTH_MODE = 'oidc_keycloak_v1';
const KNOWN_AUTH_MODE_VERSION = 1;

type ModeResponse = {
  readonly version: number;
  readonly mode: string;
};

/**
 * Family login against the BFF. Bearer tokens stay in process memory only;
 * cookie transport relies on HttpOnly BFF cookies — never localStorage.
 */
export function createBrowserFamilyAuthPort(config: BrowserFamilyAuthConfig): FamilyAuthPort {
  const fetchImpl = config.fetchImpl ?? fetch;
  let memorySession: FamilyAuthSession | null = null;
  let pendingState: string | null = null;

  async function readMode(): Promise<ModeResponse> {
    const response = await fetchImpl(`${config.apiBaseUrl}/v1/auth/mode`);
    if (!response.ok) {
      throw new Error('Family auth mode is unavailable.');
    }
    return (await response.json()) as ModeResponse;
  }

  return {
    beginBrowserLogin: async () => {
      const mode = await readMode();
      if (mode.version !== KNOWN_AUTH_MODE_VERSION || mode.mode !== KNOWN_AUTH_MODE) {
        throw new Error(
          'Tento režim přihlášení aplikace nezná. Místní deník zůstává beze změny — aktualizujte aplikaci.',
        );
      }
      const response = await fetchImpl(`${config.apiBaseUrl}/v1/auth/login/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ redirectUri: config.redirectUri }),
      });
      if (!response.ok) {
        throw new Error('Přihlášení se nepodařilo spustit.');
      }
      const body = (await response.json()) as {
        state: string;
        authorizationUrl: string;
      };
      pendingState = body.state;
      return body;
    },

    completeBrowserLogin: async (input) => {
      if (!pendingState || input.state !== pendingState) {
        throw new Error('Stav přihlášení nesouhlasí nebo vypršel.');
      }
      const response = await fetchImpl(`${config.apiBaseUrl}/v1/auth/login/callback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: config.transport === 'cookie' ? 'include' : 'same-origin',
        body: JSON.stringify({
          code: input.code,
          state: input.state,
          redirectUri: config.redirectUri,
          transport: config.transport,
        }),
      });
      pendingState = null;
      if (!response.ok) {
        throw new Error('Dokončení přihlášení selhalo.');
      }
      const body = (await response.json()) as {
        appUserId: string;
        expiresAt: string;
        transport?: 'bearer' | 'cookie';
        accessToken?: string;
        csrfToken?: string;
      };
      memorySession = {
        appUserId: body.appUserId,
        accessTokenExpiresAt: body.expiresAt,
        transport: body.transport === 'cookie' ? 'cookie' : 'bearer',
        accessToken: typeof body.accessToken === 'string' ? body.accessToken : null,
        csrfToken: typeof body.csrfToken === 'string' ? body.csrfToken : null,
      };
      return memorySession;
    },

    logout: async () => {
      await fetchImpl(`${config.apiBaseUrl}/v1/auth/logout`, {
        method: 'POST',
        credentials: config.transport === 'cookie' ? 'include' : 'same-origin',
      });
      memorySession = null;
      return { preservedLocalDrafts: true as const };
    },

    currentSession: async () => {
      if (memorySession) return memorySession;
      if (config.transport !== 'cookie') return null;
      const response = await fetchImpl(`${config.apiBaseUrl}/v1/auth/session`, {
        credentials: 'include',
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        appUserId: string;
        expiresAt: string;
        csrfToken?: string;
      };
      memorySession = {
        appUserId: body.appUserId,
        accessTokenExpiresAt: body.expiresAt,
        transport: 'cookie',
        accessToken: null,
        csrfToken: typeof body.csrfToken === 'string' ? body.csrfToken : null,
      };
      return memorySession;
    },

    getAccessCredentials: async (): Promise<FamilyAccessCredentials | null> => {
      const session = await (async () => {
        if (memorySession) return memorySession;
        if (config.transport !== 'cookie') return null;
        const response = await fetchImpl(`${config.apiBaseUrl}/v1/auth/session`, {
          credentials: 'include',
        });
        if (!response.ok) return null;
        const body = (await response.json()) as {
          appUserId: string;
          expiresAt: string;
          csrfToken?: string;
        };
        memorySession = {
          appUserId: body.appUserId,
          accessTokenExpiresAt: body.expiresAt,
          transport: 'cookie',
          accessToken: null,
          csrfToken: typeof body.csrfToken === 'string' ? body.csrfToken : null,
        };
        return memorySession;
      })();
      return credentialsFromFamilyAuthSession(session);
    },
  };
}
