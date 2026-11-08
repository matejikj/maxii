#!/usr/bin/env node
/**
 * Runs personal release-candidate checks without requiring a store account:
 * native application ids, cold family remote boundary, public env hygiene,
 * APK badging/permissions/hash, and absence of signing material in the app tree.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  buildReleaseEvidenceManifest,
  evaluatePersonalReleaseGate,
  formatPersonalReleaseGateReport,
} from '../src/ops/index.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readIfExists(filePath: string): string | undefined {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : undefined;
}

function collectScannedPaths(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist-web' ||
      entry.name === 'dist-android' ||
      entry.name === 'dist-ios' ||
      entry.name === '.git'
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'android' ||
        entry.name === 'ios' ||
        entry.name === 'ops' ||
        entry.name === 'scripts' ||
        entry.name === 'src' ||
        entry.name.startsWith('.')
      ) {
        collectScannedPaths(full, out);
      } else if (!entry.name.startsWith('.')) {
        collectScannedPaths(full, out);
      }
      continue;
    }
    out.push(path.relative(root, full));
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

function readApkBadging(apkPath: string): string | null {
  const aapt = process.env.AAPT?.trim() || findAapt();
  if (!aapt || !fs.existsSync(apkPath)) return null;
  const dump = spawnSync(aapt, ['dump', 'badging', apkPath], { encoding: 'utf8' });
  if (dump.status !== 0) return null;
  return dump.stdout ?? null;
}

const androidAppGradle = readIfExists(path.join(root, 'android/app/build.gradle'));
const iosPbxproj = readIfExists(
  path.join(root, 'ios/LumiBabyTracker.xcodeproj/project.pbxproj'),
);

const repositoryPaths: string[] = [];
collectScannedPaths(root, repositoryPaths);

const apkPath =
  process.env.LUMI_RELEASE_APK?.trim() ||
  path.join(root, 'android/app/build/outputs/apk/release/app-release.apk');
const apkExists = fs.existsSync(apkPath);
const apkBadgingDump = apkExists ? readApkBadging(apkPath) : undefined;
const apkPackageName = apkBadgingDump
  ? /package: name='([^']+)'/.exec(apkBadgingDump)?.[1] ?? null
  : undefined;
const apkSha256 = apkExists
  ? createHash('sha256').update(fs.readFileSync(apkPath)).digest('hex')
  : undefined;

const candidateEnvironment =
  process.env.EXPO_PUBLIC_LUMI_ENV === 'production'
    ? 'production'
    : process.env.EXPO_PUBLIC_LUMI_ENV === 'staging'
      ? 'staging'
      : 'development';

const appVersion = process.env.npm_package_version ?? '0.1.0';
const evidence = buildReleaseEvidenceManifest({
  nowMs: Date.now(),
  environment: candidateEnvironment,
  appVersion,
});

const result = evaluatePersonalReleaseGate({
  env: process.env as Record<string, string | undefined>,
  candidateEnvironment,
  androidAppGradle,
  iosPbxproj,
  repositoryPaths,
  apkPackageName,
  apkBadgingDump,
  apkSha256,
  expectedApkVersionName: appVersion,
  evidence,
});

process.stdout.write(formatPersonalReleaseGateReport(result));
if (!result.ok) {
  process.exitCode = 1;
}
