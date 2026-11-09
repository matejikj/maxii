import type { AttachmentObjectStorePort } from './objectStore.ts';

/**
 * Opaque family photo locator. Provider names the live object store; objectKey
 * stays the durable identity so offline clients keep the same attachment IDs.
 */
export type AttachmentObjectLocator = {
  readonly provider: string;
  readonly objectKey: string;
  readonly familyId: string;
  readonly attachmentId: string;
  readonly role: 'display' | 'thumbnail';
  readonly sha256: string;
  readonly byteLength: number;
};

export type AttachmentLocatorMigrationAbortReason =
  | 'source_missing'
  | 'digest_mismatch'
  | 'erased_during_copy'
  | 'staging_failed'
  | 'activate_failed'
  | 'destination_verify_failed';

export type AttachmentLocatorMigrationResult =
  | {
      readonly ok: true;
      readonly writeTarget: 'destination';
      readonly migrated: readonly AttachmentObjectLocator[];
      readonly sourcePurged: number;
    }
  | {
      readonly ok: false;
      readonly writeTarget: 'source';
      readonly reason: 'incomplete_set' | 'empty_set';
      readonly aborted: readonly {
        readonly locator: AttachmentObjectLocator;
        readonly reason: AttachmentLocatorMigrationAbortReason;
      }[];
      /** Destination activations are rolled back so an incomplete set never goes live. */
      readonly destinationRolledBack: number;
    };

/**
 * Controlled copy → verify → erase re-check → atomic locator switch between two
 * attachment object stores. Incomplete sets keep the source write target and
 * never leave a half-cutover destination live.
 */
export async function migrateAttachmentObjectLocators(input: {
  readonly source: AttachmentObjectStorePort;
  readonly destination: AttachmentObjectStorePort;
  readonly destinationProvider: string;
  readonly locators: readonly AttachmentObjectLocator[];
  readonly isAttachmentErased: (familyId: string, attachmentId: string) => boolean;
  readonly purgeSourceAfterSwitch?: boolean;
}): Promise<AttachmentLocatorMigrationResult> {
  if (input.locators.length === 0) {
    return {
      ok: false,
      writeTarget: 'source',
      reason: 'empty_set',
      aborted: [],
      destinationRolledBack: 0,
    };
  }

  const stagedKeys: string[] = [];
  const aborted: Array<{
    locator: AttachmentObjectLocator;
    reason: AttachmentLocatorMigrationAbortReason;
  }> = [];

  for (const locator of input.locators) {
    if (input.isAttachmentErased(locator.familyId, locator.attachmentId)) {
      aborted.push({ locator, reason: 'erased_during_copy' });
      continue;
    }
    const sourceObject = await input.source.readActivated(locator.objectKey);
    if (!sourceObject) {
      aborted.push({ locator, reason: 'source_missing' });
      continue;
    }
    if (
      sourceObject.sha256 !== locator.sha256 ||
      sourceObject.bytes.byteLength !== locator.byteLength
    ) {
      aborted.push({ locator, reason: 'digest_mismatch' });
      continue;
    }
    const staged = await input.destination.putStaging({
      objectKey: locator.objectKey,
      familyId: locator.familyId,
      attachmentId: locator.attachmentId,
      role: locator.role,
      bytes: sourceObject.bytes,
      expectedSha256: locator.sha256,
    });
    if (!staged.ok) {
      aborted.push({
        locator,
        reason: staged.reason === 'empty' ? 'staging_failed' : 'digest_mismatch',
      });
      continue;
    }
    stagedKeys.push(locator.objectKey);
  }

  if (aborted.length > 0 || stagedKeys.length !== input.locators.length) {
    const rolledBack = await rollbackDestination(input.destination, stagedKeys);
    return {
      ok: false,
      writeTarget: 'source',
      reason: 'incomplete_set',
      aborted,
      destinationRolledBack: rolledBack,
    };
  }

  // Second erase pass after bytes are staged — late tombstones must not publish.
  for (const locator of input.locators) {
    if (input.isAttachmentErased(locator.familyId, locator.attachmentId)) {
      aborted.push({ locator, reason: 'erased_during_copy' });
    }
  }
  if (aborted.length > 0) {
    const rolledBack = await rollbackDestination(input.destination, stagedKeys);
    return {
      ok: false,
      writeTarget: 'source',
      reason: 'incomplete_set',
      aborted,
      destinationRolledBack: rolledBack,
    };
  }

  const activatedKeys: string[] = [];
  for (const locator of input.locators) {
    const activated = await input.destination.activate(locator.objectKey);
    if (!activated) {
      aborted.push({ locator, reason: 'activate_failed' });
      const rolledBack = await rollbackDestination(input.destination, [
        ...activatedKeys,
        ...stagedKeys,
      ]);
      return {
        ok: false,
        writeTarget: 'source',
        reason: 'incomplete_set',
        aborted,
        destinationRolledBack: rolledBack,
      };
    }
    activatedKeys.push(locator.objectKey);
  }

  const migrated: AttachmentObjectLocator[] = [];
  for (const locator of input.locators) {
    const destObject = await input.destination.readActivated(locator.objectKey);
    if (
      !destObject ||
      destObject.sha256 !== locator.sha256 ||
      destObject.bytes.byteLength !== locator.byteLength
    ) {
      aborted.push({ locator, reason: 'destination_verify_failed' });
      const rolledBack = await rollbackDestination(input.destination, activatedKeys);
      return {
        ok: false,
        writeTarget: 'source',
        reason: 'incomplete_set',
        aborted,
        destinationRolledBack: rolledBack,
      };
    }
    migrated.push({
      ...locator,
      provider: input.destinationProvider,
    });
  }

  let sourcePurged = 0;
  if (input.purgeSourceAfterSwitch !== false) {
    for (const locator of input.locators) {
      if (await input.source.purgeActivated(locator.objectKey)) {
        sourcePurged += 1;
      }
    }
  }

  return {
    ok: true,
    writeTarget: 'destination',
    migrated,
    sourcePurged,
  };
}

async function rollbackDestination(
  destination: AttachmentObjectStorePort,
  objectKeys: readonly string[],
): Promise<number> {
  let count = 0;
  const unique = [...new Set(objectKeys)];
  for (const objectKey of unique) {
    // Prefer purge of activated rows; staging-only rows fall back to deleteStaging.
    const purged = await destination.purgeActivated(objectKey);
    if (purged) {
      count += 1;
      continue;
    }
    await destination.deleteStaging(objectKey);
    count += 1;
  }
  return count;
}
