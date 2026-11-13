import type { FastifyInstance } from 'fastify';
import type { AppUserId, FamilyId, SyncCursor, SyncPushRequest } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import type { ApiConfig } from '../config/env.ts';
import type { AccessTokenVerifier } from '../auth/tokenVerifier.ts';
import type { AuthSessionStore } from '../auth/authSessions.ts';
import { readCookie } from '../auth/authSessions.ts';
import { verifyCsrfDoubleSubmit } from '../auth/csrf.ts';
import type { MemoryFamilyStore } from '../identity/store.ts';
import type { MemorySyncStore } from '../sync/syncStore.ts';
import { apiError } from './errors.ts';

type SyncRouteDeps = {
  readonly config: ApiConfig;
  readonly store: MemoryFamilyStore;
  readonly sync: MemorySyncStore;
  readonly tokens: AccessTokenVerifier;
  readonly sessions: AuthSessionStore;
};

export function registerSyncRoutes(app: FastifyInstance, deps: SyncRouteDeps): void {
  const { config, store, sync, tokens, sessions } = deps;

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
      const err = apiError('forbidden', 'Sync forbidden', requestId, { reason });
      return reply.code(err.status).send(err.body);
    }
    if (code === 'validation') {
      const err = apiError('validation', 'Invalid sync request', requestId, { reason });
      return reply.code(err.status).send(err.body);
    }
    throw error;
  }

  app.post('/v1/families/:familyId/sync/push', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string };
    const body = request.body as SyncPushRequest;
    if (body.protocolVersion !== LUMI_API_PROTOCOL_VERSION) {
      const err = apiError('unsupported_schema', 'Unsupported protocol', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    try {
      const result = await sync.push({
        familyId: params.familyId as FamilyId,
        appUserId,
        memberships: store.allMemberships(),
        attemptId: body.attemptId,
        operations: body.operations ?? [],
        ...(body.writerGeneration != null ? { writerGeneration: body.writerGeneration } : {}),
        now: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });

  app.get('/v1/families/:familyId/sync/pull', async (request, reply) => {
    const auth = await tokens.verifyAuthorizationHeader(request.headers.authorization);
    if (!auth.ok) {
      // Also allow cookie sessions for pull.
      const cookieHeader = request.headers.cookie ?? '';
      const session = sessions.getSession(readCookie(cookieHeader, config.sessionCookieName));
      if (!session) {
        const err = apiError('unauthorized', 'Authentication required', String(request.id));
        return reply.code(err.status).send(err.body);
      }
      return pullFor(session.appUserId);
    }
    return pullFor(auth.principal.appUserId);

    function pullFor(appUserId: AppUserId) {
      const params = request.params as { familyId: string };
      const query = request.query as { cursor?: string; limit?: string };
      try {
        const parsedLimit = query.limit ? Number(query.limit) : null;
        const result = sync.pull({
          familyId: params.familyId as FamilyId,
          appUserId,
          memberships: store.allMemberships(),
          cursor: (query.cursor as SyncCursor | undefined) ?? null,
          ...(parsedLimit != null && Number.isFinite(parsedLimit) ? { limit: parsedLimit } : {}),
        });
        if (result.resyncRequired) {
          const err = apiError(
            'resync_required',
            'Cursor epoch no longer matches family changelog',
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
    }
  });
}
