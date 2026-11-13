import type { FastifyInstance } from 'fastify';
import type { AppUserId, ChildPrivateSyncPushRequest, SyncCursor } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import type { ApiConfig } from '../config/env.ts';
import type { AccessTokenVerifier } from '../auth/tokenVerifier.ts';
import type { AuthSessionStore } from '../auth/authSessions.ts';
import { readCookie } from '../auth/authSessions.ts';
import { verifyCsrfDoubleSubmit } from '../auth/csrf.ts';
import type { ChildPrivateSyncStorePort } from '../childPrivate/childPrivateSyncStore.ts';
import { apiError } from './errors.ts';

type ChildPrivateSyncRouteDeps = {
  readonly config: ApiConfig;
  readonly childPrivateSync: ChildPrivateSyncStorePort;
  readonly tokens: AccessTokenVerifier;
  readonly sessions: AuthSessionStore;
};

/**
 * Owner-scoped child-private sync. Intentionally not under /v1/families — the
 * private outbox must not travel on the family care endpoint.
 */
export function registerChildPrivateSyncRoutes(
  app: FastifyInstance,
  deps: ChildPrivateSyncRouteDeps,
): void {
  const { config, childPrivateSync, tokens, sessions } = deps;

  async function requireAppUser(
    request: {
      method: string;
      headers: Record<string, unknown>;
      id: unknown;
    },
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  ): Promise<AppUserId | null> {
    const usesBearer =
      typeof request.headers.authorization === 'string' &&
      String(request.headers.authorization).startsWith('Bearer ');
    const cookieHeader = typeof request.headers.cookie === 'string' ? request.headers.cookie : '';
    if (
      !verifyCsrfDoubleSubmit({
        method: request.method,
        cookieToken: readCookie(cookieHeader, config.csrfCookieName),
        headerToken:
          typeof request.headers['x-csrf-token'] === 'string'
            ? request.headers['x-csrf-token']
            : undefined,
        usesBearerAuth: usesBearer,
      })
    ) {
      const err = apiError('csrf_rejected', 'CSRF token mismatch', String(request.id));
      reply.code(err.status).send(err.body);
      return null;
    }
    if (usesBearer) {
      const auth = await tokens.verifyAuthorizationHeader(
        typeof request.headers.authorization === 'string'
          ? request.headers.authorization
          : undefined,
      );
      if (!auth.ok) {
        const err = apiError('unauthorized', 'Authentication required', String(request.id));
        reply.code(err.status).send(err.body);
        return null;
      }
      return auth.principal.appUserId;
    }
    const session = sessions.getSession(readCookie(cookieHeader, config.sessionCookieName));
    if (!session) {
      const err = apiError('unauthorized', 'Authentication required', String(request.id));
      reply.code(err.status).send(err.body);
      return null;
    }
    return session.appUserId;
  }

  function sendStoreError(
    error: unknown,
    requestId: string,
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  ): unknown {
    const code = (error as { code?: string }).code;
    const reason = (error as { reason?: string }).reason ?? 'request_failed';
    if (code === 'forbidden') {
      const err = apiError('forbidden', 'Child private sync forbidden', requestId, {
        reason,
      });
      return reply.code(err.status).send(err.body);
    }
    if (code === 'validation') {
      const err = apiError('validation', 'Invalid child private sync request', requestId, {
        reason,
      });
      return reply.code(err.status).send(err.body);
    }
    throw error;
  }

  app.post('/v1/child-private/sync/push', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const body = request.body as ChildPrivateSyncPushRequest;
    if (body.protocolVersion !== LUMI_API_PROTOCOL_VERSION) {
      const err = apiError('unsupported_schema', 'Unsupported protocol', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    try {
      // Session principal is the only trusted owner — never take owner from JSON.
      const result = await childPrivateSync.push({
        ownerAppUserId: appUserId,
        sessionAppUserId: appUserId,
        attemptId: body.attemptId,
        operations: body.operations ?? [],
        ...(body.writerGeneration != null ? { writerGeneration: body.writerGeneration } : {}),
        now: new Date().toISOString(),
      });
      reply.header('cache-control', 'no-store');
      return result;
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });

  app.get('/v1/child-private/sync/pull', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const query = request.query as { cursor?: string; limit?: string };
    try {
      const parsedLimit = query.limit ? Number(query.limit) : null;
      const result = await childPrivateSync.pull({
        sessionAppUserId: appUserId,
        cursor: (query.cursor as SyncCursor | undefined) ?? null,
        ...(parsedLimit != null && Number.isFinite(parsedLimit) ? { limit: parsedLimit } : {}),
      });
      if (result.resyncRequired) {
        const err = apiError(
          'resync_required',
          'Cursor epoch no longer matches child-private changelog',
          String(request.id),
          { epoch: result.epoch },
        );
        return reply.code(err.status).send({ ...err.body, sync: result });
      }
      reply.header('cache-control', 'no-store');
      return result;
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });
}
