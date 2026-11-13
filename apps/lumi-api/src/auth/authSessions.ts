import { randomBytes, randomUUID } from 'node:crypto';
import type { AppUserId } from '@lumi/contracts';

export type PendingLogin = {
  readonly state: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  readonly createdAtMs: number;
  readonly deviceId: string | null;
};

export type AuthSession = {
  readonly sessionId: string;
  readonly appUserId: AppUserId;
  readonly csrfToken: string;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
};

const PENDING_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** In-memory pending logins and BFF sessions — durable store comes with later ops work. */
export class AuthSessionStore {
  private readonly pending = new Map<string, PendingLogin>();
  private readonly sessions = new Map<string, AuthSession>();

  putPending(input: Omit<PendingLogin, 'createdAtMs'>): PendingLogin {
    const record: PendingLogin = { ...input, createdAtMs: Date.now() };
    this.pending.set(record.state, record);
    return record;
  }

  takePending(state: string): PendingLogin | null {
    const record = this.pending.get(state) ?? null;
    if (!record) return null;
    this.pending.delete(state);
    if (Date.now() - record.createdAtMs > PENDING_TTL_MS) return null;
    return record;
  }

  createSession(appUserId: AppUserId): AuthSession {
    const session: AuthSession = {
      sessionId: randomUUID(),
      appUserId,
      csrfToken: randomBytes(24).toString('base64url'),
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + SESSION_TTL_MS,
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  getSession(sessionId: string | undefined): AuthSession | null {
    if (!sessionId) return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() > session.expiresAtMs) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  revokeSession(sessionId: string | undefined): boolean {
    if (!sessionId) return false;
    return this.sessions.delete(sessionId);
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return rest.join('=');
  }
  return undefined;
}

export function sessionCookieHeader(name: string, value: string, maxAgeSec: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function clearCookieHeader(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
