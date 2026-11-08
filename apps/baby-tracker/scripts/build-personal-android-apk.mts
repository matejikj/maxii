#!/usr/bin/env node
/**
 * Builds a personally signed Android release APK under com.matejikj.
 * Keystore lives outside the repository (default ~/.lumi-signing/).
 * Does not uninstall existing installs or touch user data.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkNativeApplicationIds } from '../src/ops/nativeApplicationId.ts';
import { PERSONAL_APPLICATION_ID } from '../src/ops/releaseEvidence.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const signingDir =
  process.env.LUMI_SIGNING_DIR?.trim() ||
  path.join(os.homedir(), '.lumi-signing');
const keystorePath =
  process.env.LUMI_UPLOAD_STORE_FILE?.trim() ||
  path.join(signingDir, 'personal-release.keystore');
const keyAlias = process.env.LUMI_UPLOAD_KEY_ALIAS?.trim() || 'lumi-personal';
const storePassword =
  process.env.LUMI_UPLOAD_STORE_PASSWORD?.trim() || 'lumi-personal-local';
const keyPassword =
  process.env.LUMI_UPLOAD_KEY_PASSWORD?.trim() || storePassword;
const propsPath = path.join(signingDir, 'android-signing.properties');

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): void {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
  }
}

function ensureKeystore(): void {
  fs.mkdirSync(signingDir, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(keystorePath)) {
    run('keytool', [
      '-genkeypair',
      '-v',
      '-storetype',
      'PKCS12',
      '-keystore',
      keystorePath,
      '-alias',
      keyAlias,
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '10000',
      '-storepass',
      storePassword,
      '-keypass',
      keyPassword,
      '-dname',
      'CN=LUMI Personal, OU=Personal, O=matejikj, C=CZ',
    ]);
  }
  fs.writeFileSync(
    propsPath,
    [
      `LUMI_UPLOAD_STORE_FILE=${keystorePath}`,
      `LUMI_UPLOAD_STORE_PASSWORD=${storePassword}`,
      `LUMI_UPLOAD_KEY_ALIAS=${keyAlias}`,
      `LUMI_UPLOAD_KEY_PASSWORD=${keyPassword}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  process.stdout.write(`keystore ready: ${keystorePath}\n`);
}

function ensureNativeProject(): void {
  const androidGradle = path.join(root, 'android/app/build.gradle');
  if (!fs.existsSync(androidGradle)) {
    run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install']);
  }
  const source = fs.readFileSync(androidGradle, 'utf8');
  const check = checkNativeApplicationIds({ androidAppGradle: source });
  if (!check.ok) {
    throw new Error(`native id check failed:\n${check.problems.join('\n')}`);
  }
  if (!source.includes('LUMI_UPLOAD_STORE_FILE')) {
    throw new Error(
      'android/app/build.gradle missing personal signing wire-up — re-run expo prebuild with withPersonalAndroidSigning plugin',
    );
  }
}

function assembleRelease(): string {
  const gradleArgs = [
    'assembleRelease',
    `-PLUMI_UPLOAD_STORE_FILE=${keystorePath}`,
    `-PLUMI_UPLOAD_STORE_PASSWORD=${storePassword}`,
    `-PLUMI_UPLOAD_KEY_ALIAS=${keyAlias}`,
    `-PLUMI_UPLOAD_KEY_PASSWORD=${keyPassword}`,
  ];
  run('./gradlew', gradleArgs, {
    cwd: path.join(root, 'android'),
    env: {
      ...process.env,
      LUMI_UPLOAD_STORE_FILE: keystorePath,
      LUMI_UPLOAD_STORE_PASSWORD: storePassword,
      LUMI_UPLOAD_KEY_ALIAS: keyAlias,
      LUMI_UPLOAD_KEY_PASSWORD: keyPassword,
    },
  });
  const apk = path.join(
    root,
    'android/app/build/outputs/apk/release/app-release.apk',
  );
  if (!fs.existsSync(apk)) {
    throw new Error(`expected APK missing: ${apk}`);
  }
  return apk;
}

function summarizeApk(apkPath: string): void {
  const bytes = fs.readFileSync(apkPath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const aapt =
    process.env.AAPT?.trim() ||
    findAapt() ||
    null;
  let packageName: string | null = null;
  if (aapt) {
    const dump = spawnSync(aapt, ['dump', 'badging', apkPath], {
      encoding: 'utf8',
    });
    const match = /package: name='([^']+)'/.exec(dump.stdout ?? '');
    packageName = match?.[1] ?? null;
  }
  const summary = {
    applicationIdExpected: PERSONAL_APPLICATION_ID,
    applicationIdInApk: packageName,
    apkPath,
    bytes: bytes.length,
    sha256,
    signedWith: keystorePath,
    keysInRepository: false,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (packageName && packageName !== PERSONAL_APPLICATION_ID) {
    throw new Error(
      `APK package ${packageName} does not match ${PERSONAL_APPLICATION_ID}`,
    );
  }
}

function findAapt(): string | null {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) return null;
  const buildTools = path.join(sdk, 'build-tools');
  if (!fs.existsSync(buildTools)) return null;
  const versions = fs
    .readdirSync(buildTools)
    .filter((name) => /^\d/.test(name))
    .sort();
  const newest = versions.at(-1);
  if (!newest) return null;
  const candidate = path.join(buildTools, newest, 'aapt');
  return fs.existsSync(candidate) ? candidate : null;
}

ensureKeystore();
ensureNativeProject();
const apkPath = assembleRelease();
summarizeApk(apkPath);
