/**
 * Versioned login-mode metadata. Unknown modes must leave local diary data
 * alone and ask the user to update — never invent a merge by e-mail.
 */
export const LUMI_AUTH_MODE_VERSION = 1 as const;

export const LUMI_AUTH_MODES = ['oidc_keycloak_v1'] as const;
export type LumiAuthMode = (typeof LUMI_AUTH_MODES)[number];

export type AuthModeDescriptor = {
  readonly version: typeof LUMI_AUTH_MODE_VERSION;
  readonly mode: LumiAuthMode;
  readonly approvedOrigins: readonly string[];
  readonly nativeRedirectSchemes: readonly string[];
};

export function isKnownAuthMode(value: unknown): value is LumiAuthMode {
  return typeof value === 'string' && (LUMI_AUTH_MODES as readonly string[]).includes(value);
}

export function resolveAuthModeOrHold(input: {
  readonly mode: unknown;
  readonly version: unknown;
}):
  | { readonly ok: true; readonly mode: LumiAuthMode }
  | { readonly ok: false; readonly holdLocalData: true; readonly reason: 'unknown_mode' | 'unsupported_version' } {
  if (input.version !== LUMI_AUTH_MODE_VERSION) {
    return { ok: false, holdLocalData: true, reason: 'unsupported_version' };
  }
  if (!isKnownAuthMode(input.mode)) {
    return { ok: false, holdLocalData: true, reason: 'unknown_mode' };
  }
  return { ok: true, mode: input.mode };
}
