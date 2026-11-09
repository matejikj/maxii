import type { FastifyInstance } from 'fastify';
import {
  LUMI_API_PROTOCOL_VERSION,
  authorizeFamilyAccess,
  type AppUserId,
  type AttachmentRenditionRole,
  type FamilyAttachmentFinalizeRequest,
  type FamilyAttachmentTombstoneRequest,
  type FamilyAttachmentUploadIntentRequest,
  type FamilyId,
} from '@lumi/contracts';
import type { ApiConfig } from '../config/env.ts';
import type { AccessTokenVerifier } from '../auth/tokenVerifier.ts';
import type { AuthSessionStore } from '../auth/authSessions.ts';
import { readCookie } from '../auth/authSessions.ts';
import { verifyCsrfDoubleSubmit } from '../auth/csrf.ts';
import type { MemoryFamilyStore } from '../identity/store.ts';
import type { FamilyAttachmentService } from '../attachments/attachmentService.ts';
import { apiError } from './errors.ts';

type AttachmentRouteDeps = {
  readonly config: ApiConfig;
  readonly store: MemoryFamilyStore;
  readonly tokens: AccessTokenVerifier;
  readonly sessions: AuthSessionStore;
  readonly attachments: FamilyAttachmentService;
};

export function registerAttachmentRoutes(app: FastifyInstance, deps: AttachmentRouteDeps): void {
  const { config, store, tokens, sessions, attachments } = deps;

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
    const cookieHeader =
      typeof request.headers.cookie === 'string' ? request.headers.cookie : '';

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

  function membershipOf(appUserId: AppUserId, familyId: FamilyId) {
    const decision = authorizeFamilyAccess({
      memberships: store.allMemberships(),
      appUserId,
      familyId,
    });
    if (!decision.allow) return { active: false as const, role: null };
    return { active: true as const, role: decision.role };
  }

  app.get('/v1/families/:familyId/attachments/quota', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string };
    const membership = membershipOf(appUserId, params.familyId as FamilyId);
    if (!membership.active) {
      const err = apiError('forbidden', 'Not a member of this family', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    return attachments.quotaView(params.familyId);
  });

  app.post('/v1/families/:familyId/attachments/intents', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string };
    const body = request.body as FamilyAttachmentUploadIntentRequest;
    if (body?.protocolVersion !== LUMI_API_PROTOCOL_VERSION) {
      const err = apiError('unsupported_schema', 'Unsupported protocol version', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const membership = membershipOf(appUserId, params.familyId as FamilyId);
    const created = await attachments.createIntent({
      familyId: params.familyId,
      appUserId,
      membership,
      attachmentId: String(body.attachmentId ?? ''),
      childId: String(body.childId ?? ''),
      eventId: String(body.eventId ?? ''),
      role: body.role,
      expectedBytes: Number(body.expectedBytes),
      expectedSha256: String(body.expectedSha256 ?? ''),
      nowMs: Date.now(),
      idempotencyKey: String(body.idempotencyKey ?? ''),
    });
    if (!created.ok) {
      const err = apiError(created.code, created.message, String(request.id), created.details);
      return reply.code(err.status).send(err.body);
    }
    return reply.code(201).send(created.response);
  });

  app.put(
    '/v1/families/:familyId/attachments/intents/:intentId',
    {
      // Rendition bytes are small JPEGs; keep this route above the JSON body cap.
      bodyLimit: 3 * 1024 * 1024 + 64 * 1024,
    },
    async (request, reply) => {
      const appUserId = await requireAppUser(request, reply);
      if (!appUserId) return;
      const params = request.params as { familyId: string; intentId: string };
      const membership = membershipOf(appUserId, params.familyId as FamilyId);
      const raw = request.body;
      const bytes =
        raw instanceof Uint8Array
          ? raw
          : Buffer.isBuffer(raw)
            ? new Uint8Array(raw)
            : typeof raw === 'string'
              ? new TextEncoder().encode(raw)
              : null;
      if (!bytes) {
        const err = apiError('validation', 'Binary JPEG body required', String(request.id));
        return reply.code(err.status).send(err.body);
      }
      const uploaded = await attachments.uploadBytes({
        intentId: params.intentId,
        appUserId,
        membership,
        bytes,
        nowMs: Date.now(),
      });
      if (!uploaded.ok) {
        const err = apiError(uploaded.code, uploaded.message, String(request.id));
        return reply.code(err.status).send(err.body);
      }
      return { ok: true, protocolVersion: LUMI_API_PROTOCOL_VERSION };
    },
  );

  app.post('/v1/families/:familyId/attachments/intents/:intentId/finalize', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string; intentId: string };
    const body = request.body as FamilyAttachmentFinalizeRequest;
    if (body?.protocolVersion !== LUMI_API_PROTOCOL_VERSION) {
      const err = apiError('unsupported_schema', 'Unsupported protocol version', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const membership = membershipOf(appUserId, params.familyId as FamilyId);
    const finalized = await attachments.finalize({
      intentId: params.intentId,
      appUserId,
      membership,
      sha256: String(body.sha256 ?? ''),
      byteLength: Number(body.byteLength),
      nowMs: Date.now(),
    });
    if (!finalized.ok) {
      const err = apiError(finalized.code, finalized.message, String(request.id));
      return reply.code(err.status).send(err.body);
    }
    return finalized.response;
  });

  app.get(
    '/v1/families/:familyId/attachments/:attachmentId/:role',
    async (request, reply) => {
      const appUserId = await requireAppUser(request, reply);
      if (!appUserId) return;
      const params = request.params as {
        familyId: string;
        attachmentId: string;
        role: AttachmentRenditionRole;
      };
      if (params.role !== 'display' && params.role !== 'thumbnail') {
        const err = apiError('validation', 'Unknown rendition role', String(request.id));
        return reply.code(err.status).send(err.body);
      }
      const membership = membershipOf(appUserId, params.familyId as FamilyId);
      const read = await attachments.read({
        familyId: params.familyId,
        attachmentId: params.attachmentId,
        role: params.role,
        membership,
      });
      if (!read.ok) {
        const err = apiError(read.code, read.message, String(request.id));
        return reply.code(err.status).send(err.body);
      }
      reply.header('content-type', 'image/jpeg');
      reply.header('cache-control', 'private, no-store');
      reply.header('x-lumi-attachment-sha256', read.meta.sha256);
      reply.header('x-lumi-attachment-bytes', String(read.meta.byteLength));
      return reply.send(Buffer.from(read.bytes));
    },
  );

  app.post('/v1/families/:familyId/attachments/:attachmentId/tombstone', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string; attachmentId: string };
    const body = request.body as FamilyAttachmentTombstoneRequest;
    if (body?.protocolVersion !== LUMI_API_PROTOCOL_VERSION) {
      const err = apiError('unsupported_schema', 'Unsupported protocol version', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const membership = membershipOf(appUserId, params.familyId as FamilyId);
    const erased = await attachments.tombstone({
      familyId: params.familyId,
      attachmentId: params.attachmentId,
      membership,
      eraseGeneration: Number(body.eraseGeneration ?? 0),
    });
    if (!erased.ok) {
      const err = apiError(erased.code, erased.message, String(request.id));
      return reply.code(err.status).send(err.body);
    }
    return {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attachmentId: params.attachmentId,
      removed: erased.removed,
    };
  });
}
