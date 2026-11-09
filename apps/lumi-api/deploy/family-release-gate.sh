#!/usr/bin/env bash
# Family release candidate gate. Exits non-zero until live ops + evidence pack
# are complete. Software prerequisites may already pass without a purchased VPS.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_ROOT="$(cd "$ROOT/.." && pwd)"

fail() {
  echo "family-release-gate: $*" >&2
  exit 1
}

[[ -f "$ROOT/operations-owners.json" ]] || fail "missing operations-owners.json"
[[ -f "$ROOT/backup-restic.sh" ]] || fail "missing backup-restic.sh"
[[ -f "$ROOT/restore-runbook.txt" ]] || fail "missing restore-runbook.txt"
[[ -f "$API_ROOT/src/ops/familyReleaseGate.ts" ]] || fail "missing familyReleaseGate module"

cd "$API_ROOT"
node --experimental-strip-types -e '
import { loadFamilyReleaseGateFromDeploy } from "./src/ops/loadFamilyReleaseGate.ts";

const result = loadFamilyReleaseGateFromDeploy();
console.log(JSON.stringify({
  softwarePrerequisitesOk: result.softwarePrerequisitesOk,
  liveOpsReady: result.liveOpsReady,
  evidencePackComplete: result.evidencePackComplete,
  releaseCandidateOk: result.releaseCandidateOk,
  blockerCount: result.blockers.length,
  blockers: result.blockers.slice(0, 20),
}, null, 2));

if (!result.softwarePrerequisitesOk) {
  console.error("family-release-gate: software prerequisites incomplete");
  process.exit(2);
}
if (!result.releaseCandidateOk) {
  console.error("family-release-gate: release candidate CLOSED (live ops and/or evidence pack incomplete)");
  process.exit(3);
}
console.log("family-release-gate: release candidate OPEN");
'
