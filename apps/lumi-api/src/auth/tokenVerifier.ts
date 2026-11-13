import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AppUserId, DeviceId, SessionPrincipal } from '@lumi/contracts';
import { resolveActiveBinding } from '@lumi/contracts';
import type { ApiConfig } from '../config/env.ts';
import type { MemoryFamilyStore } from '../identity/store.ts';

export type TokenVerificationFailure =
  | 'missing'
  | 'malformed'
  | 'issuer_rejected'
  | 'audience_rejected'
  | 'token_expired'
  | 'unbound_subject'
  | 'revoked_user';

export type TokenVerificationResult =
  | { readonly ok: true; readonly principal: SessionPrincipal }
  | { readonly ok: false; readonly reason: TokenVerificationFailure };

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class AccessTokenVerifier {
  private readonly config: ApiConfig;
  private readonly store: MemoryFamilyStore;
  private readonly remoteJwks;

  constructor(config: ApiConfig, store: MemoryFamilyStore) {
    this.config = config;
    this.store = store;
    this.remoteJwks = config.oidcJwksUrl ? createRemoteJWKSet(new URL(config.oidcJwksUrl)) : null;
  }

  async verifyAuthorizationHeader(header: string | undefined): Promise<TokenVerificationResult> {
    if (!header?.startsWith('Bearer ')) return { ok: false, reason: 'missing' };
    const token = header.slice('Bearer '.length).trim();
    if (!token) return { ok: false, reason: 'missing' };

    let payload: JWTPayload;
    try {
      if (this.remoteJwks) {
        const verified = await jwtVerify(token, this.remoteJwks, {
          issuer: this.config.oidcIssuer,
          audience: this.config.oidcAudience,
        });
        payload = verified.payload;
      } else if (this.config.testHs256Secret) {
        const secret = new TextEncoder().encode(this.config.testHs256Secret);
        const verified = await jwtVerify(token, secret, {
          issuer: this.config.oidcIssuer,
          audience: this.config.oidcAudience,
          algorithms: ['HS256'],
        });
        payload = verified.payload;
      } else {
        return { ok: false, reason: 'malformed' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/\bexp\b|expir/i.test(message)) return { ok: false, reason: 'token_expired' };
      if (/\biss\b|issuer/i.test(message)) return { ok: false, reason: 'issuer_rejected' };
      if (/\baud\b|audience/i.test(message)) return { ok: false, reason: 'audience_rejected' };
      return { ok: false, reason: 'malformed' };
    }

    const issuer = asString(payload.iss);
    const subject = asString(payload.sub);
    if (!issuer || issuer !== this.config.oidcIssuer) {
      return { ok: false, reason: 'issuer_rejected' };
    }
    if (!subject) return { ok: false, reason: 'malformed' };

    const appUserId = resolveActiveBinding({
      bindings: this.store.bindings,
      issuer,
      subject,
    });
    if (!appUserId) return { ok: false, reason: 'unbound_subject' };

    const user = this.store.users.get(appUserId);
    if (!user || user.status !== 'active') return { ok: false, reason: 'revoked_user' };

    const deviceClaim = asString(payload.device_id) ?? asString(payload.deviceId);
    const expiresAt =
      typeof payload.exp === 'number'
        ? new Date(payload.exp * 1000).toISOString()
        : new Date(0).toISOString();

    return {
      ok: true,
      principal: {
        appUserId,
        deviceId: (deviceClaim as DeviceId | null) ?? null,
        issuer,
        subject,
        expiresAt,
      },
    };
  }

  /** Test helper: mint a local HS256 access token for synthetic principals. */
  async mintTestToken(input: {
    subject: string;
    appUserId: AppUserId;
    expiresInSec?: number;
    issuer?: string;
    audience?: string;
  }): Promise<string> {
    if (!this.config.testHs256Secret) {
      throw new Error('test HS256 secret is not configured');
    }
    const { SignJWT } = await import('jose');
    const now = Math.floor(Date.now() / 1000);
    this.store.ensureUser(input.appUserId, new Date().toISOString());
    this.store.bindExternal({
      appUserId: input.appUserId,
      issuer: input.issuer ?? this.config.oidcIssuer,
      subject: input.subject,
      now: new Date().toISOString(),
    });
    return new SignJWT({ sub: input.subject })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(input.issuer ?? this.config.oidcIssuer)
      .setAudience(input.audience ?? this.config.oidcAudience)
      .setIssuedAt(now)
      .setExpirationTime(now + (input.expiresInSec ?? 3600))
      .sign(new TextEncoder().encode(this.config.testHs256Secret));
  }
}
