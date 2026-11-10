#!/usr/bin/env bash
# Software tabletop for critical family-ops incidents.
# May use local Compose Postgres for reachability only — never claims liveReady.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

COMPOSE_FILE="$DEPLOY/docker-compose.yml"
ADMIN_URL="${LUMI_DATABASE_ADMIN_URL:-postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app}"
USE_COMPOSE="${LUMI_OPS_REHEARSAL_COMPOSE:-1}"

if [[ "$USE_COMPOSE" == "1" ]] && command -v docker >/dev/null 2>&1; then
  echo "family ops incident rehearsal: starting postgres (optional reachability)"
  docker compose -f "$COMPOSE_FILE" up -d postgres >/dev/null
  for _ in $(seq 1 40); do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d lumi_app >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
  export LUMI_DATABASE_ADMIN_URL="$ADMIN_URL"
else
  unset LUMI_DATABASE_ADMIN_URL || true
fi

export LUMI_COMPOSE_DEPLOY_DIR="$DEPLOY"

node --experimental-strip-types <<'NODE'
import { join } from 'node:path';
import { runFamilyOpsIncidentRehearsal } from './src/ops/familyOpsIncidentRehearsal.ts';

const result = await runFamilyOpsIncidentRehearsal({
  deployDir: process.env.LUMI_COMPOSE_DEPLOY_DIR ?? join(process.cwd(), 'deploy'),
  adminDatabaseUrl: process.env.LUMI_DATABASE_ADMIN_URL ?? null,
});

console.log(
  `ok=${result.ok} softwareReady=${result.softwareReady} liveReady=${result.liveReady} liveDrillEvidenceMutated=${result.liveDrillEvidenceMutated}`,
);
for (const row of result.cases) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name}: ${row.detail}`);
}
if (!result.ok || result.liveReady || result.liveDrillEvidenceMutated) {
  console.error('family ops incident rehearsal FAILED (software tabletop only)');
  process.exit(1);
}
console.log(
  'family ops incident rehearsal PASS (local tracker kept; live host drills still open)',
);
NODE
