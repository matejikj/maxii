#!/usr/bin/env bash
# Local S3-compatible attachment store drill (Adobe S3Mock via Compose).
# Proves the SigV4 private object-store adapter without claiming Cloudflare R2.
# MinIO container images are no longer pullable from Docker Hub in this env.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

COMPOSE_FILE="$DEPLOY/docker-compose.yml"
ENDPOINT="${LUMI_R2_ENDPOINT:-http://127.0.0.1:9090}"
BUCKET="${LUMI_R2_BUCKET:-lumi-family-photos}"
ACCESS_KEY="${LUMI_R2_ACCESS_KEY_ID:-test}"
SECRET_KEY="${LUMI_R2_SECRET_ACCESS_KEY:-test}"
REGION="${LUMI_R2_REGION:-us-east-1}"

if ! command -v docker >/dev/null 2>&1; then
  echo "attachment s3-compatible drill: docker is required" >&2
  exit 1
fi

echo "attachment s3-compatible drill: starting S3Mock (compose profile attachments)"
docker compose -f "$COMPOSE_FILE" --profile attachments up -d s3mock

echo "attachment s3-compatible drill: waiting for S3 endpoint health"
for _ in $(seq 1 40); do
  if curl -fsS "$ENDPOINT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
if ! curl -fsS "$ENDPOINT/" >/dev/null 2>&1; then
  echo "attachment s3-compatible drill: S3 endpoint did not become healthy at $ENDPOINT" >&2
  exit 1
fi

export LUMI_R2_ENDPOINT="$ENDPOINT"
export LUMI_R2_BUCKET="$BUCKET"
export LUMI_R2_ACCESS_KEY_ID="$ACCESS_KEY"
export LUMI_R2_SECRET_ACCESS_KEY="$SECRET_KEY"
export LUMI_R2_REGION="$REGION"

node --experimental-strip-types <<'NODE'
import {
  LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS,
  runAttachmentS3CompatibleDrill,
} from './src/attachments/attachmentS3CompatibleDrill.ts';

const result = await runAttachmentS3CompatibleDrill({
  endpoint: process.env.LUMI_R2_ENDPOINT ?? LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS.endpoint,
  region: process.env.LUMI_R2_REGION ?? LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS.region,
  bucket: process.env.LUMI_R2_BUCKET ?? LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS.bucket,
  accessKeyId:
    process.env.LUMI_R2_ACCESS_KEY_ID ?? LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS.accessKeyId,
  secretAccessKey:
    process.env.LUMI_R2_SECRET_ACCESS_KEY ??
    LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS.secretAccessKey,
});

console.log(`endpoint=${result.endpoint} bucket=${result.bucket}`);
for (const row of result.cases) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name}: ${row.detail}`);
}
if (!result.ok) {
  console.error('attachment s3-compatible drill FAILED (local S3 proof only; not live R2)');
  process.exit(1);
}
console.log('attachment s3-compatible drill PASS (local S3-compatible; not Cloudflare R2)');
NODE
