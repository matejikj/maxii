import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import {
  LUMI_API_LIMITS,
  LUMI_API_PROTOCOL_VERSION,
  authorizeFamilyAccess,
  type AppUserId,
  type CreateFamilyRequest,
  type FamilyId,
  type HealthResponse,
  type ReadinessResponse,
} from '@lumi/contracts';
import type { ApiConfig } from '../config/env.ts';
import { AccessTokenVerifier } from '../auth/tokenVerifier.ts';
import { AuthSessionStore, readCookie } from '../auth/authSessions.ts';
import { OidcTokenExchanger } from '../auth/oidcExchange.ts';
import { registerAuthRoutes } from '../auth/loginRoutes.ts';
import { verifyCsrfDoubleSubmit } from '../auth/csrf.ts';
import { MemoryFamilyStore } from '../identity/store.ts';
import { apiError } from './errors.ts';
import { createFixedWindowRateLimiter } from './rateLimit.ts';

export type CreatedApi = {
  readonly app: ReturnType<typeof Fastify>;
  readonly store: MemoryFamilyStore;
  readonly tokens: AccessTokenVerifier;
  readonly sessions: AuthSessionStore;
  readonly oidc: OidcTokenExchanger;
};

export async function createFamilyApi(config: ApiConfig): Promise<CreatedApi> {
  const store = new MemoryFamilyStore();
  const tokens = new AccessTokenVerifier(config, store);
  const sessions = new AuthSessionStore();
  const oidc = new OidcTokenExchanger(config);
  const rateLimiter = createFixedWindowRateLimiter({
    limit: config.rateLimitPerWindow,
    windowMs: config.rateLimitWindowMs,
  });
  const app = Fastify({
    logger: false,
    bodyLimit: LUMI_API_LIMITS.maxJsonBodyBytes,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
    connectionTimeout: config.requestTimeoutMs,
    requestTimeout: config.requestTimeoutMs,
  });

  registerAuthRoutes(app, { config, store, sessions, oidc });

  app.addHook('onRequest', async (request, reply) => {
    const clientKey = request.ip || 'unknown';
    if (!request.url.startsWith('/health') && !request.url.startsWith('/ready')) {
      const limited = rateLimiter.check(clientKey);
      if (!limited.allowed) {
        reply.header('retry-after', String(limited.retryAfterSec));
        const err = apiError('rate_limited', 'Too many requests', String(request.id), {
          retryAfterSec: limited.retryAfterSec,
        });
        return reply.code(err.status).send(err.body);
      }
    }

    const origin = request.headers.origin;
    if (typeof origin === 'string' && config.corsOrigins.length > 0) {
      if (!config.corsOrigins.includes(origin)) {
        const err = apiError('forbidden', 'Origin is not allowed', String(request.id));
        return reply.code(err.status).send(err.body);
      }
      reply.header('access-control-allow-origin', origin);
      reply.header('vary', 'Origin');
      reply.header('access-control-allow-credentials', 'true');
    }
  });

  app.get('/health', async (): Promise<HealthResponse> => ({
    ok: true,
    protocolVersion: LUMI_API_PROTOCOL_VERSION,
    role: config.role,
    time: new Date().toISOString(),
  }));

  app.get('/ready', async (): Promise<ReadinessResponse> => {
    const checks: Record<string, 'ok' | 'fail' | 'skip'> = {
      identityStore: 'ok',
      database: config.databaseUrl ? 'ok' : 'skip',
      oidc: config.oidcJwksUrl || config.testHs256Secret ? 'ok' : 'fail',
    };
    return {
      ready: checks.oidc !== 'fail',
      checks,
    };
  });

  app.get('/v1/me', async (request, reply) => {
    const auth = await tokens.verifyAuthorizationHeader(request.headers.authorization);
    if (!auth.ok) {
      const code = auth.reason === 'token_expired'
        ? 'token_expired'
        : auth.reason === 'issuer_rejected'
          ? 'issuer_rejected'
          : 'unauthorized';
      const err = apiError(code, 'Authentication required', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    return {
      appUserId: auth.principal.appUserId,
      issuer: auth.principal.issuer,
      expiresAt: auth.principal.expiresAt,
      memberships: store.listMemberships(auth.principal.appUserId).map((item) => ({
        familyId: item.familyId,
        role: item.role,
        status: item.status,
      })),
    };
  });

  app.post('/v1/families', async (request, reply) => {
    const usesBearer = typeof request.headers.authorization === 'string'
      && request.headers.authorization.startsWith('Bearer ');
    const cookieHeader = request.headers.cookie ?? '';
    if (!verifyCsrfDoubleSubmit({
      method: request.method,
      cookieToken: readCookie(cookieHeader, config.csrfCookieName),
      headerToken: typeof request.headers['x-csrf-token'] === 'string'
        ? request.headers['x-csrf-token']
        : undefined,
      usesBearerAuth: usesBearer,
    })) {
      const err = apiError('csrf_rejected', 'CSRF token mismatch', String(request.id));
      return reply.code(err.status).send(err.body);
    }

    let appUserId: AppUserId | null = null;
    if (usesBearer) {
      const auth = await tokens.verifyAuthorizationHeader(request.headers.authorization);
      if (!auth.ok) {
        const err = apiError('unauthorized', 'Authentication required', String(request.id));
        return reply.code(err.status).send(err.body);
      }
      appUserId = auth.principal.appUserId;
    } else {
      const session = sessions.getSession(readCookie(cookieHeader, config.sessionCookieName));
      if (!session) {
        const err = apiError('unauthorized', 'Authentication required', String(request.id));
        return reply.code(err.status).send(err.body);
      }
      appUserId = session.appUserId;
    }

    const body = request.body as CreateFamilyRequest;
    try {
      const created = store.createFamily(appUserId, body, new Date().toISOString());
      return reply.code(created.created ? 201 : 200).send(created);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'validation' || code === 'unsupported_schema') {
        const err = apiError(
          code === 'validation' ? 'validation' : 'unsupported_schema',
          'Invalid create-family request',
          String(request.id),
        );
        return reply.code(err.status).send(err.body);
      }
      throw error;
    }
  });

  app.get('/v1/families/:familyId/objects/:objectId', async (request, reply) => {
    const auth = await tokens.verifyAuthorizationHeader(request.headers.authorization);
    if (!auth.ok) {
      const err = apiError('unauthorized', 'Authentication required', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const params = request.params as { familyId: string; objectId: string };
    const decision = authorizeFamilyAccess({
      memberships: store.allMemberships(),
      appUserId: auth.principal.appUserId,
      familyId: params.familyId as FamilyId,
    });
    if (!decision.allow) {
      const err = apiError('forbidden', 'Not a member of this family', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const object = store.getObject(params.objectId);
    if (!object || object.familyId !== params.familyId) {
      const err = apiError('not_found', 'Object not found', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    return object;
  });

  /** Synthetic helper used by isolation tests — not a public product route. */
  app.post('/v1/test/seed-object', async (request, reply) => {
    if (!config.testHs256Secret) {
      const err = apiError('not_found', 'Not available', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const body = request.body as { familyId: FamilyId; label: string };
    const object = store.addObject(body.familyId, 'note', body.label, new Date().toISOString());
    return reply.code(201).send(object);
  });

  app.post('/v1/test/bind', async (request, reply) => {
    if (!config.testHs256Secret) {
      const err = apiError('not_found', 'Not available', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const body = request.body as {
      appUserId: AppUserId;
      issuer: string;
      subject: string;
    };
    store.ensureUser(body.appUserId, new Date().toISOString());
    store.bindExternal({
      appUserId: body.appUserId,
      issuer: body.issuer,
      subject: body.subject,
      now: new Date().toISOString(),
    });
    return { ok: true };
  });

  return { app, store, tokens, sessions, oidc };
}
