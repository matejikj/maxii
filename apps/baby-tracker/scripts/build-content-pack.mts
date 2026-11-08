#!/usr/bin/env node
/**
 * Builds and signs the install-local first-year base content pack.
 * Production private key is read from LUMI_CONTENT_PACK_PRIVATE_KEY_HEX or the
 * local evidence path — never from the committed tree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFirstYearBaseFiles,
  buildFirstYearBaseManifest,
} from '../src/content/pack/firstYearBasePack.ts';
import { signContentPackManifest, verifyContentPack } from '../src/content/pack/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const outRoot = path.resolve(here, '../content/packs/first-year-base');
const evidenceKey = path.resolve(
  here,
  '../../../docs/implementation/evidence/task-24/keys/prod.ed25519.sk.hex',
);

function readPrivateKeyHex(): { keyId: string; privateKeyHex: string; allowDev: boolean } {
  const fromEnv = process.env.LUMI_CONTENT_PACK_PRIVATE_KEY_HEX?.trim();
  if (fromEnv) {
    return {
      keyId: process.env.LUMI_CONTENT_PACK_KEY_ID?.trim() || 'lumi-content-ed25519-v1',
      privateKeyHex: fromEnv,
      allowDev: false,
    };
  }
  if (fs.existsSync(evidenceKey)) {
    return {
      keyId: 'lumi-content-ed25519-v1',
      privateKeyHex: fs.readFileSync(evidenceKey, 'utf8').trim(),
      allowDev: false,
    };
  }
  const devKey = path.resolve(here, '../content/packs/keys/dev.ed25519.sk.hex');
  if (fs.existsSync(devKey) && process.env.LUMI_CONTENT_PACK_ALLOW_DEV === '1') {
    return {
      keyId: 'lumi-content-ed25519-dev-1',
      privateKeyHex: fs.readFileSync(devKey, 'utf8').trim(),
      allowDev: true,
    };
  }
  throw new Error(
    'Missing content-pack private key. Set LUMI_CONTENT_PACK_PRIVATE_KEY_HEX or provide the local evidence key.',
  );
}

const files = buildFirstYearBaseFiles();
const { manifest } = buildFirstYearBaseManifest(files, '2026-11-08T18:00:00+01:00');
const key = readPrivateKeyHex();
const signature = signContentPackManifest(manifest, key.privateKeyHex, key.keyId);
const verified = verifyContentPack(manifest, signature, files, {
  allowDevelopmentKeys: key.allowDev,
});
if (!verified.ok) {
  throw new Error(`Built pack failed verification: ${verified.code} ${verified.message}`);
}

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(outRoot, 'assets'), { recursive: true });
for (const file of files) {
  const digest = manifest.files.find((entry) => entry.logicalId === file.logicalId)!.sha256;
  fs.writeFileSync(path.join(outRoot, 'assets', digest), file.bytes);
}
fs.writeFileSync(path.join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(outRoot, 'signature.json'), `${JSON.stringify(signature, null, 2)}\n`);

const embedded = `/**
 * Signed first-year base pack envelope. Payload bytes are rebuilt deterministically
 * from the published catalog so the install stays offline without remote URLs.
 */
import type { ContentPackManifest, ContentPackSignature } from './types';

export const EMBEDDED_FIRST_YEAR_BASE_MANIFEST = ${JSON.stringify(manifest, null, 2)} as const satisfies ContentPackManifest;

export const EMBEDDED_FIRST_YEAR_BASE_SIGNATURE = ${JSON.stringify(signature, null, 2)} as const satisfies ContentPackSignature;
`;

fs.writeFileSync(path.resolve(here, '../src/content/pack/embeddedFirstYearBase.ts'), embedded);

console.log(
  JSON.stringify(
    {
      packId: manifest.packId,
      generation: manifest.generation,
      keyId: signature.keyId,
      files: manifest.files.length,
      totalBytes: manifest.totalBytes,
      activityRevisionIds: manifest.activityRevisionIds.length,
      outRoot,
    },
    null,
    2,
  ),
);
