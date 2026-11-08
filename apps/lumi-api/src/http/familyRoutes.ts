import type { FastifyInstance } from 'fastify';
import type {
  AcceptInvitationRequest,
  AppUserId,
  CreateInvitationRequest,
  FamilyId,
  LinkExternalIdentityRequest,
  MembershipId,
  TransferAdminRequest,
} from '@lumi/contracts';
import { authorizeFamilyAccess, LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import type { ApiConfig } from '../config/env.ts';
import type { AccessTokenVerifier } from '../auth/tokenVerifier.ts';
import type { AuthSessionStore } from '../auth/authSessions.ts';
import { readCookie } from '../auth/authSessions.ts';
import { verifyCsrfDoubleSubmit } from '../auth/csrf.ts';
import type { MemoryFamilyStore } from '../identity/store.ts';
import { apiError } from './errors.ts';

type FamilyRouteDeps = {
  readonly config: ApiConfig;
  readonly store: MemoryFamilyStore;
  readonly tokens: AccessTokenVerifier;
  readonly sessions: AuthSessionStore;
};

export function registerFamilyRoutes(app: FastifyInstance, deps: FamilyRouteDeps): void {
  const { config, store, tokens, sessions } = deps;

  async function requireAppUser(
    request: {
      method: string;
      headers: Record<string, unknown>;
      id: unknown;
    },
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  ): Promise<AppUserId | null> {
    const usesBearer = typeof request.headers.authorization === 'string'
      && String(request.headers.authorization).startsWith('Bearer ');
    const cookieHeader = typeof request.headers.cookie === 'string' ? request.headers.cookie : '';

    if (!verifyCsrfDoubleSubmit({
      method: request.method,
      cookieToken: readCookie(cookieHeader, config.csrfCookieName),
      headerToken: typeof request.headers['x-csrf-token'] === 'string'
        ? request.headers['x-csrf-token']
        : undefined,
      usesBearerAuth: usesBearer,
    })) {
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
    if (code === 'validation' || code === 'unsupported_schema') {
      const err = apiError(
        code === 'validation' ? 'validation' : 'unsupported_schema',
        'Invalid family request',
        requestId,
        { reason },
      );
      return reply.code(err.status).send(err.body);
    }
    if (code === 'forbidden') {
      const err = apiError('forbidden', 'Action not allowed', requestId, { reason });
      return reply.code(err.status).send(err.body);
    }
    if (code === 'not_found') {
      const err = apiError('not_found', 'Not found', requestId, { reason });
      return reply.code(err.status).send(err.body);
    }
    if (code === 'conflict') {
      const err = apiError('conflict', 'Conflict', requestId, { reason });
      return reply.code(err.status).send(err.body);
    }
    throw error;
  }

  app.get('/v1/families/:familyId/members', async (request, reply) => {
    const auth = await tokens.verifyAuthorizationHeader(request.headers.authorization);
    if (!auth.ok) {
      const err = apiError('unauthorized', 'Authentication required', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const params = request.params as { familyId: string };
    const decision = authorizeFamilyAccess({
      memberships: store.allMemberships(),
      appUserId: auth.principal.appUserId,
      familyId: params.familyId as FamilyId,
    });
    if (!decision.allow) {
      const err = apiError('forbidden', 'Not a member of this family', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    return { members: store.listMembers(params.familyId as FamilyId) };
  });

  app.post('/v1/families/:familyId/invitations', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string };
    try {
      const created = store.createInvitation(
        appUserId,
        params.familyId as FamilyId,
        request.body as CreateInvitationRequest,
        new Date().toISOString(),
      );
      return reply.code(created.created ? 201 : 200).send(created);
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });

  app.post('/v1/families/:familyId/invitations/:invitationId/revoke', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string; invitationId: string };
    try {
      const revoked = store.revokeInvitation(
        appUserId,
        params.familyId as FamilyId,
        params.invitationId as never,
        new Date().toISOString(),
      );
      return { revoked };
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });

  app.post('/v1/invitations/preview', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const body = request.body as { oneTimeToken?: string };
    if (!body.oneTimeToken) {
      const err = apiError('validation', 'Token required', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    try {
      return store.previewInvitation(body.oneTimeToken, new Date().toISOString());
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });

  app.post('/v1/invitations/accept', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    try {
      const accepted = store.acceptInvitation(
        appUserId,
        request.body as AcceptInvitationRequest,
        new Date().toISOString(),
      );
      return reply.code(accepted.created ? 201 : 200).send(accepted);
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });

  app.post('/v1/families/:familyId/members/:membershipId/revoke', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string; membershipId: string };
    try {
      return store.revokeMembership(
        appUserId,
        params.familyId as FamilyId,
        params.membershipId as MembershipId,
      );
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });

  app.post('/v1/families/:familyId/transfer-admin', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string };
    const body = request.body as TransferAdminRequest;
    if (body.protocolVersion !== LUMI_API_PROTOCOL_VERSION) {
      const err = apiError('unsupported_schema', 'Unsupported protocol', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    try {
      return store.transferAdmin(
        appUserId,
        params.familyId as FamilyId,
        body.targetMembershipId,
        new Date().toISOString(),
      );
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });

  app.post('/v1/families/:familyId/erasure', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string };
    try {
      const result = store.eraseFamily(
        appUserId,
        params.familyId as FamilyId,
        new Date().toISOString(),
      );
      return reply.code(result.erased ? 200 : 200).send(result);
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });

  app.post('/v1/me/identities/link', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const body = request.body as LinkExternalIdentityRequest;
    if (body.protocolVersion !== LUMI_API_PROTOCOL_VERSION) {
      const err = apiError('unsupported_schema', 'Unsupported protocol', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    if (!body.issuer?.trim() || !body.subject?.trim()) {
      const err = apiError('validation', 'Issuer and subject required', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    try {
      const linked = store.linkAdditionalIssuer({
        appUserId,
        issuer: body.issuer.trim(),
        subject: body.subject.trim(),
        now: new Date().toISOString(),
      });
      return linked;
    } catch (error) {
      return sendStoreError(error, String(request.id), reply);
    }
  });
}
