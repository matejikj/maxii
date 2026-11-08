#!/usr/bin/env bash
# Validates the reproducible family stack before a host is ordered or reused.
# Does not purchase a VPS and does not write secrets into Git.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_BASE="$ROOT/docker-compose.yml"
COMPOSE_VPS="$ROOT/docker-compose.vps.yml"
OWNERS="$ROOT/operations-owners.json"

fail() {
  echo "provision: $*" >&2
  exit 1
}

command -v docker >/dev/null || fail "docker is required"
docker compose version >/dev/null || fail "docker compose is required"
[[ -f "$COMPOSE_BASE" ]] || fail "missing $COMPOSE_BASE"
[[ -f "$COMPOSE_VPS" ]] || fail "missing $COMPOSE_VPS"
[[ -f "$OWNERS" ]] || fail "missing $OWNERS"
[[ -f "$ROOT/Caddyfile" ]] || fail "missing Caddyfile"
[[ -f "$ROOT/../migrations/001_family_identity.sql" ]] || fail "missing identity migration"
[[ -f "$ROOT/../migrations/002_worker_jobs.sql" ]] || fail "missing worker migration"
[[ -f "$ROOT/../migrations/003_family_invitations.sql" ]] || fail "missing invitation migration"

# Config must parse without a live host. Secrets stay in the caller's shell env.
docker compose -f "$COMPOSE_BASE" -f "$COMPOSE_VPS" --profile api --profile worker --profile edge config >/dev/null \
  || fail "compose config failed"

node -e '
  const fs = require("node:fs");
  const owners = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (owners.e2eeClaim !== false) process.exit(2);
  if (!owners.roles?.composeOwner || !owners.handoff?.toTask31) process.exit(3);
  console.log(JSON.stringify({
    ok: true,
    e2eeClaim: owners.e2eeClaim,
    composeOwner: owners.roles.composeOwner,
    handoff: Object.keys(owners.handoff),
  }));
' "$OWNERS"

echo "provision: compose overlays and ownership handoff are ready"
echo "provision: next host steps (manual): LUKS volume, SSH keys, firewall, place secrets outside Git"
echo "provision: remaining live-host drills belong with backup/observability release gates"
