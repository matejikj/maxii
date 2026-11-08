import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildReleaseEvidenceManifest,
  evaluatePersonalReleaseGate,
  formatPersonalReleaseGateReport,
} from '../../src/ops/index.ts';

const goodGradle = `
    namespace 'com.matejikj'
    defaultConfig {
        applicationId 'com.matejikj'
    }
`;
const goodPbx = `
				PRODUCT_BUNDLE_IDENTIFIER = com.matejikj;
`;

test('personal release gate passes cold env, native ids, and out-of-repo signing', () => {
  const evidence = buildReleaseEvidenceManifest({
    nowMs: 1_700_000_000_000,
    environment: 'production',
    appVersion: '0.1.0',
  });
  const result = evaluatePersonalReleaseGate({
    env: {
      EXPO_PUBLIC_LUMI_ENV: 'production',
      EXPO_PUBLIC_LUMI_STORAGE_PROBE: '0',
    },
    candidateEnvironment: 'production',
    androidAppGradle: goodGradle,
    iosPbxproj: goodPbx,
    repositoryPaths: ['src/ops/releaseEvidence.ts', 'scripts/build-personal-android-apk.mts'],
    apkPackageName: 'com.matejikj',
    evidence,
  });
  assert.equal(result.ok, true);
  assert.match(formatPersonalReleaseGateReport(result), /GATE: PASS/);
});

test('personal release gate fails when family remote clients would start', () => {
  const result = evaluatePersonalReleaseGate({
    env: {
      EXPO_PUBLIC_LUMI_API_URL: 'https://example.test',
      EXPO_PUBLIC_LUMI_AUTH_ENABLED: '1',
    },
    candidateEnvironment: 'production',
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.findings.some(
      (item) => item.id === 'remote.boundary.cold' && item.ok === false,
    ),
  );
});

test('personal release gate rejects storage probe and keystores on production candidate', () => {
  const result = evaluatePersonalReleaseGate({
    env: {
      EXPO_PUBLIC_LUMI_ENV: 'production',
      EXPO_PUBLIC_LUMI_STORAGE_PROBE: '1',
      EXPO_PUBLIC_LUMI_SERVICE_ROLE_KEY: 'secret',
    },
    candidateEnvironment: 'production',
    repositoryPaths: [
      'ops/personal-release.keystore',
      'android/app/debug.keystore',
      'ops/android-signing.properties',
    ],
  });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.id === 'env.storageProbe.off' && !item.ok));
  assert.ok(
    result.findings.some((item) => item.id === 'env.forbidden.EXPO_PUBLIC_LUMI_SERVICE_ROLE_KEY' && !item.ok),
  );
  assert.ok(result.findings.some((item) => item.id === 'repo.signing.absent' && !item.ok));
  assert.ok(
    !evaluatePersonalReleaseGate({
      repositoryPaths: ['android/app/debug.keystore'],
    }).findings.some((item) => item.id === 'repo.signing.absent' && !item.ok),
  );
});

test('personal release gate rejects mismatched APK package name', () => {
  const result = evaluatePersonalReleaseGate({
    apkPackageName: 'com.example.wrong',
  });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.id === 'apk.packageName' && !item.ok));
});
