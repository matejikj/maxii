/**
 * Family auth/sync stay behind an explicit configuration gate. Personal mode
 * never initializes clients, handshakes, or sync waiting UI when unset.
 */
export type RemoteServicesBoundary = {
  apiBaseUrl: string | null;
  authConfigured: boolean;
  syncConfigured: boolean;
};

export function resolveRemoteServicesBoundary(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): RemoteServicesBoundary {
  const apiBaseUrl = env.EXPO_PUBLIC_LUMI_API_URL?.trim() || null;
  const authConfigured = env.EXPO_PUBLIC_LUMI_AUTH_ENABLED === '1' && apiBaseUrl != null;
  const syncConfigured = env.EXPO_PUBLIC_LUMI_SYNC_ENABLED === '1' && authConfigured;
  return { apiBaseUrl, authConfigured, syncConfigured };
}

export function shouldInitializeRemoteClients(boundary: RemoteServicesBoundary): boolean {
  return boundary.authConfigured || boundary.syncConfigured;
}

export function personalModeBlocksOnMissingBackend(boundary: RemoteServicesBoundary): boolean {
  // Absent server config is the default personal state, not a startup error.
  void boundary;
  return false;
}
