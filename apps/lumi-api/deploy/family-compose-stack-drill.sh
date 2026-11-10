#!/usr/bin/env bash
# Local Compose family stack smoke: Postgres schema/RLS + optional S3Mock.
# Never claims live VPS readiness (liveReady stays false).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

COMPOSE_FILE="$DEPLOY/docker-compose.yml"
DATABASE_URL="${LUMI_DATABASE_URL:-postgres://lumi_app:lumi_app_dev_only@127.0.0.1:5433/lumi_app}"
ADMIN_URL="${LUMI_DATABASE_ADMIN_URL:-postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app}"
S3_ENDPOINT="${LUMI_R2_ENDPOINT:-http://127.0.0.1:9090}"

if ! command -v docker >/dev/null 2>&1; then
  echo "family compose stack drill: docker is required" >&2
  exit 1
fi

echo "family compose stack drill: starting postgres + s3mock"
docker compose -f "$COMPOSE_FILE" --profile attachments up -d postgres s3mock

echo "family compose stack drill: waiting for postgres"
for _ in $(seq 1 60); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d lumi_app >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
if ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d lumi_app >/dev/null 2>&1; then
  echo "family compose stack drill: postgres did not become ready" >&2
  exit 1
fi

echo "family compose stack drill: waiting for S3Mock"
for _ in $(seq 1 40); do
  if curl -fsS "$S3_ENDPOINT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# Existing Compose volumes skip docker-entrypoint-initdb.d. Apply only
# migrations whose marker table is missing so we do not re-create policies.
MIGRATIONS_DIR="$ROOT/migrations"
apply_if_missing() {
  local marker="$1"
  local sql="$2"
  local exists
  exists="$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -d lumi_app -Atc \
    "select to_regclass('public.${marker}') is not null")"
  if [[ "$exists" != "t" ]]; then
    echo "family compose stack drill: applying $(basename "$sql")"
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

export LUMI_DATABASE_URL="$DATABASE_URL"
export LUMI_DATABASE_ADMIN_URL="$ADMIN_URL"
export LUMI_R2_ENDPOINT="$S3_ENDPOINT"
export LUMI_COMPOSE_DEPLOY_DIR="$DEPLOY"

node --experimental-strip-types <<'NODE'
import { join } from 'node:path';
import {
  LOCAL_COMPOSE_STACK_DRILL_DEFAULTS,
  runFamilyComposeStackDrill,
} from './src/ops/familyComposeStackDrill.ts';

const result = await runFamilyComposeStackDrill({
  databaseUrl: process.env.LUMI_DATABASE_URL ?? LOCAL_COMPOSE_STACK_DRILL_DEFAULTS.databaseUrl,
  adminDatabaseUrl:
    process.env.LUMI_DATABASE_ADMIN_URL ??
    LOCAL_COMPOSE_STACK_DRILL_DEFAULTS.adminDatabaseUrl,
  s3Endpoint: process.env.LUMI_R2_ENDPOINT ?? LOCAL_COMPOSE_STACK_DRILL_DEFAULTS.s3Endpoint,
  deployDir: process.env.LUMI_COMPOSE_DEPLOY_DIR ?? join(process.cwd(), 'deploy'),
});

console.log(`softwareReady=${result.softwareReady} liveReady=${result.liveReady}`);
for (const row of result.cases) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name}: ${row.detail}`);
}
if (result.liveReady) {
  console.error('family compose stack drill FAILED: local stack must not claim liveReady');
  process.exit(1);
}
if (!result.ok) {
  console.error('family compose stack drill FAILED (local Compose only; not live VPS)');
  process.exit(1);
}
console.log('family compose stack drill PASS (local Compose; liveReady=false)');
NODE
