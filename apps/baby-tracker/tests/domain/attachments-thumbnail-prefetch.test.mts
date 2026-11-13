import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ATTACHMENT_LIMITS,
  asAttachmentId,
  asChildId,
  asEntityId,
  asRenditionId,
  occupiedThumbnailPrefetchBytes,
  planThumbnailPrefetchJobs,
  type PhotoAttachment,
} from '../../src/domain/index.ts';

function missingPhoto(id: string, thumbBytes: number): PhotoAttachment {
  return {
    attachmentId: asAttachmentId(id),
    childId: asChildId('child_a'),
    eventId: asEntityId('note_1'),
    hostEventType: 'note',
    orderIndex: 0,
    caption: null,
    recordedBy: null,
    createdAtMs: 1,
    deletedAtMs: null,
    retainUntilMs: null,
    offlinePinned: false,
    localOrigin: 'downloaded',
    renditions: [
      {
        renditionId: asRenditionId(`ren_${id}_d`),
        attachmentId: asAttachmentId(id),
        role: 'display',
        mime: 'image/jpeg',
        width: 100,
        height: 80,
        byteLength: 1200,
        sha256: 'a'.repeat(64),
        normalizationVersion: ATTACHMENT_LIMITS.normalizationVersion,
        blobKey: `missing:ren_${id}_d`,
        availability: 'missing',
      },
      {
        renditionId: asRenditionId(`ren_${id}_t`),
        attachmentId: asAttachmentId(id),
        role: 'thumbnail',
        mime: 'image/jpeg',
        width: 40,
        height: 32,
        byteLength: thumbBytes,
        sha256: 'b'.repeat(64),
        normalizationVersion: ATTACHMENT_LIMITS.normalizationVersion,
        blobKey: `missing:ren_${id}_t`,
        availability: 'missing',
      },
    ],
  };
}

const familySession = {
  familySyncConfigured: true,
  activeFamilyId: 'fam_1',
  appUserId: 'user_1',
} as const;

const dayMs = 24 * 60 * 60 * 1000;

test('personal cold never plans thumbnail prefetch', () => {
  const planned = planThumbnailPrefetchJobs({
    session: {
      familySyncConfigured: false,
      activeFamilyId: null,
      appUserId: null,
    },
    candidates: [{ attachment: missingPhoto('a1', 100), referenceAtMs: 1_000 }],
    localAttachments: [],
    existingJobs: [],
    createJobId: (seed) => seed,
    nowMs: 1_000,
  });
  assert.equal(planned.jobs.length, 0);
});

test('prefetch queues only thumbnail jobs inside the 30-day window', () => {
  const nowMs = 1_000_000;
  const recent = missingPhoto('recent', 100);
  const old = missingPhoto('old', 100);
  const planned = planThumbnailPrefetchJobs({
    session: familySession,
    candidates: [
      { attachment: recent, referenceAtMs: nowMs - 2 * dayMs },
      { attachment: old, referenceAtMs: nowMs - 40 * dayMs },
    ],
    localAttachments: [],
    existingJobs: [],
    createJobId: (seed) => seed,
    nowMs,
  });
  assert.equal(planned.jobs.length, 1);
  assert.equal(planned.jobs[0]?.attachmentId, 'recent');
  assert.equal(planned.jobs[0]?.role, 'thumbnail');
  assert.equal(planned.skippedOutsideWindow, 1);
  assert.equal(
    planned.jobs.every((job) => job.role === 'thumbnail'),
    true,
  );
});

test('prefetch respects budget and prefers newer candidates', () => {
  const nowMs = 10_000;
  const newer = missingPhoto('newer', 80);
  const older = missingPhoto('older', 80);
  const planned = planThumbnailPrefetchJobs({
    session: familySession,
    candidates: [
      { attachment: older, referenceAtMs: nowMs - 100 },
      { attachment: newer, referenceAtMs: nowMs },
    ],
    localAttachments: [],
    existingJobs: [],
    createJobId: (seed) => seed,
    nowMs,
    occupiedBytes: 0,
    budgetBytes: 100,
  });
  assert.equal(planned.jobs.length, 1);
  assert.equal(planned.jobs[0]?.attachmentId, 'newer');
  assert.equal(planned.plannedBytes, 80);
  assert.equal(planned.skippedBudget, 1);
});

test('prefetch skips thumbnails that already have local bytes', () => {
  const nowMs = 5_000;
  const base = missingPhoto('cached', 50);
  const cached: PhotoAttachment = {
    ...base,
    renditions: base.renditions.map((row) =>
      row.role === 'thumbnail'
        ? { ...row, availability: 'cache' as const, blobKey: 'blob_cached_t' }
        : row,
    ),
  };
  const planned = planThumbnailPrefetchJobs({
    session: familySession,
    candidates: [{ attachment: cached, referenceAtMs: nowMs }],
    localAttachments: [cached],
    existingJobs: [],
    createJobId: (seed) => seed,
    nowMs,
  });
  assert.equal(planned.jobs.length, 0);
  assert.equal(occupiedThumbnailPrefetchBytes({ localAttachments: [cached] }), 50);
});

test('prefetch never invents display downloads', () => {
  const nowMs = 2_000;
  const photo = missingPhoto('only_thumb', 20);
  const planned = planThumbnailPrefetchJobs({
    session: familySession,
    candidates: [{ attachment: photo, referenceAtMs: nowMs }],
    localAttachments: [],
    existingJobs: [],
    createJobId: (seed) => seed,
    nowMs,
    budgetBytes: ATTACHMENT_LIMITS.thumbnailPrefetchBudgetBytes,
  });
  assert.equal(planned.jobs.length, 1);
  assert.equal(planned.jobs[0]?.role, 'thumbnail');
  assert.equal(
    planned.jobs.some((job) => job.role === 'display'),
    false,
  );
});
