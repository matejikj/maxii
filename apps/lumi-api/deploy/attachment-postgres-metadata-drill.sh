#!/usr/bin/env bash
# Compose Postgres attachment metadata + RLS drill (no blob upload, not live R2).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

COMPOSE_FILE="$DEPLOY/docker-compose.yml"
DATABASE_URL="${LUMI_DATABASE_URL:-postgres://lumi_app:lumi_app_dev_only@127.0.0.1:5433/lumi_app}"
ADMIN_URL="${LUMI_DATABASE_ADMIN_URL:-postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app}"

if ! command -v docker >/dev/null 2>&1; then
  echo "attachment postgres metadata drill: docker is required" >&2
  exit 1
fi

echo "attachment postgres metadata drill: starting postgres"
docker compose -f "$COMPOSE_FILE" up -d postgres

echo "attachment postgres metadata drill: waiting for postgres"
for _ in $(seq 1 60); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d lumi_app >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
if ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d lumi_app >/dev/null 2>&1; then
  echo "attachment postgres metadata drill: postgres did not become ready" >&2
  exit 1
fi

MIGRATIONS_DIR="$ROOT/migrations"
apply_if_missing() {
  local marker="$1"
  local sql="$2"
  local exists
  exists="$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -d lumi_app -Atc \
    "select to_regclass('public.${marker}') is not null")"
  if [[ "$exists" != "t" ]]; then
    echo "attachment postgres metadata drill: applying $(basename "$sql")"
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

node --experimental-strip-types <<'NODE'
import {
  LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS,
  runAttachmentPostgresMetadataDrill,
} from './src/attachments/attachmentPostgresMetadataDrill.ts';

const result = await runAttachmentPostgresMetadataDrill({
  databaseUrl:
    process.env.LUMI_DATABASE_URL ??
    LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS.databaseUrl,
  adminDatabaseUrl:
    process.env.LUMI_DATABASE_ADMIN_URL ??
    LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS.adminDatabaseUrl,
});

console.log(`ok=${result.ok} personalColdUnaffected=${result.personalColdUnaffected}`);
for (const row of result.cases) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name}: ${row.detail}`);
}
if (!result.ok || !result.personalColdUnaffected) {
  console.error('attachment postgres metadata drill FAILED');
  process.exit(1);
}
console.log(
  'attachment postgres metadata drill PASS (RLS metadata only; not Cloudflare R2)',
);
NODE
