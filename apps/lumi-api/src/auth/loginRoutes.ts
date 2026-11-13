import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { LUMI_AUTH_MODE_VERSION, type AppUserId } from '@lumi/contracts';
import type { ApiConfig } from '../config/env.ts';
import type { MemoryFamilyStore } from '../identity/store.ts';
import { apiError } from '../http/errors.ts';
import { createOidcState, isAllowedRedirectUri } from './pkce.ts';
import {
  AuthSessionStore,
  clearCookieHeader,
  readCookie,
  sessionCookieHeader,
} from './authSessions.ts';
import { OidcTokenExchanger } from './oidcExchange.ts';

export type AuthRouteDeps = {
  readonly config: ApiConfig;
  readonly store: MemoryFamilyStore;
  readonly sessions: AuthSessionStore;
  readonly oidc: OidcTokenExchanger;
};

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  const { config, store, sessions, oidc } = deps;

  app.get('/v1/auth/mode', async () => ({
    version: LUMI_AUTH_MODE_VERSION,
    mode: 'oidc_keycloak_v1',
    approvedOrigins: config.corsOrigins,
    nativeRedirectSchemes: config.allowedRedirectUris.filter((item) => item.includes('://')),
    recoveryUrl: oidc.recoveryUrl(),
  }));

  app.post('/v1/auth/login/start', async (request, reply) => {
    const body = request.body as {
      redirectUri?: string;
      deviceId?: string;
    };
    const redirectUri = body.redirectUri?.trim() ?? '';
    if (!isAllowedRedirectUri(redirectUri, config.allowedRedirectUris)) {
      const err = apiError('forbidden', 'Redirect URI is not allowed', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const state = createOidcState();
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    sessions.putPending({
      state,
      codeVerifier: verifier,
      redirectUri,
      deviceId: body.deviceId?.trim() || null,
    });
    return {
      state,
      authorizationUrl: oidc.buildAuthorizationUrl({
        state,
        codeChallenge: challenge,
        redirectUri,
      }),
    };
  });

  app.post('/v1/auth/login/callback', async (request, reply) => {
    const body = request.body as {
      code?: string;
      state?: string;
      redirectUri?: string;
      transport?: 'bearer' | 'cookie';
    };
    const pending = sessions.takePending(body.state?.trim() ?? '');
    if (!pending) {
      const err = apiError('unauthorized', 'Login state is missing or expired', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const redirectUri = body.redirectUri?.trim() ?? '';
    if (redirectUri !== pending.redirectUri) {
      const err = apiError('forbidden', 'Redirect URI mismatch', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    if (!isAllowedRedirectUri(redirectUri, config.allowedRedirectUris)) {
      const err = apiError('forbidden', 'Redirect URI is not allowed', String(request.id));
      return reply.code(err.status).send(err.body);
    }

    let exchanged;
    try {
      exchanged = await oidc.exchangeAuthorizationCode({
        code: body.code?.trim() ?? '',
        codeVerifier: pending.codeVerifier,
        redirectUri,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const err = apiError(
        code === 'forbidden' ? 'forbidden' : 'unauthorized',
        'Authorization code exchange failed',
        String(request.id),
      );
      return reply.code(err.status).send(err.body);
    }

    const now = new Date().toISOString();
    let appUserId = store.bindings.find(
      (item) =>
        item.issuer === config.oidcIssuer &&
        item.subject === exchanged.subject &&
        item.revokedAt == null,
    )?.appUserId;
    if (!appUserId) {
      appUserId = randomUUID() as AppUserId;
      store.ensureUser(appUserId, now);
      store.bindExternal({
        appUserId,
        issuer: config.oidcIssuer,
        subject: exchanged.subject,
        now,
      });
    } else {
      store.ensureUser(appUserId, now);
    }

    const expiresAt = new Date(Date.now() + exchanged.expiresInSec * 1000).toISOString();
    const transport = body.transport === 'cookie' ? 'cookie' : 'bearer';
    if (transport === 'cookie') {
      const session = sessions.createSession(appUserId);
      reply.header('set-cookie', [
        sessionCookieHeader(config.sessionCookieName, session.sessionId, 8 * 60 * 60),
        sessionCookieHeader(config.csrfCookieName, session.csrfToken, 8 * 60 * 60),
      ]);
      return {
        appUserId,
        expiresAt,
        transport: 'cookie',
        csrfToken: session.csrfToken,
      };
    }

    return {
      appUserId,
      expiresAt,
      transport: 'bearer',
      accessToken: exchanged.accessToken,
    };
  });

  app.get('/v1/auth/session', async (request, reply) => {
    const sessionId = readCookie(request.headers.cookie, config.sessionCookieName);
    const session = sessions.getSession(sessionId);
    if (!session) {
      const err = apiError('unauthorized', 'No active session', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    return {
      appUserId: session.appUserId,
      expiresAt: new Date(session.expiresAtMs).toISOString(),
      transport: 'cookie',
      // CSRF cookie is HttpOnly; clients keep this value in memory for headers.
      csrfToken: session.csrfToken,
    };
  });

  app.post('/v1/auth/logout', async (request, reply) => {
    const sessionId = readCookie(request.headers.cookie, config.sessionCookieName);
    sessions.revokeSession(sessionId);
    reply.header('set-cookie', [
      clearCookieHeader(config.sessionCookieName),
      clearCookieHeader(config.csrfCookieName),
    ]);
    // Local drafts stay in the personal workspace; logout never migrates them.
    return { preservedLocalDrafts: true as const };
  });

  if (config.oidcMock) {
    app.get('/v1/auth/mock/authorize', async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const redirectUri = query.redirect_uri?.trim() ?? '';
      const codeChallenge = query.code_challenge?.trim() ?? '';
      const state = query.state?.trim() ?? '';
      if (!redirectUri || !codeChallenge || !state) {
        const err = apiError(
          'validation',
          'Mock authorize requires redirect and PKCE',
          String(request.id),
        );
        return reply.code(err.status).send(err.body);
      }
      const code = oidc.issueMockAuthorizationCode({
        subject: query.login_hint?.trim() || 'mock-subject',
        redirectUri,
        codeChallenge,
      });
      const target = new URL(redirectUri);
      target.searchParams.set('code', code);
      target.searchParams.set('state', state);
      return reply.redirect(target.toString());
    });

    app.get('/v1/auth/mock/recovery', async () => ({
      message: 'Mock recovery page — configure Keycloak for real password reset e-mail.',
    }));

    app.post('/v1/auth/mock/issue-code', async (request, reply) => {
      const body = request.body as {
        subject?: string;
        redirectUri?: string;
        codeChallenge?: string;
      };
      if (!body.redirectUri || !body.codeChallenge) {
        const err = apiError('validation', 'Missing mock code fields', String(request.id));
        return reply.code(err.status).send(err.body);
      }
      return {
        code: oidc.issueMockAuthorizationCode({
          subject: body.subject?.trim() || 'mock-subject',
          redirectUri: body.redirectUri,
          codeChallenge: body.codeChallenge,
        }),
      };
    });
  }
}
