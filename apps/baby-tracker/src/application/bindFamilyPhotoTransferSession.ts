import {
  createDisabledFamilyAttachmentTransferPort,
  type FamilyAttachmentTransferPort,
} from '../domain/attachments';
import { resolveFamilyAttachmentTransferPort } from '../infrastructure/attachments/httpFamilyAttachmentTransferClient';
import {
  credentialsFromFamilyAuthSession,
  type FamilyAuthSession,
} from '../infrastructure/family/familyAuthPort';
import {
  createFamilyPhotoTransferRuntime,
  type FamilyPhotoTransferRuntime,
} from './familyPhotoTransferRuntime';

export type FamilyPhotoTransferRemoteGate = {
  readonly apiBaseUrl: string | null;
  readonly syncConfigured: boolean;
};

export type FamilyPhotoTransferSessionBinding = {
  readonly runtime: FamilyPhotoTransferRuntime;
  /** Apply login/logout so uploads use the current user and credentials. */
  readonly bindAuthSession: (session: FamilyAuthSession | null) => void;
  /** Apply the selected family; null keeps transfers cold even when logged in. */
  readonly bindActiveFamily: (familyId: string | null) => void;
  /** Current HTTP/disabled port — exposed for focused tests. */
  readonly getTransferPort: () => FamilyAttachmentTransferPort;
};

/**
 * Binds family auth credentials and active family id into the photo transfer
 * runtime. Without sync env flags the port stays disabled so personal builds
 * never contact a backend.
 */
export function createFamilyPhotoTransferSessionBinding(input: {
  readonly boundary: FamilyPhotoTransferRemoteGate;
  readonly fetchImpl?: typeof fetch;
  readonly createJobId?: (seed: string) => string;
}): FamilyPhotoTransferSessionBinding {
  let authSession: FamilyAuthSession | null = null;
  let activeFamilyId: string | null = null;
  let port: FamilyAttachmentTransferPort = createDisabledFamilyAttachmentTransferPort();

  const runtime = createFamilyPhotoTransferRuntime({
    getPort: () => port,
    createJobId: input.createJobId,
  });

  function rebuild(): void {
    const syncReady = input.boundary.syncConfigured && Boolean(input.boundary.apiBaseUrl);
    port = resolveFamilyAttachmentTransferPort({
      apiBaseUrl: input.boundary.apiBaseUrl,
      // Only open the HTTP client when sync is configured and a user is present.
      familySyncConfigured: syncReady && authSession != null,
      getAccessCredentials: async () => credentialsFromFamilyAuthSession(authSession),
      fetchImpl: input.fetchImpl,
    });
    runtime.setSession({
      familySyncConfigured: syncReady,
      activeFamilyId,
      appUserId: authSession?.appUserId ?? null,
    });
  }

  rebuild();

  return {
    runtime,
    bindAuthSession(session) {
      authSession = session;
      rebuild();
    },
    bindActiveFamily(familyId) {
      activeFamilyId = familyId;
      rebuild();
    },
    getTransferPort: () => port,
  };
}
