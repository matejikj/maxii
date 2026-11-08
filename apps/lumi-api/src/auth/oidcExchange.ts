import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import type { ApiConfig } from '../config/env.ts';

export type ExchangedTokens = {
  readonly accessToken: string;
  readonly idToken: string | null;
  readonly subject: string;
  readonly expiresInSec: number;
};

type MockCode = {
  readonly subject: string;
  readonly redirectUri: string;
  readonly codeChallenge: string;
};

/**
 * Exchanges an authorization code with Keycloak (or a local mock IdP used in tests).
 * Client secrets never ship in the mobile app — only the BFF holds server credentials.
 */
export class OidcTokenExchanger {
  private readonly config: ApiConfig;
  private readonly mockCodes = new Map<string, MockCode>();

  constructor(config: ApiConfig) {
    this.config = config;
  }

  buildAuthorizationUrl(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
  }): string {
    if (this.config.oidcMock) {
      const url = new URL(`${this.config.publicBaseUrl}/v1/auth/mock/authorize`);
      url.searchParams.set('client_id', this.config.oidcClientId);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid');
      url.searchParams.set('state', input.state);
      url.searchParams.set('code_challenge', input.codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('redirect_uri', input.redirectUri);
      return url.toString();
    }
    const url = new URL(`${this.config.oidcIssuer}/protocol/openid-connect/auth`);
    url.searchParams.set('client_id', this.config.oidcClientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid');
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('redirect_uri', input.redirectUri);
    return url.toString();
  }

  recoveryUrl(): string {
    if (this.config.oidcMock) {
      return `${this.config.publicBaseUrl}/v1/auth/mock/recovery`;
    }
    return `${this.config.oidcIssuer}/login-actions/reset-credentials`;
  }

  /** Test/dev helper: mint a one-time code bound to PKCE challenge. */
  issueMockAuthorizationCode(input: {
    readonly subject: string;
    readonly redirectUri: string;
    readonly codeChallenge: string;
  }): string {
    const code = randomBytes(24).toString('base64url');
    this.mockCodes.set(code, {
      subject: input.subject,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
    });
    return code;
  }

  async exchangeAuthorizationCode(input: {
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<ExchangedTokens> {
    if (this.config.oidcMock || !this.config.oidcTokenUrl) {
      return this.exchangeMock(input);
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.oidcClientId,
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    });
    if (this.config.oidcClientSecret) {
      body.set('client_secret', this.config.oidcClientSecret);
    }

    const response = await fetch(this.config.oidcTokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      throw Object.assign(new Error('token_exchange_failed'), { code: 'unauthorized' });
    }
    const json = (await response.json()) as {
      access_token?: string;
      id_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw Object.assign(new Error('token_exchange_failed'), { code: 'unauthorized' });
    }
    const subject = await this.subjectFromAccessToken(json.access_token);
    return {
      accessToken: json.access_token,
      idToken: json.id_token ?? null,
      subject,
      expiresInSec: json.expires_in ?? 3600,
    };
  }

  private async exchangeMock(input: {
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<ExchangedTokens> {
    const record = this.mockCodes.get(input.code);
    this.mockCodes.delete(input.code);
    if (!record) {
      throw Object.assign(new Error('invalid_code'), { code: 'unauthorized' });
    }
    if (record.redirectUri !== input.redirectUri) {
      throw Object.assign(new Error('redirect_mismatch'), { code: 'forbidden' });
    }
    const challenge = createHash('sha256').update(input.codeVerifier).digest('base64url');
    if (challenge !== record.codeChallenge) {
      throw Object.assign(new Error('pkce_mismatch'), { code: 'unauthorized' });
    }
    if (!this.config.testHs256Secret) {
      throw Object.assign(new Error('mock_requires_test_secret'), { code: 'service_unavailable' });
    }
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await new SignJWT({ sub: record.subject, typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(this.config.oidcIssuer)
      .setAudience(this.config.oidcAudience)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setJti(randomUUID())
      .sign(new TextEncoder().encode(this.config.testHs256Secret));
    return {
      accessToken,
      idToken: null,
      subject: record.subject,
      expiresInSec: 3600,
    };
  }

  private async subjectFromAccessToken(accessToken: string): Promise<string> {
    const { decodeJwt } = await import('jose');
    const payload = decodeJwt(accessToken);
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw Object.assign(new Error('missing_subject'), { code: 'unauthorized' });
    }
    return payload.sub;
  }
}
