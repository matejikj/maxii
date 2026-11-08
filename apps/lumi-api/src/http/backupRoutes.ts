import type { FastifyInstance } from 'fastify';
import type {
  AppUserId,
  FamilyId,
  RemoteBackupStatusResponse,
} from '@lumi/contracts';
import {
  BACKUP_RETENTION_DAYS,
  LUMI_API_PROTOCOL_VERSION,
  authorizeFamilyAccess,
  authorizeFamilyAdminAction,
} from '@lumi/contracts';
import type { ApiConfig } from '../config/env.ts';
import type { AccessTokenVerifier } from '../auth/tokenVerifier.ts';
import type { AuthSessionStore } from '../auth/authSessions.ts';
import { readCookie } from '../auth/authSessions.ts';
import { verifyCsrfDoubleSubmit } from '../auth/csrf.ts';
import type { MemoryFamilyStore } from '../identity/store.ts';
import type { BackupRepositoryPort } from '../backup/logicalExport.ts';
import { buildLogicalBackupPayload } from '../backup/logicalExport.ts';
import type { ErasureRegistryPort } from '../backup/erasureRegistry.ts';
import { buildRecoveryPreview } from '../backup/restorePipeline.ts';
import { eraseFamilyWithDurableRegistry } from '../backup/eraseFamilyService.ts';
import { apiError } from './errors.ts';

type BackupRouteDeps = {
  readonly config: ApiConfig;
  readonly store: MemoryFamilyStore;
  readonly tokens: AccessTokenVerifier;
  readonly sessions: AuthSessionStore;
  readonly backups: BackupRepositoryPort;
  readonly erasureRegistry: ErasureRegistryPort;
  readonly backupStatusByFamily: Map<
    string,
    {
      lastCompletedAt: string | null;
      lastAttemptAt: string | null;
      lastAttemptStatus: RemoteBackupStatusResponse['lastAttemptStatus'];
      scope: RemoteBackupStatusResponse['scope'];
    }
  >;
};

export function registerBackupRoutes(app: FastifyInstance, deps: BackupRouteDeps): void {
  const { config, store, tokens, sessions, backups, erasureRegistry, backupStatusByFamily } =
    deps;

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

  app.get('/v1/families/:familyId/backup-status', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string };
    const decision = authorizeFamilyAccess({
      memberships: store.allMemberships(),
      appUserId,
      familyId: params.familyId as FamilyId,
    });
    if (!decision.allow) {
      const err = apiError('forbidden', 'Not a member of this family', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const status = backupStatusByFamily.get(params.familyId) ?? {
      lastCompletedAt: null,
      lastAttemptAt: null,
      lastAttemptStatus: 'idle' as const,
      scope: 'none' as const,
    };
    const body: RemoteBackupStatusResponse = {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      familyId: params.familyId,
      lastCompletedAt: status.lastCompletedAt,
      lastAttemptAt: status.lastAttemptAt,
      lastAttemptStatus: status.lastAttemptStatus,
      retentionDays: BACKUP_RETENTION_DAYS,
      scope: status.scope,
      claimsOtherDevicesSynced: false,
    };
    return body;
  });

  app.post('/v1/families/:familyId/recovery/preview', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string };
    const admin = authorizeFamilyAdminAction({
      memberships: store.allMemberships(),
      appUserId,
      familyId: params.familyId as FamilyId,
      action: 'recovery_preview',
    });
    if (!admin.allow) {
      const err = apiError('forbidden', 'Action not allowed', String(request.id), {
        reason: admin.reason,
      });
      return reply.code(err.status).send(err.body);
    }
    const body = request.body as { backupId?: string };
    if (!body.backupId?.trim()) {
      const err = apiError('validation', 'backupId required', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const archive = await backups.readFamilyArchive({
      backupId: body.backupId,
      requestingFamilyId: params.familyId,
    });
    if (archive && typeof archive === 'object' && 'denied' in archive) {
      const err = apiError('forbidden', 'Archive belongs to another family', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const registry = await erasureRegistry.load();
    const payload = buildLogicalBackupPayload({
      appTables: { family: params.familyId },
      identityTables: {},
      exportedAt: new Date().toISOString(),
    });
    return buildRecoveryPreview({
      familyId: params.familyId,
      backupId: body.backupId,
      archivePayload: payload,
      registry,
    });
  });

  app.get('/v1/families/:familyId/archives/:backupId', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string; backupId: string };
    const decision = authorizeFamilyAccess({
      memberships: store.allMemberships(),
      appUserId,
      familyId: params.familyId as FamilyId,
    });
    if (!decision.allow) {
      const err = apiError('forbidden', 'Not a member of this family', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const archive = await backups.readFamilyArchive({
      backupId: params.backupId,
      requestingFamilyId: params.familyId,
    });
    if (archive && typeof archive === 'object' && 'denied' in archive) {
      const err = apiError('forbidden', 'Archive belongs to another family', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    if (!archive) {
      const err = apiError('not_found', 'Archive not found', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    // Signed URL style responses are never returned for a foreign family.
    return {
      backupId: params.backupId,
      familyId: params.familyId,
      bytes: archive.byteLength,
    };
  });

  // Replace the basic erasure route with registry-first confirmation.
  app.post('/v1/families/:familyId/erasure', async (request, reply) => {
    const appUserId = await requireAppUser(request, reply);
    if (!appUserId) return;
    const params = request.params as { familyId: string };
    try {
      const result = await eraseFamilyWithDurableRegistry({
        store,
        registry: erasureRegistry,
        actorId: appUserId,
        familyId: params.familyId as FamilyId,
        now: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'registry_unavailable') {
        const err = apiError(
          'service_unavailable',
          'Erasure registry unavailable; live family untouched',
          String(request.id),
          { liveDataMutated: false },
        );
        return reply.code(err.status).send(err.body);
      }
      if (code === 'forbidden') {
        const err = apiError('forbidden', 'Action not allowed', String(request.id), {
          reason: (error as { reason?: string }).reason ?? 'forbidden',
        });
        return reply.code(err.status).send(err.body);
      }
      if (code === 'not_found') {
        const err = apiError('not_found', 'Not found', String(request.id));
        return reply.code(err.status).send(err.body);
      }
      throw error;
    }
  });
}
