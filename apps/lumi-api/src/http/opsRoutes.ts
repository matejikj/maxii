import type { FastifyInstance } from 'fastify';
import type { ApiConfig } from '../config/env.ts';
import type { FamilyOpsMetrics } from '../ops/familyMetrics.ts';
import { evaluateFamilyAlerts } from '../ops/familyAlerts.ts';
import { apiError } from './errors.ts';

function authorizeOps(config: ApiConfig, header: string | string[] | undefined): boolean {
  const token = config.opsBearerToken;
  if (!token) return false;
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') return false;
  return value === `Bearer ${token}`;
}

export function registerOpsRoutes(
  app: FastifyInstance,
  input: {
    readonly config: ApiConfig;
    readonly metrics: FamilyOpsMetrics;
    readonly offHostProbeConfigured: boolean;
  },
): void {
  const { config, metrics, offHostProbeConfigured } = input;

  app.get('/v1/ops/metrics', async (request, reply) => {
    if (!authorizeOps(config, request.headers.authorization)) {
      const err = apiError('unauthorized', 'Ops token required', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    return {
      format: 'lumi.family-ops-metrics.v1',
      snapshot: metrics.snapshot(),
    };
  });

  app.get('/v1/ops/alerts', async (request, reply) => {
    if (!authorizeOps(config, request.headers.authorization)) {
      const err = apiError('unauthorized', 'Ops token required', String(request.id));
      return reply.code(err.status).send(err.body);
    }
    const snapshot = metrics.snapshot();
    return {
      format: 'lumi.family-ops-alerts.v1',
      evaluation: evaluateFamilyAlerts(snapshot, {
        offHostProbeConfigured,
      }),
    };
  });
}
