#!/usr/bin/env bash
# Local managed-hosting migration drill. Exit 0 when portable sync/erasure
# state survives a disposable cut-over. Never claims a completed cloud move.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_ROOT="$(cd "$ROOT/.." && pwd)"

cd "$API_ROOT"
node --experimental-strip-types -e '
import { loadApiConfig } from "./src/config/env.ts";
import { createFamilyApi } from "./src/http/createServer.ts";
import { runManagedMigrationLocalDrill } from "./src/ops/managedMigrationLocalDrill.ts";

const config = loadApiConfig({
  ...process.env,
  LUMI_TEST_HS256_SECRET: process.env.LUMI_TEST_HS256_SECRET || "migration-drill-hs256",
  LUMI_OIDC_ISSUER: process.env.LUMI_OIDC_ISSUER || "http://test.invalid/realms/lumi",
  LUMI_OIDC_AUDIENCE: process.env.LUMI_OIDC_AUDIENCE || "lumi-api",
});
const api = await createFamilyApi(config);
try {
  const report = await runManagedMigrationLocalDrill({
    app: api.app,
    tokens: api.tokens,
    sync: api.sync,
    erasureRegistry: api.erasureRegistry,
  });
  console.log(JSON.stringify({
    format: report.format,
    mode: report.mode,
    allChecksPassed: report.allChecksPassed,
    cloudMigrationClaimed: report.cloudMigrationClaimed,
    receiptsPreserved: report.receiptsPreserved,
    conflictHeadsPreserved: report.conflictHeadsPreserved,
    staleCursorRequiresResync: report.staleCursorRequiresResync,
    staleWriterRejected: report.staleWriterRejected,
    erasureRegistrySurvived: report.erasureRegistrySurvived,
    findings: report.findings,
  }, null, 2));
  if (report.cloudMigrationClaimed) {
    console.error("managed-migration-local-drill: refused cloud-migration claim");
    process.exit(2);
  }
  if (!report.allChecksPassed) {
    console.error("managed-migration-local-drill: checks FAILED");
    process.exit(1);
  }
  console.error("managed-migration-local-drill: PASS (local drill only; cloud cutover not claimed)");
} finally {
  await api.app.close();
}
'
