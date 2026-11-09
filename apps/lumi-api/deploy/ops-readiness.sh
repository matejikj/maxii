#!/usr/bin/env bash
# Software readiness for family ops — does not require a purchased VPS.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OWNERS="$ROOT/operations-owners.json"

fail() {
  echo "ops-readiness: $*" >&2
  exit 1
}

[[ -f "$OWNERS" ]] || fail "missing owners"
[[ -f "$ROOT/family-ops-runbook.txt" ]] || fail "missing family-ops-runbook.txt"
[[ -f "$ROOT/incident-runbooks.txt" ]] || fail "missing incident-runbooks.txt"
[[ -f "$ROOT/restore-runbook.txt" ]] || fail "missing restore-runbook.txt"
[[ -f "$ROOT/migration-cutover-runbook.txt" ]] || fail "missing migration-cutover-runbook.txt"
[[ -f "$ROOT/backup-restic.sh" ]] || fail "missing backup-restic.sh"
[[ -f "$ROOT/alert-channels.example.json" ]] || fail "missing alert-channels.example.json"

node -e '
  const fs = require("node:fs");
  const owners = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (owners.e2eeClaim !== false) process.exit(2);
  if (!owners.onCall) process.exit(3);
  if (!owners.liveDrillEvidence) process.exit(4);
  if (!owners.workingTargets?.rpoHours || !owners.workingTargets?.rtoHours) process.exit(5);
  const software = {
    ok: true,
    e2eeClaim: owners.e2eeClaim,
    onCallPrimary: owners.onCall.primaryName,
    liveDrillsFilled: Object.values(owners.liveDrillEvidence).every((v) => v != null && v !== ""),
  };
  console.log(JSON.stringify(software));
  if (software.onCallPrimary === "UNASSIGNED" || !software.liveDrillsFilled) {
    console.log("ops-readiness: software artifacts OK; live owner/drills still open");
  }
' "$OWNERS"

echo "ops-readiness: family ops software checklist passed"
