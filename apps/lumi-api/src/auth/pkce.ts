import { createHash, randomBytes } from 'node:crypto';

/** Native OIDC authorization helpers — secrets never ship in the mobile app. */
export function createPkcePair(): { readonly verifier: string; readonly challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function createOidcState(): string {
  return randomBytes(24).toString('base64url');
}

export function isAllowedRedirectUri(candidate: string, allowed: readonly string[]): boolean {
  try {
    const url = new URL(candidate);
    if (url.hash) return false;
    return allowed.some((item) => item === candidate);
  } catch {
    return false;
  }
}
