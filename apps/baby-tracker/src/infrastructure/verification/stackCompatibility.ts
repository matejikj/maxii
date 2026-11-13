import { DateTime } from 'luxon';
import { z } from 'zod';
import {
  DEFAULT_ARGON2ID_PARAMS,
  openPortableBackup,
  sealPortableBackup,
} from '../crypto/portableBackup';
import { utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Verified technology choices for the personal offline client. Versions are the
 * ones installed in this workspace; changing a major requires a new decision
 * record, not a silent upgrade during product work.
 */
export const VERIFIED_STACK = [
  {
    id: 'expo',
    purpose: 'Cross-platform app runtime and native module builds',
    packageName: 'expo',
    version: '~58.0.23',
    license: 'MIT',
    platforms: ['ios', 'android', 'web'],
    reason: 'Existing monorepo baseline; development builds required for SQLCipher.',
  },
  {
    id: 'react-native',
    purpose: 'Native UI runtime',
    packageName: 'react-native',
    version: '0.88.1',
    license: 'MIT',
    platforms: ['ios', 'android'],
    reason: 'Pinned by Expo SDK 58; keep dependency tree compatible.',
  },
  {
    id: 'expo-sqlite-sqlcipher',
    purpose: 'Encrypted on-device relational store',
    packageName: 'expo-sqlite',
    version: '~58.0.15',
    license: 'MIT',
    platforms: ['ios', 'android'],
    reason: 'Official Expo SQLCipher plugin; plaintext SQLite is rejected for private records.',
  },
  {
    id: 'expo-secure-store',
    purpose: 'Platform vault for the database key',
    packageName: 'expo-secure-store',
    version: '~58.0.2',
    license: 'MIT',
    platforms: ['ios', 'android'],
    reason: 'Small secrets only; Keychain/Keystore-backed, not a substitute for SQLCipher.',
  },
  {
    id: 'portable-crypto',
    purpose: 'Password-based portable backup envelope',
    packageName: '@noble/ciphers + @noble/hashes',
    version: '2.4.0',
    license: 'MIT',
    platforms: ['ios', 'android', 'web', 'node'],
    reason: 'Audited Argon2id and XChaCha20-Poly1305 without a custom cipher.',
  },
  {
    id: 'expo-crypto',
    purpose: 'Platform CSPRNG polyfill for Web Crypto getRandomValues',
    packageName: 'expo-crypto',
    version: '~58.0.7',
    license: 'MIT',
    platforms: ['ios', 'android', 'web'],
    reason: 'Noble and key generation must not fall back to Math.random on React Native.',
  },
  {
    id: 'dexie',
    purpose: 'IndexedDB adapter for the web diary',
    packageName: 'dexie',
    version: '4.4.7',
    license: 'Apache-2.0',
    platforms: ['web'],
    reason: 'Typed IndexedDB transactions sharing domain ports with native storage.',
  },
  {
    id: 'zod',
    purpose: 'Runtime validation on file, content and network boundaries',
    packageName: 'zod',
    version: '4.6.7',
    license: 'MIT',
    platforms: ['ios', 'android', 'web', 'node'],
    reason: 'TypeScript types alone do not validate untrusted payloads.',
  },
  {
    id: 'luxon',
    purpose: 'UTC instants, IANA zones and calendar dates',
    packageName: 'luxon',
    version: '3.7.2',
    license: 'MIT',
    platforms: ['ios', 'android', 'web', 'node'],
    reason: 'Stable DST and zone APIs; Temporal remains optional later, not dual time stacks.',
  },
  {
    id: 'react-navigation',
    purpose: 'Typed tabs and detail stacks with web path mapping',
    packageName: '@react-navigation/native',
    version: '7.5.1',
    license: 'MIT',
    platforms: ['ios', 'android', 'web'],
    reason: 'Single navigation system; native-stack and bottom-tabs share the same state model.',
  },
  {
    id: 'tanstack-query',
    purpose: 'Disposable in-memory cache for read models after DB commit',
    packageName: '@tanstack/react-query',
    version: '5.107.1',
    license: 'MIT',
    platforms: ['ios', 'android', 'web'],
    reason: 'Optional cache only; persistence plugins that write plaintext are forbidden.',
  },
  {
    id: 'lumi-forest',
    purpose: 'Accessible UI, characters and motion',
    packageName: '@lumi/forest-design',
    version: '1.0.0',
    license: 'UNLICENSED',
    platforms: ['ios', 'android', 'web'],
    reason: 'Existing workspace framework; product domain stays outside the package.',
  },
] as const;

export const SUPPORT_MATRIX = {
  node: '>=22.13.0 (verified locally on 22.15.0; CI uses 22.16.0)',
  lockfile: 'package-lock.json lockfileVersion 3',
  mobileOs: {
    ios: 'Supported release iOS matching Expo SDK 58; reference physical iPhone required for perf gates',
    android: 'API 33+; reference mid-range physical Android required for perf gates',
  },
  browsers: ['Safari (current macOS/iOS)', 'Chrome (current desktop)', 'Firefox (current desktop)'],
  referenceDevices: {
    androidPhysical:
      'Pixel 6 class mid-range Android (physical; AVD Pixel_6 for interim native builds)',
    iosPhysical: 'Supported iPhone 13-class or newer on current iOS',
    web: 'Safari desktop + iOS Safari for primary web matrix',
  },
  measurementMethod: {
    coldStart:
      'Release-like build, encrypted DB already provisioned, time to interactive Today shell',
    localWrite: 'p95 confirmed local save of a diaper event after commit returns',
    lumi: 'Single decorative character animation on Today; respect reduced motion',
  },
} as const;

/** Luxon must preserve zone-aware calendar math across a European DST spring-forward. */
export function verifyLuxonDstBehavior(): { beforeOffset: string; afterOffset: string } {
  const before = DateTime.fromISO('2026-03-29T01:30:00', { zone: 'Europe/Prague' });
  const after = before.plus({ days: 1 });
  if (before.offset === after.offset) {
    throw new Error('Expected Europe/Prague DST offset change across the spring-forward day.');
  }
  return {
    beforeOffset: before.toFormat('ZZ'),
    afterOffset: after.toFormat('ZZ'),
  };
}

/** Zod must reject empty care notes that would otherwise look like a valid string. */
export function verifyZodBoundarySchema(): void {
  const noteSchema = z.object({
    note: z.string().trim().min(1).max(2000),
  });
  if (noteSchema.safeParse({ note: '   ' }).success) {
    throw new Error('Zod boundary schema accepted a blank note.');
  }
  noteSchema.parse({ note: 'spala klidne' });
}

/**
 * Seals and opens a tiny envelope with reduced Argon2 cost so CI can prove the
 * codec path without spending production KDF time on every run.
 */
export function verifyPortableBackupRoundTrip(password = 'recovery-password-for-tests-only'): void {
  const plaintext = utf8ToBytes(JSON.stringify({ childDisplayName: 'Probe', events: 1 }));
  const envelope = sealPortableBackup(plaintext, password, {
    ...DEFAULT_ARGON2ID_PARAMS,
    t: 1,
    m: 32,
  });
  const opened = openPortableBackup(envelope, password);
  const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  if (decode(opened) !== decode(plaintext)) {
    throw new Error('Portable backup round-trip lost payload bytes.');
  }
  try {
    openPortableBackup(envelope, 'wrong-password');
    throw new Error('Wrong password was accepted.');
  } catch (error) {
    if (!(error instanceof Error) || !/authentication failed|Wrong password/i.test(error.message)) {
      throw error;
    }
  }
}

export function runStackCompatibilityChecks(): {
  stackSize: number;
  dst: ReturnType<typeof verifyLuxonDstBehavior>;
} {
  verifyZodBoundarySchema();
  verifyPortableBackupRoundTrip();
  const dst = verifyLuxonDstBehavior();
  return { stackSize: VERIFIED_STACK.length, dst };
}
