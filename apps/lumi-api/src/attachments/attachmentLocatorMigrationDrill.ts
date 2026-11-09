import { createHash } from 'node:crypto';
import {
  migrateAttachmentObjectLocators,
  type AttachmentObjectLocator,
} from './attachmentObjectLocatorMigration.ts';
import { createMemoryAttachmentObjectStore } from './objectStore.ts';

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Local software drill for changing the family photo object-store locator.
 * Uses two in-memory stores so CI never needs a live R2/Supabase bucket.
 */
export async function runAttachmentLocatorMigrationDrill(): Promise<{
  readonly ok: boolean;
  readonly cases: readonly { readonly name: string; readonly ok: boolean; readonly detail: string }[];
}> {
  const cases: Array<{ name: string; ok: boolean; detail: string }> = [];

  {
    const source = createMemoryAttachmentObjectStore();
    const destination = createMemoryAttachmentObjectStore();
    const bytes = Uint8Array.from([1, 2, 3, 4, 5, 6]);
    const sha256 = sha256Hex(bytes);
    const locator: AttachmentObjectLocator = {
      provider: 'memory_source',
      objectKey: 'fam/f1/att/a1/display/i1',
      familyId: 'f1',
      attachmentId: 'a1',
      role: 'display',
      sha256,
      byteLength: bytes.byteLength,
    };
    await source.putStaging({
      objectKey: locator.objectKey,
      familyId: locator.familyId,
      attachmentId: locator.attachmentId,
      role: locator.role,
      bytes,
      expectedSha256: sha256,
    });
    await source.activate(locator.objectKey);

    const result = await migrateAttachmentObjectLocators({
      source,
      destination,
      destinationProvider: 'memory_dest',
      locators: [locator],
      isAttachmentErased: () => false,
    });
    const dest = await destination.readActivated(locator.objectKey);
    const srcGone = (await source.readActivated(locator.objectKey)) == null;
    const ok =
      result.ok &&
      result.writeTarget === 'destination' &&
      dest?.sha256 === sha256 &&
      srcGone &&
      result.migrated[0]?.provider === 'memory_dest';
    cases.push({
      name: 'complete_cutover_purges_source',
      ok,
      detail: ok
        ? 'destination live; source purged'
        : `result=${JSON.stringify(result)} dest=${dest != null} srcGone=${srcGone}`,
    });
  }

  {
    const source = createMemoryAttachmentObjectStore();
    const destination = createMemoryAttachmentObjectStore();
    const erased = new Set<string>(['a-erased']);
    const locators: AttachmentObjectLocator[] = [];
    for (const [attachmentId, payload] of [
      ['a-live', Uint8Array.from([9, 9, 9])],
      ['a-erased', Uint8Array.from([8, 8, 8])],
    ] as const) {
      const sha256 = sha256Hex(payload);
      const objectKey = `fam/f1/att/${attachmentId}/display/i`;
      await source.putStaging({
        objectKey,
        familyId: 'f1',
        attachmentId,
        role: 'display',
        bytes: payload,
        expectedSha256: sha256,
      });
      await source.activate(objectKey);
      locators.push({
        provider: 'memory_source',
        objectKey,
        familyId: 'f1',
        attachmentId,
        role: 'display',
        sha256,
        byteLength: payload.byteLength,
      });
    }

    const result = await migrateAttachmentObjectLocators({
      source,
      destination,
      destinationProvider: 'memory_dest',
      locators,
      isAttachmentErased: (_familyId, attachmentId) => erased.has(attachmentId),
    });
    const destLive = await destination.readActivated(locators[0]!.objectKey);
    const destErasedAttempt = await destination.readActivated(locators[1]!.objectKey);
    const sourceStill = await source.readActivated(locators[0]!.objectKey);
    const ok =
      !result.ok &&
      result.writeTarget === 'source' &&
      destLive == null &&
      destErasedAttempt == null &&
      sourceStill != null;
    cases.push({
      name: 'erase_during_copy_keeps_source_write_target',
      ok,
      detail: ok
        ? 'incomplete set rolled back'
        : `result=${JSON.stringify(result)} destLive=${destLive != null}`,
    });
  }

  {
    const source = createMemoryAttachmentObjectStore();
    const destination = createMemoryAttachmentObjectStore();
    const bytes = Uint8Array.from([4, 4, 4, 4]);
    const sha256 = sha256Hex(bytes);
    const locator: AttachmentObjectLocator = {
      provider: 'memory_source',
      objectKey: 'fam/f1/att/a2/thumb/i2',
      familyId: 'f1',
      attachmentId: 'a2',
      role: 'thumbnail',
      sha256,
      byteLength: bytes.byteLength,
    };
    await source.putStaging({
      objectKey: locator.objectKey,
      familyId: locator.familyId,
      attachmentId: locator.attachmentId,
      role: locator.role,
      bytes,
      expectedSha256: sha256,
    });
    await source.activate(locator.objectKey);
    // Corrupt the recorded digest so verify fails before cutover.
    const badLocator = { ...locator, sha256: '0'.repeat(64) };
    const result = await migrateAttachmentObjectLocators({
      source,
      destination,
      destinationProvider: 'memory_dest',
      locators: [badLocator],
      isAttachmentErased: () => false,
    });
    const dest = await destination.readActivated(locator.objectKey);
    const src = await source.readActivated(locator.objectKey);
    const ok = !result.ok && dest == null && src != null;
    cases.push({
      name: 'digest_mismatch_does_not_activate_destination',
      ok,
      detail: ok ? 'source retained' : `result=${JSON.stringify(result)}`,
    });
  }

  return {
    ok: cases.every((row) => row.ok),
    cases,
  };
}
