#!/usr/bin/env bash
# Local Compose logical dump → restore timing drill.
# Never fills liveDrillEvidence or claims VPS/LUKS readiness.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

COMPOSE_FILE="$DEPLOY/docker-compose.yml"
ADMIN_URL="${LUMI_DATABASE_ADMIN_URL:-postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app}"

if ! command -v docker >/dev/null 2>&1; then
  echo "family compose restore drill: docker is required" >&2
  exit 1
fi

echo "family compose restore drill: starting postgres"
docker compose -f "$COMPOSE_FILE" up -d postgres

echo "family compose restore drill: waiting for postgres"
for _ in $(seq 1 60); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d lumi_app >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
if ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d lumi_app >/dev/null 2>&1; then
  echo "family compose restore drill: postgres did not become ready" >&2
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
    echo "family compose restore drill: applying $(basename "$sql")"
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

export LUMI_DATABASE_ADMIN_URL="$ADMIN_URL"
export LUMI_COMPOSE_DEPLOY_DIR="$DEPLOY"
export LUMI_COMPOSE_FILE="$COMPOSE_FILE"

node --experimental-strip-types <<'NODE'
import {
  LOCAL_COMPOSE_RESTORE_DRILL_DEFAULTS,
  runFamilyComposeRestoreDrill,
} from './src/ops/familyComposeRestoreDrill.ts';
import { evaluateOffHostProbeConfig, loadOffHostProbeConfig } from './src/ops/offHostProbe.ts';
import { summarizeMonthlyCostLedger } from './src/ops/monthlyCostLedger.ts';
import { evaluatePatchUpgradePolicy } from './src/ops/patchUpgradePolicy.ts';
import { join } from 'node:path';

const deployDir = process.env.LUMI_COMPOSE_DEPLOY_DIR ?? join(process.cwd(), 'deploy');
const composeFile =
  process.env.LUMI_COMPOSE_FILE ?? join(deployDir, 'docker-compose.yml');

const result = await runFamilyComposeRestoreDrill({
  deployDir,
  adminDatabaseUrl:
    process.env.LUMI_DATABASE_ADMIN_URL ??
    LOCAL_COMPOSE_RESTORE_DRILL_DEFAULTS.adminDatabaseUrl,
  composeFile,
});

const probe = evaluateOffHostProbeConfig(loadOffHostProbeConfig(process.env));
const patch = evaluatePatchUpgradePolicy(deployDir);
const cost = summarizeMonthlyCostLedger();

console.log(
  `ok=${result.ok} softwareReady=${result.softwareReady} liveReady=${result.liveReady} liveDrillEvidenceMutated=${result.liveDrillEvidenceMutated}`,
);
console.log(
  `softwareMeasuredRpoSeconds=${result.softwareMeasuredRpoSeconds} softwareMeasuredRtoSeconds=${result.softwareMeasuredRtoSeconds}`,
);
for (const row of result.cases) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name}: ${row.detail}`);
}
console.log(
  `PASS off_host_probe_contract: liveGate=${probe.okForLiveGate} blockers=${probe.blockers.join('|') || 'none'}`,
);
console.log(
  `${patch.ok ? 'PASS' : 'FAIL'} patch_upgrade_policy: ${patch.checks.map((c) => c.name).join(',')}`,
);
console.log(
  `PASS monthly_cost_ledger: ${cost.hostCandidate} total€=${cost.totalEurMonthly} readyToOrderHost=${cost.readyToOrderHost}`,
);

if (!result.ok || result.liveReady || result.liveDrillEvidenceMutated || !patch.ok) {
  console.error('family compose restore drill FAILED');
  process.exit(1);
}
if (probe.okForLiveGate) {
  console.error('unexpected: off-host probe must stay closed without live assignment');
  process.exit(1);
}
console.log(
  'family compose restore drill PASS (local Compose timings only; liveReady=false)',
);
NODE
