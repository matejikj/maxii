#!/usr/bin/env node
/**
 * Runs personal release-candidate checks without requiring a store account:
 * native application ids, cold family remote boundary, public env hygiene,
 * and absence of signing material inside the app tree.
 */
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
    if (entry.name === 'node_modules' || entry.name === 'dist-web' || entry.name === 'dist-android' || entry.name === 'dist-ios' || entry.name === '.git') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Generated native trees may hold debug keystores; still scan basenames.
      if (entry.name === 'android' || entry.name === 'ios' || entry.name === 'ops' || entry.name === 'scripts' || entry.name === 'src' || entry.name.startsWith('.')) {
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

function readApkPackageName(apkPath: string): string | null {
  const aapt = process.env.AAPT?.trim() || findAapt();
  if (!aapt || !fs.existsSync(apkPath)) return null;
  const dump = spawnSync(aapt, ['dump', 'badging', apkPath], { encoding: 'utf8' });
  const match = /package: name='([^']+)'/.exec(dump.stdout ?? '');
  return match?.[1] ?? null;
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
const apkPackageName = fs.existsSync(apkPath)
  ? readApkPackageName(apkPath)
  : undefined;

const candidateEnvironment =
  process.env.EXPO_PUBLIC_LUMI_ENV === 'production'
    ? 'production'
    : process.env.EXPO_PUBLIC_LUMI_ENV === 'staging'
      ? 'staging'
      : 'development';

const evidence = buildReleaseEvidenceManifest({
  nowMs: Date.now(),
  environment: candidateEnvironment,
  appVersion: process.env.npm_package_version ?? '0.1.0',
});

const result = evaluatePersonalReleaseGate({
  env: process.env as Record<string, string | undefined>,
  candidateEnvironment,
  androidAppGradle,
  iosPbxproj,
  repositoryPaths,
  apkPackageName,
  evidence,
});

process.stdout.write(formatPersonalReleaseGateReport(result));
if (!result.ok) {
  process.exitCode = 1;
}
