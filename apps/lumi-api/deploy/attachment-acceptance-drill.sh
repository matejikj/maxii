#!/usr/bin/env bash
# 34.2 software acceptance on local Compose (Postgres + S3Mock): durable quota,
# expired-intent GC, revoke-at-finalize, IDOR, and sync fan-out.
# Never claims Cloudflare R2, physical phones, or family ops liveReady.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

COMPOSE_FILE="$DEPLOY/docker-compose.yml"
DATABASE_URL="${LUMI_DATABASE_URL:-postgres://lumi_app:lumi_app_dev_only@127.0.0.1:5433/lumi_app}"
ADMIN_URL="${LUMI_DATABASE_ADMIN_URL:-postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app}"
S3_ENDPOINT="${LUMI_R2_ENDPOINT:-http://127.0.0.1:9090}"
BUCKET="${LUMI_R2_BUCKET:-lumi-family-photos}"
ACCESS_KEY="${LUMI_R2_ACCESS_KEY_ID:-test}"
SECRET_KEY="${LUMI_R2_SECRET_ACCESS_KEY:-test}"
REGION="${LUMI_R2_REGION:-us-east-1}"

if ! command -v docker >/dev/null 2>&1; then
  echo "attachment acceptance drill: docker is required" >&2
  exit 1
fi

echo "attachment acceptance drill: starting postgres + s3mock"
docker compose -f "$COMPOSE_FILE" --profile attachments up -d postgres s3mock

echo "attachment acceptance drill: waiting for postgres"
for _ in $(seq 1 60); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d lumi_app >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
if ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d lumi_app >/dev/null 2>&1; then
  echo "attachment acceptance drill: postgres did not become ready" >&2
  exit 1
fi

echo "attachment acceptance drill: waiting for S3Mock"
for _ in $(seq 1 40); do
  if curl -fsS "$S3_ENDPOINT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
if ! curl -fsS "$S3_ENDPOINT/" >/dev/null 2>&1; then
  echo "attachment acceptance drill: S3 endpoint did not become healthy at $S3_ENDPOINT" >&2
  exit 1
fi

# Existing Compose volumes skip docker-entrypoint-initdb.d. Apply missing markers only.
MIGRATIONS_DIR="$ROOT/migrations"
apply_if_missing() {
  local marker="$1"
  local sql="$2"
  local exists
  exists="$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -d lumi_app -Atc \
    "select to_regclass('public.${marker}') is not null")"
  if [[ "$exists" != "t" ]]; then
    echo "attachment acceptance drill: applying $(basename "$sql")"
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      psql -U postgres -d lumi_app -v ON_ERROR_STOP=1 <"$sql" >/dev/null
  fi
}
apply_if_missing app_user "$MIGRATIONS_DIR/001_family_identity.sql"
apply_if_missing worker_job "$MIGRATIONS_DIR/002_worker_jobs.sql"
apply_if_missing family_invitation "$MIGRATIONS_DIR/003_family_invitations.sql"
apply_if_missing family_sync_state "$MIGRATIONS_DIR/004_family_sync.sql"
apply_if_missing family_erasure_event "$MIGRATIONS_DIR/005_backup_erasure.sql"
apply_if_missing family_attachment "$MIGRATIONS_DIR/006_family_attachments.sql"
apply_if_missing family_attachment_quota "$MIGRATIONS_DIR/007_family_attachment_quota.sql"

export LUMI_DATABASE_URL="$DATABASE_URL"
export LUMI_DATABASE_ADMIN_URL="$ADMIN_URL"
export LUMI_R2_ENDPOINT="$S3_ENDPOINT"
export LUMI_R2_BUCKET="$BUCKET"
export LUMI_R2_ACCESS_KEY_ID="$ACCESS_KEY"
export LUMI_R2_SECRET_ACCESS_KEY="$SECRET_KEY"
export LUMI_R2_REGION="$REGION"

node --experimental-strip-types <<'NODE'
import {
  LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS,
  runAttachmentAcceptanceDrill,
} from './src/attachments/attachmentAcceptanceDrill.ts';

const result = await runAttachmentAcceptanceDrill({
  databaseUrl:
    process.env.LUMI_DATABASE_URL ?? LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS.databaseUrl,
  adminDatabaseUrl:
    process.env.LUMI_DATABASE_ADMIN_URL ??
    LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS.adminDatabaseUrl,
  endpoint: process.env.LUMI_R2_ENDPOINT ?? LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS.endpoint,
  region: process.env.LUMI_R2_REGION ?? LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS.region,
  bucket: process.env.LUMI_R2_BUCKET ?? LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS.bucket,
  accessKeyId:
    process.env.LUMI_R2_ACCESS_KEY_ID ?? LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS.accessKeyId,
  secretAccessKey:
    process.env.LUMI_R2_SECRET_ACCESS_KEY ??
    LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS.secretAccessKey,
});

console.log(
  `ok=${result.ok} softwareReady=${result.softwareReady} liveReady=${result.liveReady} cloudflareR2Ready=${result.cloudflareR2Ready}`,
);
for (const row of result.cases) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name}: ${row.detail}`);
}
if (!result.ok || result.liveReady || result.cloudflareR2Ready) {
  console.error(
    'attachment acceptance drill FAILED (local PG+S3Mock proof only; not live R2/phones)',
  );
  process.exit(1);
}
console.log(
  'attachment acceptance drill PASS (34.2 software on Compose; not Cloudflare R2, not phones)',
);
NODE
