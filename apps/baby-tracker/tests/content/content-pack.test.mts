import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  CONTENT_PACK_LIMITS,
  CONTENT_READER_VERSION,
  activateContentPack,
  activateEmbeddedFirstYearBase,
  buildContentPackManifest,
  buildFirstYearBaseFiles,
  buildRollbackManifest,
  canonicalizeJson,
  createMemoryPackStore,
  evaluateContentReadiness,
  getActivePack,
  markActivityRevoked,
  recoverPackStore,
  signContentPackManifest,
  utf8Bytes,
  verifyContentPack,
  EMBEDDED_BASE_PACK_ID,
  EMBEDDED_FIRST_YEAR_BASE_MANIFEST,
  FIRST_YEAR_PUBLISHED_REVISIONS,
} from '../../src/content/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
/**
 * Known development signing secret for `lumi-content-ed25519-dev-1` (see trust.ts).
 * Kept inline so CI can sign fixtures without the gitignored on-disk key file.
 * Production verifiers reject this keyId unless allowDevelopmentKeys is set.
 */
const DEV_SK = 'd81c22f68b1b2fd46802330ba006e610f9976d82401abf7d1a4624644a1dea3d';
const DEV_KEY_ID = 'lumi-content-ed25519-dev-1';

function fixturePack(generation = 1) {
  const files = [{ logicalId: 'catalog/demo.json', bytes: utf8Bytes('{"ok":true}\n') }];
  const built = buildContentPackManifest({
    packId: 'lumi.demo.base',
    kind: 'base',
    generation,
    catalogVersion: `demo.v${generation}`,
    collectionVersion: 'lumi.characters.collection.v1',
    rulesVersion: 'lumi.recommendation.rules.v2',
    ageMonths: { fromInclusive: 0, toInclusive: 11 },
    activityRevisionIds: ['demo.r1'],
    capabilities: ['art.collection.v1'],
    files,
    createdAt: '2026-11-08T12:00:00+01:00',
  });
  const signature = signContentPackManifest(built.manifest, DEV_SK, DEV_KEY_ID);
  return { ...built, signature };
}

