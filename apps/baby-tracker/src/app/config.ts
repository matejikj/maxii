/**
 * Public runtime configuration. Only EXPO_PUBLIC_* names are readable in the
 * client bundle; secrets never belong here or in pull-request logs.
 */
export type AppEnvironment = 'development' | 'staging' | 'production';

export type PublicAppConfig = {
  environment: AppEnvironment;
  storageProbeEnabled: boolean;
  appName: string;
};

function readEnvironment(raw: string | undefined): AppEnvironment {
  if (raw === 'production' || raw === 'staging' || raw === 'development') {
    return raw;
  }
  return typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production';
}

export function loadPublicAppConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): PublicAppConfig {
  return {
    environment: readEnvironment(env.EXPO_PUBLIC_LUMI_ENV),
    storageProbeEnabled: env.EXPO_PUBLIC_LUMI_STORAGE_PROBE === '1',
    appName: env.EXPO_PUBLIC_LUMI_APP_NAME ?? 'LUMI Baby Tracker',
  };
}
