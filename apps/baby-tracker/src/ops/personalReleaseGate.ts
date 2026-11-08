import {
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from '../app/remoteServicesBoundary.ts';
import { checkNativeApplicationIds } from './nativeApplicationId.ts';
import {
  inspectApkReleaseArtifact,
  type ApkInspectionInput,
} from './apkReleaseInspection.ts';
import {
  PERSONAL_APPLICATION_ID,
  type ReleaseEvidenceManifest,
} from './releaseEvidence.ts';

/**
 * Personal release candidate checks that can run without a device or store
 * account: application ids, cold remote boundary, public env hygiene, and
 * absence of signing material inside the repository tree.
 */

export type PersonalReleaseGateFinding = {
  id: string;
  ok: boolean;
  detail: string;
};

export type PersonalReleaseGateResult = {
  ok: boolean;
  findings: PersonalReleaseGateFinding[];
};

export type PersonalReleaseGateInput = {
  env?: Record<string, string | undefined>;
  /** When set, production candidates must keep the SQLCipher probe off. */
  candidateEnvironment?: ReleaseEvidenceManifest['environment'];
  androidAppGradle?: string;
  iosPbxproj?: string;
  /** Paths discovered under the app tree that must never hold keystores. */
  repositoryPaths?: string[];
  /** Optional APK package name from aapt dump badging. */
  apkPackageName?: string | null;
  /** Full `aapt dump badging` text for permission/version checks. */
  apkBadgingDump?: string | null;
  /** Hex SHA-256 of the candidate APK when hashing is available. */
  apkSha256?: string | null;
  expectedApkVersionName?: string;
  evidence?: Pick<ReleaseEvidenceManifest, 'app' | 'signing' | 'environment'>;
};

const FORBIDDEN_PUBLIC_ENV = [
  'EXPO_PUBLIC_LUMI_SERVICE_ROLE_KEY',
  'EXPO_PUBLIC_LUMI_DATABASE_PASSWORD',
  'EXPO_PUBLIC_LUMI_RECOVERY_PASSWORD',
  'EXPO_PUBLIC_LUMI_UPLOAD_STORE_PASSWORD',
  'EXPO_PUBLIC_LUMI_PRIVATE_KEY',
  'EXPO_PUBLIC_LUMI_SIGNING_KEY',
] as const;

const SECRETISH_PUBLIC_VALUE =
  /(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|service_role|sk_live_|AIza[0-9A-Za-z_-]{20,})/i;

const FORBIDDEN_REPO_BASENAMES = new Set([
  'personal-release.keystore',
  'android-signing.properties',
  'upload-keystore.jks',
  'release.keystore',
]);

/** Generated Android debug keystores are local tooling, not release signing. */
const ALLOWED_REPO_BASENAMES = new Set(['debug.keystore']);

const FORBIDDEN_REPO_SUFFIXES = ['.keystore', '.jks', '.p12', '.mobileprovision'];

function finding(
  id: string,
  ok: boolean,
  detail: string,
): PersonalReleaseGateFinding {
  return { id, ok, detail };
}

function evaluatePublicEnv(
  env: Record<string, string | undefined>,
  candidateEnvironment: ReleaseEvidenceManifest['environment'] | undefined,
): PersonalReleaseGateFinding[] {
  const findings: PersonalReleaseGateFinding[] = [];
  for (const name of FORBIDDEN_PUBLIC_ENV) {
    const value = env[name]?.trim();
    findings.push(
      finding(
        `env.forbidden.${name}`,
        value == null || value.length === 0,
        value
          ? `${name} must stay out of the client bundle`
          : `${name} unset`,
      ),
    );
  }

  for (const [name, raw] of Object.entries(env)) {
    if (!name.startsWith('EXPO_PUBLIC_') || raw == null || raw.trim() === '') {
      continue;
    }
    if (SECRETISH_PUBLIC_VALUE.test(raw)) {
      findings.push(
        finding(
          `env.secretish.${name}`,
          false,
          `${name} looks like a secret and must not ship in EXPO_PUBLIC_*`,
        ),
      );
    }
  }

  const boundary = resolveRemoteServicesBoundary(env);
  const remoteCold = !shouldInitializeRemoteClients(boundary);
  findings.push(
    finding(
      'remote.boundary.cold',
      remoteCold,
      remoteCold
        ? 'family auth/sync clients stay uninitialized without explicit URLs'
        : `remote clients would initialize (api=${boundary.apiBaseUrl ?? 'none'}, auth=${boundary.authConfigured}, sync=${boundary.syncConfigured})`,
    ),
  );

  if (candidateEnvironment === 'production') {
    const probeOff = env.EXPO_PUBLIC_LUMI_STORAGE_PROBE !== '1';
    findings.push(
      finding(
        'env.storageProbe.off',
        probeOff,
        probeOff
          ? 'storage probe disabled for production candidate'
          : 'EXPO_PUBLIC_LUMI_STORAGE_PROBE=1 is not allowed on a production candidate',
      ),
    );
    const familyFlagsOff =
      env.EXPO_PUBLIC_LUMI_AUTH_ENABLED !== '1' &&
      env.EXPO_PUBLIC_LUMI_SYNC_ENABLED !== '1' &&
      !(env.EXPO_PUBLIC_LUMI_API_URL?.trim());
    findings.push(
      finding(
        'env.family.unconfigured',
        familyFlagsOff,
        familyFlagsOff
          ? 'family API/auth/sync remain unset for the personal candidate'
          : 'personal production candidate must not enable family API/auth/sync',
      ),
    );
  }

  return findings;
}

function evaluateRepositoryPaths(paths: string[]): PersonalReleaseGateFinding[] {
  const offenders: string[] = [];
  for (const raw of paths) {
    const normalized = raw.replace(/\\/g, '/');
    const base = normalized.split('/').pop() ?? normalized;
    if (ALLOWED_REPO_BASENAMES.has(base)) {
      continue;
    }
    if (FORBIDDEN_REPO_BASENAMES.has(base)) {
      offenders.push(normalized);
      continue;
    }
    if (
      FORBIDDEN_REPO_SUFFIXES.some((suffix) => base.toLowerCase().endsWith(suffix))
    ) {
      offenders.push(normalized);
    }
  }
  return [
    finding(
      'repo.signing.absent',
      offenders.length === 0,
      offenders.length === 0
        ? 'no signing keystores or properties found in scanned paths'
        : `signing material must stay outside git: ${offenders.join(', ')}`,
    ),
  ];
}

function evaluateNativeIds(input: PersonalReleaseGateInput): PersonalReleaseGateFinding[] {
  if (input.androidAppGradle === undefined && input.iosPbxproj === undefined) {
    return [];
  }
  const check = checkNativeApplicationIds({
    androidAppGradle: input.androidAppGradle,
    iosPbxproj: input.iosPbxproj,
    expectedId: PERSONAL_APPLICATION_ID,
  });
  return [
    finding(
      'native.applicationId',
      check.ok,
      check.ok
        ? `native ids match ${PERSONAL_APPLICATION_ID}`
        : check.problems.join('; '),
    ),
  ];
}

function evaluateApkPackage(
  packageName: string | null | undefined,
): PersonalReleaseGateFinding[] {
  if (packageName === undefined) {
    return [];
  }
  const ok = packageName === PERSONAL_APPLICATION_ID;
  return [
    finding(
      'apk.packageName',
      ok,
      ok
        ? `APK package is ${PERSONAL_APPLICATION_ID}`
        : `APK package is ${packageName ?? '<missing>'}, expected ${PERSONAL_APPLICATION_ID}`,
    ),
  ];
}

function evaluateApkArtifact(input: PersonalReleaseGateInput): PersonalReleaseGateFinding[] {
  if (input.apkBadgingDump === undefined && input.apkSha256 === undefined) {
    return [];
  }
  const inspectionInput: ApkInspectionInput = {
    expectedPackageName: PERSONAL_APPLICATION_ID,
  };
  if (input.apkBadgingDump !== undefined) {
    inspectionInput.badgingDump = input.apkBadgingDump;
  }
  if (input.apkSha256 !== undefined) {
    inspectionInput.sha256 = input.apkSha256;
  }
  if (input.expectedApkVersionName !== undefined) {
    inspectionInput.expectedVersionName = input.expectedApkVersionName;
  }
  return inspectApkReleaseArtifact(inspectionInput).map((item) =>
    finding(item.id, item.ok, item.detail),
  );
}

function evaluateEvidence(
  evidence: PersonalReleaseGateInput['evidence'],
): PersonalReleaseGateFinding[] {
  if (evidence === undefined) {
    return [];
  }
  const findings: PersonalReleaseGateFinding[] = [];
  findings.push(
    finding(
      'evidence.applicationId',
      evidence.app.applicationId === PERSONAL_APPLICATION_ID,
      evidence.app.applicationId === PERSONAL_APPLICATION_ID
        ? 'release evidence pins com.matejikj'
        : `evidence applicationId is ${evidence.app.applicationId}`,
    ),
  );
  findings.push(
    finding(
      'evidence.signing.keysOutOfRepo',
      evidence.signing.keysInRepository === false,
      evidence.signing.keysInRepository === false
        ? 'evidence records keys outside the repository'
        : 'evidence must not claim signing keys live in git',
    ),
  );
  return findings;
}

/** Pure personal release gate used by CLI and unit tests. */
export function evaluatePersonalReleaseGate(
  input: PersonalReleaseGateInput = {},
): PersonalReleaseGateResult {
  const env = input.env ?? {};
  const apkArtifactFindings = evaluateApkArtifact(input);
  // Prefer full badging inspection when present; keep the simple package check otherwise.
  const apkFindings =
    apkArtifactFindings.length > 0
      ? apkArtifactFindings
      : evaluateApkPackage(input.apkPackageName);
  const findings = [
    ...evaluatePublicEnv(env, input.candidateEnvironment),
    ...evaluateNativeIds(input),
    ...apkFindings,
    ...evaluateRepositoryPaths(input.repositoryPaths ?? []),
    ...evaluateEvidence(input.evidence),
  ];
  return {
    ok: findings.every((item) => item.ok),
    findings,
  };
}

export function formatPersonalReleaseGateReport(
  result: PersonalReleaseGateResult,
): string {
  const lines = result.findings.map(
    (item) => `${item.ok ? 'PASS' : 'FAIL'} ${item.id}: ${item.detail}`,
  );
  lines.push(result.ok ? 'GATE: PASS' : 'GATE: FAIL');
  return `${lines.join('\n')}\n`;
}
