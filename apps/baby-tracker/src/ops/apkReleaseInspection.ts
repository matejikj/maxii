/**
 * Parses `aapt dump badging` output so a personal release candidate can assert
 * package id, version, and that no unexpected dangerous permissions ship.
 */

export type ApkBadgingSummary = {
  packageName: string | null;
  versionName: string | null;
  versionCode: string | null;
  usesPermissions: string[];
};

/** Permissions that personal offline care never needs to request. */
export const FORBIDDEN_APK_PERMISSIONS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.CAMERA',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.READ_SMS',
  'android.permission.SEND_SMS',
  'android.permission.READ_CALL_LOG',
  'android.permission.PROCESS_OUTGOING_CALLS',
] as const;

export function parseAaptBadging(dump: string): ApkBadgingSummary {
  const packageMatch = /package: name='([^']+)'(?:.*versionCode='([^']*)')?(?:.*versionName='([^']*)')?/.exec(
    dump,
  );
  // aapt prints versionCode/versionName on the same package: line in any order.
  const versionCode =
    /versionCode='([^']*)'/.exec(dump)?.[1] ?? packageMatch?.[2] ?? null;
  const versionName =
    /versionName='([^']*)'/.exec(dump)?.[1] ?? packageMatch?.[3] ?? null;
  const usesPermissions = [
    ...dump.matchAll(/uses-permission(?:-sdk-\d+)?: name='([^']+)'/g),
  ].map((match) => match[1]!);
  return {
    packageName: packageMatch?.[1] ?? null,
    versionName,
    versionCode,
    usesPermissions,
  };
}

export type ApkInspectionFinding = {
  id: string;
  ok: boolean;
  detail: string;
};

export type ApkInspectionInput = {
  badgingDump?: string | null;
  /** Hex SHA-256 of the APK bytes when available. */
  sha256?: string | null;
  expectedPackageName?: string;
  expectedVersionName?: string;
};

export function inspectApkReleaseArtifact(
  input: ApkInspectionInput,
): ApkInspectionFinding[] {
  const findings: ApkInspectionFinding[] = [];
  if (input.badgingDump == null) {
    return findings;
  }
  const summary = parseAaptBadging(input.badgingDump);
  const expectedPackage = input.expectedPackageName ?? 'com.matejikj';
  findings.push({
    id: 'apk.packageName',
    ok: summary.packageName === expectedPackage,
    detail:
      summary.packageName === expectedPackage
        ? `APK package is ${expectedPackage}`
        : `APK package is ${summary.packageName ?? '<missing>'}, expected ${expectedPackage}`,
  });
  if (input.expectedVersionName) {
    findings.push({
      id: 'apk.versionName',
      ok: summary.versionName === input.expectedVersionName,
      detail:
        summary.versionName === input.expectedVersionName
          ? `APK versionName is ${input.expectedVersionName}`
          : `APK versionName is ${summary.versionName ?? '<missing>'}, expected ${input.expectedVersionName}`,
    });
  } else if (summary.versionName) {
    findings.push({
      id: 'apk.versionName.present',
      ok: true,
      detail: `APK versionName is ${summary.versionName}`,
    });
  }
  if (summary.versionCode) {
    findings.push({
      id: 'apk.versionCode.present',
      ok: true,
      detail: `APK versionCode is ${summary.versionCode}`,
    });
  }
  const forbidden = summary.usesPermissions.filter((name) =>
    (FORBIDDEN_APK_PERMISSIONS as readonly string[]).includes(name),
  );
  findings.push({
    id: 'apk.permissions.noSensitiveExtras',
    ok: forbidden.length === 0,
    detail:
      forbidden.length === 0
        ? 'APK omits mic/camera/location/contacts/SMS extras'
        : `unexpected permissions: ${forbidden.join(', ')}`,
  });
  if (input.sha256 != null && input.sha256.length > 0) {
    const hex = /^[a-f0-9]{64}$/i.test(input.sha256);
    findings.push({
      id: 'apk.sha256',
      ok: hex,
      detail: hex
        ? `APK sha256 ${input.sha256.toLowerCase()}`
        : 'APK sha256 must be a 64-char hex digest',
    });
  }
  return findings;
}
