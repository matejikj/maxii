import { loadApiConfig } from '../config/env.ts';
import {
  LOCAL_COMPOSE_STACK_DRILL_DEFAULTS,
  runFamilyComposeStackDrill,
  type FamilyComposeStackDrillCase,
} from '../ops/familyComposeStackDrill.ts';
import { resolveAttachmentObjectStore } from './resolveAttachmentObjectStore.ts';
import {
  LOCAL_HTTP_S3_ATTACHMENT_DRILL_DEFAULTS,
  runAttachmentHttpS3CompatibleDrill,
  type AttachmentHttpS3CompatibleDrillCase,
} from './attachmentHttpS3CompatibleDrill.ts';

export type AttachmentComposeStackDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type AttachmentComposeStackDrillResult = {
  readonly ok: boolean;
  /** Local stack never claims Cloudflare R2 readiness. */
  readonly cloudflareR2Ready: false;
  /** Local Compose never claims family ops liveReady. */
  readonly liveReady: false;
  readonly softwareReady: boolean;
  readonly cases: readonly AttachmentComposeStackDrillCase[];
};

function mapCases(
  prefix: string,
  rows: readonly FamilyComposeStackDrillCase[] | readonly AttachmentHttpS3CompatibleDrillCase[],
): AttachmentComposeStackDrillCase[] {
  return rows.map((row) => ({
    name: `${prefix}.${row.name}`,
    ok: row.ok,
    detail: row.detail,
  }));
}

/**
 * Combined local Compose proof for family photos: Postgres schema/RLS plus the
 * authenticated HTTP attachment path against S3Mock. Personal boots stay on the
 * memory object store; this drill is an explicit gated stack check — not live R2.
 */
export async function runAttachmentComposeStackDrill(input: {
  readonly databaseUrl: string;
  readonly adminDatabaseUrl: string;
  readonly s3Endpoint: string;
  readonly deployDir: string;
  readonly region?: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}): Promise<AttachmentComposeStackDrillResult> {
  const cases: AttachmentComposeStackDrillCase[] = [];

  const personal = resolveAttachmentObjectStore(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'compose-attachment-personal-cold',
    } as NodeJS.ProcessEnv),
  );
  cases.push({
    name: 'personal_cold_memory_default',
    ok: personal.provider === 'memory',
    detail:
      personal.provider === 'memory'
        ? 'unset attachment store stays memory for personal boots'
        : `expected memory, got ${personal.provider}`,
  });

  const compose = await runFamilyComposeStackDrill({
    databaseUrl: input.databaseUrl,
    adminDatabaseUrl: input.adminDatabaseUrl,
    s3Endpoint: input.s3Endpoint,
    deployDir: input.deployDir,
  });
  cases.push(...mapCases('compose', compose.cases));
  cases.push({
    name: 'compose_live_ready_stays_false',
    ok: compose.liveReady === false,
    detail: compose.liveReady
      ? 'local compose must not claim liveReady'
      : 'liveReady=false',
  });

  if (!compose.ok) {
    return {
      ok: false,
      cloudflareR2Ready: false,
      liveReady: false,
      softwareReady: compose.softwareReady,
      cases,
    };
  }

  const http = await runAttachmentHttpS3CompatibleDrill({
    endpoint: input.s3Endpoint,
    ...(input.region ? { region: input.region } : {}),
    bucket: input.bucket,
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
  });
  cases.push(...mapCases('http_s3', http.cases));
  cases.push({
    name: 'http_s3_provider_is_r2_shaped',
    ok: http.provider === 'r2',
    detail:
      http.provider === 'r2'
        ? 'HTTP path used SigV4 S3-compatible store (local stand-in)'
        : `provider=${http.provider}`,
  });
  cases.push({
    name: 'cloudflare_r2_not_claimed',
    ok: true,
    detail: 'Compose S3Mock is not Cloudflare R2; cloudflareR2Ready stays false',
  });

  return {
    ok: cases.every((row) => row.ok),
    cloudflareR2Ready: false,
    liveReady: false,
    softwareReady: compose.softwareReady,
    cases,
  };
}

export const LOCAL_ATTACHMENT_COMPOSE_STACK_DRILL_DEFAULTS = {
  ...LOCAL_COMPOSE_STACK_DRILL_DEFAULTS,
  ...LOCAL_HTTP_S3_ATTACHMENT_DRILL_DEFAULTS,
  s3Endpoint: LOCAL_HTTP_S3_ATTACHMENT_DRILL_DEFAULTS.endpoint,
} as const;
