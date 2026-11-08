#!/usr/bin/env bash
# Daily ops backup: logical PostgreSQL dumps + restic push to private R2 (eu).
# Secrets stay outside Git. Staging files are removed on success and failure.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGING="${LUMI_BACKUP_STAGING:-/var/tmp/lumi-backup-staging}"
RETENTION_DAYS="${LUMI_BACKUP_RETENTION_DAYS:-30}"
REPO="${RESTIC_REPOSITORY:?RESTIC_REPOSITORY required (rclone/s3/R2 URL)}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE required and must be recoverable off-host}"

cleanup() {
  rm -rf "${STAGING}"
}
trap cleanup EXIT

mkdir -m 700 -p "${STAGING}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_DIR="${STAGING}/${STAMP}"
mkdir -m 700 -p "${DUMP_DIR}"

echo "backup: logical pg_dump (never copy live PGDATA)"
if [[ -n "${LUMI_APP_DATABASE_URL:-}" ]]; then
  pg_dump --format=custom --file="${DUMP_DIR}/app.dump" "${LUMI_APP_DATABASE_URL}"
fi
if [[ -n "${LUMI_IDENTITY_DATABASE_URL:-}" ]]; then
  pg_dump --format=custom --file="${DUMP_DIR}/identity.dump" "${LUMI_IDENTITY_DATABASE_URL}"
fi

# Independent erasure registry mirror — must exist before confirming server erase.
if [[ -n "${LUMI_ERASURE_REGISTRY_PATH:-}" && -f "${LUMI_ERASURE_REGISTRY_PATH}" ]]; then
  cp -a "${LUMI_ERASURE_REGISTRY_PATH}" "${DUMP_DIR}/erasure-registry.json"
fi

echo "backup: restic backup of staging tree"
restic backup "${DUMP_DIR}" --tag "lumi-ops" --tag "${STAMP}"

echo "backup: forget snapshots older than ${RETENTION_DAYS} days"
restic forget --keep-within "${RETENTION_DAYS}d" --prune

echo "backup: completed ${STAMP} into ${REPO}"
# On restore: apply erasure-registry.json before opening API traffic.
unset ROOT
