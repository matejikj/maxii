import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { migrateAttachmentObjectLocators } from '../src/attachments/attachmentObjectLocatorMigration.ts';
import { runAttachmentLocatorMigrationDrill } from '../src/attachments/attachmentLocatorMigrationDrill.ts';
import { createMemoryAttachmentObjectStore } from '../src/attachments/objectStore.ts';
import { createR2AttachmentObjectStore } from '../src/attachments/r2AttachmentObjectStore.ts';
import { createS3CompatibleClient } from '../src/attachments/s3CompatibleClient.ts';

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function seedActivated(
  store: ReturnType<typeof createMemoryAttachmentObjectStore>,
  input: {
    objectKey: string;
    familyId: string;
    attachmentId: string;
    role: 'display' | 'thumbnail';
    bytes: Uint8Array;
  },
) {
  const sha256 = sha256Hex(input.bytes);
  const staged = await store.putStaging({
    ...input,
    expectedSha256: sha256,
  });
  assert.equal(staged.ok, true);
  assert.equal(await store.activate(input.objectKey), true);
  return sha256;
}

test('complete locator migration switches write target and purges source', async () => {
  const source = createMemoryAttachmentObjectStore();
  const destination = createMemoryAttachmentObjectStore();
  const display = Uint8Array.from([10, 20, 30]);
  const thumb = Uint8Array.from([40, 50]);
  const displayKey = 'fam/f1/att/a1/display/i1';
  const thumbKey = 'fam/f1/att/a1/thumb/i1';
  const displaySha = await seedActivated(source, {
    objectKey: displayKey,
    familyId: 'f1',
    attachmentId: 'a1',
    role: 'display',
    bytes: display,
  });
  const thumbSha = await seedActivated(source, {
    objectKey: thumbKey,
    familyId: 'f1',
    attachmentId: 'a1',
    role: 'thumbnail',
    bytes: thumb,
  });

  const result = await migrateAttachmentObjectLocators({
    source,
    destination,
    destinationProvider: 'supabase_eu',
    locators: [
      {
        provider: 'r2_eu',
        objectKey: displayKey,
        familyId: 'f1',
        attachmentId: 'a1',
        role: 'display',
        sha256: displaySha,
        byteLength: display.byteLength,
      },
      {
        provider: 'r2_eu',
        objectKey: thumbKey,
        familyId: 'f1',
        attachmentId: 'a1',
        role: 'thumbnail',
        sha256: thumbSha,
        byteLength: thumb.byteLength,
      },
    ],
    isAttachmentErased: () => false,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.writeTarget, 'destination');
  assert.equal(result.sourcePurged, 2);
  assert.equal(result.migrated.every((row) => row.provider === 'supabase_eu'), true);
  assert.equal((await source.readActivated(displayKey)) == null, true);
  assert.equal((await destination.readActivated(displayKey))?.sha256, displaySha);
  assert.equal((await destination.readActivated(thumbKey))?.sha256, thumbSha);
});

test('erasure mid-migration keeps source write target and rolls back destination', async () => {
  const source = createMemoryAttachmentObjectStore();
  const destination = createMemoryAttachmentObjectStore();
  const erased = new Set<string>();
  const bytesA = Uint8Array.from([1, 1, 1]);
  const bytesB = Uint8Array.from([2, 2, 2]);
  const keyA = 'fam/f1/att/a/display/i';
  const keyB = 'fam/f1/att/b/display/i';
  const shaA = await seedActivated(source, {
    objectKey: keyA,
    familyId: 'f1',
    attachmentId: 'a',
    role: 'display',
    bytes: bytesA,
  });
  const shaB = await seedActivated(source, {
    objectKey: keyB,
    familyId: 'f1',
    attachmentId: 'b',
    role: 'display',
    bytes: bytesB,
  });

  // Erase B before the batch so the complete-set gate refuses cutover.
  erased.add('b');
  const result = await migrateAttachmentObjectLocators({
    source,
    destination,
    destinationProvider: 'supabase_eu',
    locators: [
      {
        provider: 'r2_eu',
        objectKey: keyA,
        familyId: 'f1',
        attachmentId: 'a',
        role: 'display',
        sha256: shaA,
        byteLength: bytesA.byteLength,
      },
      {
        provider: 'r2_eu',
        objectKey: keyB,
        familyId: 'f1',
        attachmentId: 'b',
        role: 'display',
        sha256: shaB,
        byteLength: bytesB.byteLength,
      },
    ],
    isAttachmentErased: (_familyId, attachmentId) => erased.has(attachmentId),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.writeTarget, 'source');
  assert.equal(result.reason, 'incomplete_set');
  assert.equal((await destination.readActivated(keyA)) == null, true);
  assert.equal((await destination.readActivated(keyB)) == null, true);
  assert.equal((await source.readActivated(keyA))?.sha256, shaA);
  assert.equal((await source.readActivated(keyB))?.sha256, shaB);
});

test('late erase after staging still refuses destination activation', async () => {
  const source = createMemoryAttachmentObjectStore();
  const destination = createMemoryAttachmentObjectStore();
  const erased = new Set<string>();
  const bytes = Uint8Array.from([7, 7, 7, 7]);
  const objectKey = 'fam/f1/att/late/display/i';
  const sha256 = await seedActivated(source, {
    objectKey,
    familyId: 'f1',
    attachmentId: 'late',
    role: 'display',
    bytes,
  });

  const originalPut = destination.putStaging.bind(destination);
  destination.putStaging = async (request) => {
    const staged = await originalPut(request);
    // Tombstone arrives after bytes land in destination staging.
    erased.add(request.attachmentId);
    return staged;
  };

  const result = await migrateAttachmentObjectLocators({
    source,
    destination,
    destinationProvider: 'supabase_eu',
    locators: [
      {
        provider: 'r2_eu',
        objectKey,
        familyId: 'f1',
        attachmentId: 'late',
        role: 'display',
        sha256,
        byteLength: bytes.byteLength,
      },
    ],
    isAttachmentErased: (_familyId, attachmentId) => erased.has(attachmentId),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.writeTarget, 'source');
  assert.equal(result.aborted[0]?.reason, 'erased_during_copy');
  assert.equal((await destination.readActivated(objectKey)) == null, true);
  assert.equal((await source.readActivated(objectKey))?.sha256, sha256);
});

test('R2-shaped adapter supports purgeActivated used by locator cutover', async () => {
  const objects = new Map<string, Uint8Array>();
  const client = {
    async putObject(objectKey: string, bytes: Uint8Array) {
      objects.set(objectKey, Uint8Array.from(bytes));
      return true;
    },
    async getObject(objectKey: string) {
      return objects.get(objectKey) ?? null;
    },
    async deleteObject(objectKey: string) {
      objects.delete(objectKey);
      return true;
    },
  };
  // Narrow test double — signed HTTP client is covered elsewhere.
  const store = createR2AttachmentObjectStore({
    client: client as unknown as ReturnType<typeof createS3CompatibleClient>,
  });
  const bytes = Uint8Array.from([3, 3, 3]);
  const sha256 = sha256Hex(bytes);
  const objectKey = 'fam/f1/att/r2/display/i';
  assert.equal(
    (
      await store.putStaging({
        objectKey,
        familyId: 'f1',
        attachmentId: 'r2',
        role: 'display',
        bytes,
        expectedSha256: sha256,
      })
    ).ok,
    true,
  );
  assert.equal(await store.activate(objectKey), true);
  assert.ok(await store.readActivated(objectKey));
  assert.equal(await store.purgeActivated(objectKey), true);
  assert.equal(await store.readActivated(objectKey), null);
});

test('attachment locator migration drill passes locally without cloud credentials', async () => {
  const drill = await runAttachmentLocatorMigrationDrill();
  assert.equal(drill.ok, true, JSON.stringify(drill.cases, null, 2));
});