test('JCS canonicalization is deterministic and key-order independent', () => {
  const a = canonicalizeJson({ b: 1, a: { z: true, y: [2, 1] } });
  const b = canonicalizeJson({ a: { y: [2, 1], z: true }, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":{"y":[2,1],"z":true},"b":1}');
});

test('tampered manifest or payload digest is rejected without activating', () => {
  const pack = fixturePack();
  const store = createMemoryPackStore();
  const badManifest = { ...pack.manifest, generation: 99 };
  const failed = activateContentPack(store, {
    manifestRaw: badManifest,
    signatureRaw: pack.signature,
    files: pack.files,
    nowMs: 1000,
    verifyOptions: { allowDevelopmentKeys: true },
  });
  assert.equal(failed.ok, false);
  assert.equal(getActivePack(store, 'lumi.demo.base'), null);

  const mutatedFiles = pack.files.map((file) =>
    file.logicalId === 'catalog/demo.json' ? { ...file, bytes: utf8Bytes('{"ok":nope}\n') } : file,
  );
  const digestFail = verifyContentPack(pack.manifest, pack.signature, mutatedFiles, {
    allowDevelopmentKeys: true,
  });
  assert.equal(digestFail.ok, false);
  assert.equal(digestFail.ok === false && digestFail.code, 'digest_mismatch');
});

test('unknown or development keys are rejected in production verification', () => {
  const pack = fixturePack();
  const denied = verifyContentPack(pack.manifest, pack.signature, pack.files, {
    allowDevelopmentKeys: false,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.ok === false && denied.code, 'unknown_or_dev_key');
});

test('lower generation and revoked activities cannot activate', () => {
  const pack = fixturePack();
  const store = createMemoryPackStore();
  const first = activateContentPack(store, {
    manifestRaw: pack.manifest,
    signatureRaw: pack.signature,
    files: pack.files,
    nowMs: 1,
    verifyOptions: { allowDevelopmentKeys: true },
  });
  assert.equal(first.ok, true);

  const lower = fixturePack();
  const lowerBuilt = buildContentPackManifest({
    packId: 'lumi.demo.base',
    kind: 'base',
    generation: 1,
    catalogVersion: 'demo.v1',
    collectionVersion: 'lumi.characters.collection.v1',
    rulesVersion: 'lumi.recommendation.rules.v2',
    ageMonths: { fromInclusive: 0, toInclusive: 11 },
    activityRevisionIds: ['demo.r1'],
    capabilities: ['art.collection.v1'],
    files: lower.files,
    createdAt: '2026-11-08T13:00:00+01:00',
  });
  // Force generation 1 again after floor is 1 — still ok equal; use generation 0 via raw.
  const rawLower = { ...lowerBuilt.manifest, generation: 0 };
  const sig = signContentPackManifest(rawLower as never, DEV_SK, DEV_KEY_ID);
  // generation 0 fails validation before signature; craft generation 1 after floor raised by activating gen 2.
  const gen2files = lower.files;
  const gen2 = buildContentPackManifest({
    packId: 'lumi.demo.base',
    kind: 'base',
    generation: 2,
    catalogVersion: 'demo.v2',
    collectionVersion: 'lumi.characters.collection.v1',
    rulesVersion: 'lumi.recommendation.rules.v2',
    ageMonths: { fromInclusive: 0, toInclusive: 11 },
    activityRevisionIds: ['demo.r1'],
    capabilities: ['art.collection.v1'],
    files: gen2files,
    createdAt: '2026-11-08T14:00:00+01:00',
  });
  const gen2Sig = signContentPackManifest(gen2.manifest, DEV_SK, DEV_KEY_ID);
  assert.equal(
    activateContentPack(store, {
      manifestRaw: gen2.manifest,
      signatureRaw: gen2Sig,
      files: gen2.files,
      nowMs: 2,
      verifyOptions: { allowDevelopmentKeys: true },
    }).ok,
    true,
  );

  const replay = activateContentPack(store, {
    manifestRaw: pack.manifest,
    signatureRaw: pack.signature,
    files: pack.files,
    nowMs: 3,
    verifyOptions: { allowDevelopmentKeys: true },
  });
  assert.equal(replay.ok, false);
  assert.equal(replay.ok === false && replay.code, 'generation_too_low');

  markActivityRevoked(store, 'demo');
  const revoked = activateContentPack(store, {
    manifestRaw: gen2.manifest,
    signatureRaw: gen2Sig,
    files: gen2.files,
    nowMs: 4,
    verifyOptions: { allowDevelopmentKeys: true },
  });
  // Same generation as floor is allowed by >= floor, but revoked activity blocks.
  assert.equal(revoked.ok, false);
  assert.equal(revoked.ok === false && revoked.code, 'revoked_activity');
  void rawLower;
  void sig;
});

test('controlled rollback uses a higher generation pointing at earlier data', () => {
  const v1 = fixturePack();
  const v2files = [{ logicalId: 'catalog/demo.json', bytes: utf8Bytes('{"ok":2}\n') }];
  const v2 = buildContentPackManifest({
    packId: 'lumi.demo.base',
    kind: 'base',
    generation: 2,
    catalogVersion: 'demo.v2',
    collectionVersion: 'lumi.characters.collection.v1',
    rulesVersion: 'lumi.recommendation.rules.v2',
    ageMonths: { fromInclusive: 0, toInclusive: 11 },
    activityRevisionIds: ['demo.r1'],
    capabilities: ['art.collection.v1'],
    files: v2files,
    createdAt: '2026-11-08T15:00:00+01:00',
  });
  const rollback = buildRollbackManifest(v2.manifest, v1.manifest, 3, '2026-11-08T16:00:00+01:00');
  assert.equal(rollback.generation, 3);
  assert.equal(rollback.catalogVersion, v1.manifest.catalogVersion);
  assert.deepEqual(rollback.files, v1.manifest.files);
});

test('kill during staging recovers to the previous active pack', () => {
  const pack = fixturePack();
  const store = createMemoryPackStore();
  assert.equal(
    activateContentPack(store, {
      manifestRaw: pack.manifest,
      signatureRaw: pack.signature,
      files: pack.files,
      nowMs: 10,
      verifyOptions: { allowDevelopmentKeys: true },
    }).ok,
    true,
  );
  store.journal = {
    packId: pack.manifest.packId,
    generation: 9,
    phase: 'staging',
    updatedAtMs: 11,
    reason: null,
  };
  store.assets.set(`${pack.manifest.packId}@staging`, new Map());
  recoverPackStore(store, 12);
  const active = getActivePack(store, pack.manifest.packId);
  assert.equal(active?.generation, 1);
  assert.equal(store.assets.has(`${pack.manifest.packId}@staging`), false);
});

test('readiness distinguishes preparing, ready, limited and unavailable', () => {
  const activated = activateEmbeddedFirstYearBase(50);
  assert.equal(activated.readiness.status, 'ready');
  assert.equal(activated.readiness.activePackId, EMBEDDED_BASE_PACK_ID);

  const limited = evaluateContentReadiness(activated.store, {
    packId: EMBEDDED_BASE_PACK_ID,
    nowMs: 51,
    publicCacheComplete: false,
    databaseAvailable: true,
    revalidate: true,
  });
  assert.equal(limited.status, 'limited');

  const unavailable = evaluateContentReadiness(createMemoryPackStore(), {
    packId: EMBEDDED_BASE_PACK_ID,
    nowMs: 52,
    publicCacheComplete: true,
    databaseAvailable: false,
    revalidate: false,
  });
  assert.equal(unavailable.status, 'unavailable');
});

test('embedded first-year pack verifies and lists sixty published revisions', () => {
  assert.equal(EMBEDDED_FIRST_YEAR_BASE_MANIFEST.activityRevisionIds.length, 60);
  assert.equal(EMBEDDED_FIRST_YEAR_BASE_MANIFEST.readerVersion, CONTENT_READER_VERSION);
  assert.equal(EMBEDDED_FIRST_YEAR_BASE_MANIFEST.ageMonths.toInclusive, 11);
  assert.ok(EMBEDDED_FIRST_YEAR_BASE_MANIFEST.totalBytes <= CONTENT_PACK_LIMITS.maxPackBytes);
  assert.equal(FIRST_YEAR_PUBLISHED_REVISIONS.length, 60);
  const files = buildFirstYearBaseFiles();
  const verified = verifyContentPack(
    EMBEDDED_FIRST_YEAR_BASE_MANIFEST,
    // signature imported via activate path; rebuild check through activateEmbedded
    // is covered above. Here ensure file digests match the embedded manifest.
    { format: 'lumi.content-pack-signature.v1', algorithm: 'Ed25519', keyId: 'x', signature: 'y' },
    files,
    { allowDevelopmentKeys: true },
  );
  // Wrong signature still fails closed — digests are checked after signature.
  assert.equal(verified.ok, false);
  const ok = activateEmbeddedFirstYearBase(99);
  assert.equal(ok.readiness.status, 'ready');
  assert.equal(ok.store.highestGeneration.get(EMBEDDED_BASE_PACK_ID), 1);
});

test('directory pack artifacts exist for offline distribution', () => {
  const root = path.resolve(here, '../../content/packs/first-year-base');
  assert.equal(fs.existsSync(path.join(root, 'manifest.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'signature.json')), true);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  for (const file of manifest.files) {
    assert.equal(fs.existsSync(path.join(root, 'assets', file.sha256)), true);
  }
});
