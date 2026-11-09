#!/usr/bin/env bash
# Software family security matrix. Exit 0 only when automated checks pass.
# Never claims an independent human security review.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_ROOT="$(cd "$ROOT/.." && pwd)"

cd "$API_ROOT"
node --experimental-strip-types -e '
import { loadApiConfig } from "./src/config/env.ts";
import { createFamilyApi } from "./src/http/createServer.ts";
import { runFamilySecurityMatrix } from "./src/ops/familySecurityMatrix.ts";

const config = loadApiConfig({
  ...process.env,
  LUMI_TEST_HS256_SECRET: process.env.LUMI_TEST_HS256_SECRET || "matrix-hs256",
  LUMI_OIDC_ISSUER: process.env.LUMI_OIDC_ISSUER || "http://test.invalid/realms/lumi",
  LUMI_OIDC_AUDIENCE: process.env.LUMI_OIDC_AUDIENCE || "lumi-api",
});
const api = await createFamilyApi(config);
try {
  const report = await runFamilySecurityMatrix({
    app: api.app,
    tokens: api.tokens,
    sync: api.sync,
    diaryCanary: "DIARY-CANARY-MATRIX-PRIVATE",
  });
  console.log(JSON.stringify({
    format: report.format,
    allSoftwareChecksPassed: report.allSoftwareChecksPassed,
    independentHumanReviewClaimed: report.independentHumanReviewClaimed,
    failed: report.checks.filter((c) => !c.ok).map((c) => c.id),
    findings: report.findings,
  }, null, 2));
  if (report.independentHumanReviewClaimed) {
    console.error("family-security-matrix: refused independent-review claim");
    process.exit(2);
  }
  if (!report.allSoftwareChecksPassed) {
    console.error("family-security-matrix: software checks FAILED");
    process.exit(1);
  }
  console.error("family-security-matrix: software checks PASS (human review still required)");
} finally {
  await api.app.close();
}
'
