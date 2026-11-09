#!/usr/bin/env bash
# Software remote-backup + new-install restore drill. Exit 0 when staging
# restore and erasure gating pass. Never claims a measured live-host RPO/RTO.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_ROOT="$(cd "$ROOT/.." && pwd)"

cd "$API_ROOT"
node --experimental-strip-types "$ROOT/run-remote-backup-new-device-drill.mts"
