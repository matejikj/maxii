import type { FamilyAccessCredentials } from './familyAccessCredentials';
import type { FamilyMembershipSummary } from '../../domain/attachments/activeFamilySelection';

export type FamilyMembershipListResult =
  | { readonly ok: true; readonly memberships: readonly FamilyMembershipSummary[] }
  | { readonly ok: false; readonly code: 'unauthorized' | 'network'; readonly message: string };

/**
 * Reads the caller's family memberships from `/v1/me`. Personal builds never
 * construct this client unless remote auth/sync is explicitly configured.
 */
export function createHttpFamilyMembershipClient(config: {
  readonly apiBaseUrl: string;
  readonly getAccessCredentials: () => Promise<FamilyAccessCredentials | null>;
  readonly fetchImpl?: typeof fetch;
}): {
  readonly listMemberships: () => Promise<FamilyMembershipListResult>;
} {
  const fetchImpl = config.fetchImpl ?? fetch;
  const base = config.apiBaseUrl.replace(/\/$/, '');

  return {
    async listMemberships() {
      const credentials = await config.getAccessCredentials();
      if (!credentials) {
        return { ok: false, code: 'unauthorized', message: 'Missing access credentials' };
      }
      const headers: Record<string, string> = {};
      let requestCredentials: RequestCredentials = 'same-origin';
      if (credentials.kind === 'bearer') {
        headers.authorization = `Bearer ${credentials.accessToken}`;
      } else {
        headers['x-csrf-token'] = credentials.csrfToken;
        requestCredentials = 'include';
      }
      try {
        const response = await fetchImpl(`${base}/v1/me`, {
          method: 'GET',
          headers,
          credentials: requestCredentials,
        });
        if (response.status === 401 || response.status === 403) {
          return { ok: false, code: 'unauthorized', message: 'Membership lookup unauthorized' };
        }
        if (!response.ok) {
          return { ok: false, code: 'network', message: `Membership lookup failed (${response.status})` };
        }
        const body = (await response.json()) as {
          memberships?: Array<{ familyId?: string; role?: string; status?: string }>;
        };
        const memberships: FamilyMembershipSummary[] = (body.memberships ?? [])
          .filter(
            (item): item is { familyId: string; role: string; status: string } =>
              typeof item.familyId === 'string' &&
              typeof item.role === 'string' &&
              typeof item.status === 'string',
          )
          .map((item) => ({
            familyId: item.familyId,
            role: item.role,
            status: item.status,
          }));
        return { ok: true, memberships };
      } catch {
        return { ok: false, code: 'network', message: 'Membership lookup failed' };
      }
    },
  };
}
