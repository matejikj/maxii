#!/usr/bin/env node
/**
 * Prints the personal release evidence manifest for staging and distribution logs.
 * Signing keys stay outside the repository; this only records version pins.
 */
import { buildReleaseEvidenceManifest } from '../src/ops/releaseEvidence.ts';

const environment =
  process.env.EXPO_PUBLIC_LUMI_ENV === 'staging'
    ? 'staging'
    : process.env.EXPO_PUBLIC_LUMI_ENV === 'development'
      ? 'development'
      : 'production';

const manifest = buildReleaseEvidenceManifest({
  nowMs: Date.now(),
  environment,
  appVersion: process.env.npm_package_version ?? '0.1.0',
});

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
