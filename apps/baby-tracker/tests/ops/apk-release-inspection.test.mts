import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluatePersonalReleaseGate,
  inspectApkReleaseArtifact,
  parseAaptBadging,
} from '../../src/ops/index.ts';

const SAMPLE_BADGING = `
package: name='com.matejikj' versionCode='1' versionName='0.1.0' platformBuildVersionName='16'
uses-permission: name='android.permission.INTERNET'
uses-permission: name='android.permission.ACCESS_NETWORK_STATE'
uses-permission: name='android.permission.POST_NOTIFICATIONS'
`;

test('parseAaptBadging extracts package, versions, and permissions', () => {
  const summary = parseAaptBadging(SAMPLE_BADGING);
  assert.equal(summary.packageName, 'com.matejikj');
  assert.equal(summary.versionCode, '1');
  assert.equal(summary.versionName, '0.1.0');
  assert.ok(summary.usesPermissions.includes('android.permission.INTERNET'));
});

test('apk inspection rejects microphone permission on personal candidate', () => {
  const findings = inspectApkReleaseArtifact({
    badgingDump: `${SAMPLE_BADGING}\nuses-permission: name='android.permission.RECORD_AUDIO'\n`,
    expectedPackageName: 'com.matejikj',
    expectedVersionName: '0.1.0',
    sha256: 'a'.repeat(64),
  });
  assert.ok(findings.some((item) => item.id === 'apk.permissions.noSensitiveExtras' && !item.ok));
});

test('personal release gate accepts clean APK badging and hash', () => {
  const result = evaluatePersonalReleaseGate({
    apkBadgingDump: SAMPLE_BADGING,
    apkSha256: 'b'.repeat(64),
    expectedApkVersionName: '0.1.0',
  });
  assert.equal(result.ok, true);
  assert.ok(result.findings.some((item) => item.id === 'apk.packageName' && item.ok));
  assert.ok(
    result.findings.some((item) => item.id === 'apk.permissions.noSensitiveExtras' && item.ok),
  );
  assert.ok(result.findings.some((item) => item.id === 'apk.sha256' && item.ok));
});
