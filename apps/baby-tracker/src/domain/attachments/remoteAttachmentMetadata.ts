import {
  asAttachmentId,
  asRenditionId,
  type AttachmentHostEventType,
  type PhotoAttachment,
  type RenditionRole,
} from './types';

/**
 * Metadata-only family sync body. JPEG bytes never appear here — digests and
 * dimensions travel with the revision so the peer can show a truthful missing
 * state and queue a download.
 */
export type RemoteAttachmentMetadataPayload = {
  readonly attachmentId: string;
  readonly childId: string;
  readonly eventId: string;
  readonly hostEventType: AttachmentHostEventType;
  readonly orderIndex: number;
  readonly caption: string | null;
  readonly deletedAt: string | null;
  readonly eraseGeneration: number | null;
  readonly renditions: readonly {
    readonly renditionId: string;
    readonly role: RenditionRole;
    readonly mime: 'image/jpeg';
    readonly width: number;
    readonly height: number;
    readonly byteLength: number;
    readonly sha256: string;
    readonly normalizationVersion: string;
  }[];
};

export type RemoteAttachmentMetadataEntry = {
  readonly kind: 'attachment.upsert' | 'attachment.tombstone';
  readonly payload: Readonly<Record<string, unknown>>;
};

export function isRemoteAttachmentMetadataPayload(
  value: unknown,
): value is RemoteAttachmentMetadataPayload {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (
    typeof row.attachmentId !== 'string' ||
    typeof row.childId !== 'string' ||
    typeof row.eventId !== 'string' ||
    !Array.isArray(row.renditions)
  ) {
    return false;
  }
  const host = row.hostEventType;
  return host === 'note' || host === 'milestone' || host === 'experience';
}

/**
 * Build a local attachment row from remote metadata. Renditions start as
 * missing so UI can say the photo is not downloaded without implying deletion.
 */
export function photoAttachmentFromRemoteMetadata(
  payload: RemoteAttachmentMetadataPayload,
): PhotoAttachment {
  const attachmentId = asAttachmentId(payload.attachmentId);
  const deletedAtMs =
    payload.deletedAt == null ? null : Date.parse(payload.deletedAt);
  return {
    attachmentId,
    childId: payload.childId as PhotoAttachment['childId'],
    eventId: payload.eventId as PhotoAttachment['eventId'],
    hostEventType: payload.hostEventType,
    orderIndex: payload.orderIndex,
    caption: payload.caption,
    recordedBy: null,
    createdAtMs: 0,
    deletedAtMs: Number.isFinite(deletedAtMs) ? deletedAtMs : null,
    retainUntilMs: null,
    offlinePinned: false,
    // Family peers start as downloads — recoverable cache until pinned.
    localOrigin: 'downloaded',
    renditions: payload.renditions.map((row) => ({
      renditionId: asRenditionId(row.renditionId),
      attachmentId,
      role: row.role,
      mime: 'image/jpeg',
      width: row.width,
      height: row.height,
      byteLength: row.byteLength,
      sha256: row.sha256,
      normalizationVersion: row.normalizationVersion,
      blobKey: `missing:${row.renditionId}`,
      availability: 'missing',
    })),
  };
}

/**
 * Prefer keeping durable/cache/pending local bytes when remote metadata arrives
 * for an attachment we already own on this device.
 */
export function mergeRemoteAttachmentMetadata(input: {
  readonly remote: PhotoAttachment;
  readonly local: PhotoAttachment | null;
}): PhotoAttachment {
  if (!input.local) return input.remote;
  if (input.remote.deletedAtMs != null) {
    return {
      ...input.local,
      caption: input.remote.caption,
      orderIndex: input.remote.orderIndex,
      deletedAtMs: input.remote.deletedAtMs,
      retainUntilMs: input.local.retainUntilMs,
      // Keep the local pin intent across remote tombstone metadata merges.
      offlinePinned: input.local.offlinePinned === true,
      localOrigin: input.local.localOrigin ?? 'imported',
    };
  }
  const localByRendition = new Map(
    input.local.renditions.map((row) => [row.renditionId, row]),
  );
  return {
    ...input.local,
    caption: input.remote.caption,
    orderIndex: input.remote.orderIndex,
    deletedAtMs: null,
    retainUntilMs: null,
    offlinePinned: input.local.offlinePinned === true,
    localOrigin: input.local.localOrigin ?? 'imported',
    renditions: input.remote.renditions.map((remoteRow) => {
      const localRow = localByRendition.get(remoteRow.renditionId);
      if (
        localRow &&
        (localRow.availability === 'durable' ||
          localRow.availability === 'cache' ||
          localRow.availability === 'pending')
      ) {
        return localRow;
      }
      return remoteRow;
    }),
  };
}

export function parseRemoteAttachmentMetadataEntries(
  entries: readonly RemoteAttachmentMetadataEntry[],
): {
  readonly upserts: RemoteAttachmentMetadataPayload[];
  readonly tombstones: RemoteAttachmentMetadataPayload[];
  readonly rejected: number;
} {
  const upserts: RemoteAttachmentMetadataPayload[] = [];
  const tombstones: RemoteAttachmentMetadataPayload[] = [];
  let rejected = 0;
  for (const entry of entries) {
    if (!isRemoteAttachmentMetadataPayload(entry.payload)) {
      rejected += 1;
      continue;
    }
    if (entry.kind === 'attachment.tombstone' || entry.payload.deletedAt != null) {
      tombstones.push(entry.payload);
      continue;
    }
    upserts.push(entry.payload);
  }
  return { upserts, tombstones, rejected };
}
