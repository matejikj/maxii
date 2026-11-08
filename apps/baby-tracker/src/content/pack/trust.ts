import type { TrustedPublicKey } from './types';

/**
 * Trusted content-pack public keys shipped with the app. Development keys are
 * rejected unless the verifier explicitly allows them (tests / local tooling).
 */
export const TRUSTED_CONTENT_PACK_KEYS: readonly TrustedPublicKey[] = [
  {
    keyId: 'lumi-content-ed25519-v1',
    publicKeyHex: 'e9c7c076ea7ce9f2484732907329cd58b8348af685344d1b5772e9dee0eff247',
    purpose: 'production',
  },
  {
    keyId: 'lumi-content-ed25519-dev-1',
    publicKeyHex: 'be6ae47569f66f40d0c11684f79119c3abe06e34bb79c56e43e28e230046c966',
    purpose: 'development',
  },
];

export function findTrustedKey(
  keyId: string,
  options: { allowDevelopmentKeys?: boolean } = {},
): TrustedPublicKey | null {
  const key = TRUSTED_CONTENT_PACK_KEYS.find((item) => item.keyId === keyId) ?? null;
  if (!key) return null;
  if (key.purpose === 'development' && !options.allowDevelopmentKeys) return null;
  return key;
}
