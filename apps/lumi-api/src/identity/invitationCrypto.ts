import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { LUMI_API_LIMITS } from '@lumi/contracts';

/** One-time invitation secret. Only the hash is persisted. */
export function mintInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(LUMI_API_LIMITS.invitationTokenBytes).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function invitationTokenMatches(token: string, tokenHash: string): boolean {
  const actual = Buffer.from(hashInvitationToken(token), 'utf8');
  const expected = Buffer.from(tokenHash, 'utf8');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
