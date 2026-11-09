import Dexie, { type EntityTable } from 'dexie';

/**
 * Personal web diary database. Versioned stores mirror the native schema so
 * domain UnitOfWork contracts stay identical. This is not SQLCipher-equivalent
 * protection — browser origin isolation is the boundary.
 *
 * App shell/content cache must use a different IndexedDB name so a future
 * service worker update never clears care records during a routine refresh.
 */
export const WEB_DIARY_DATABASE_NAME = 'lumi-web-diary';
export const WEB_APP_CACHE_DATABASE_NAME = 'lumi-web-app-cache';
export const WEB_SCHEMA_VERSION = 7;

export type WebChildProfileRow = {
  childId: string;
  displayName: string;
  birthDate: string | null;
  summaryTimeZone: string;
  payloadJson: string;
};

export type WebCareEventRow = {
  eventId: string;
  childId: string;
  eventType: string;
  revisionId: string;
  sortAtMs: number;
  payloadJson: string;
};

export type WebSessionRow = {
  sessionId: string;
  childId: string;
  kind: string;
  status: string;
  payloadJson: string;
};

export type WebDraftRow = {
  draftId: string;
  childId: string;
  formType: string;
  originalEventTimeMs: number;
  updatedAtMs: number;
  payloadJson: string;
};

export type WebRevisionRow = {
  revisionId: string;
  entityId: string;
  operationId: string;
  parentRevisionIdsJson: string;
  commandType: string;
  createdAtMs: number;
  deviceId: string | null;
  actorId: string | null;
  stateJson: string;
};

export type WebReceiptRow = {
  operationId: string;
  commandType: string;
  intentCapturedAtMs: number;
  completedAtMs: number;
  entityIdsJson: string;
  revisionIdsJson: string;
  resultCode: string;
};

export type WebDeletionRow = {
  deletionId: string;
  entityId: string;
  entityType: string;
  deletedAtMs: number;
  revisionId: string;
  retainUntilMs: number;
  payloadJson: string | null;
  payloadPurged: number;
};

export type WebMetaRow = {
  key: string;
  value: string;
};

export type WebLeaseRow = {
  leaseId: string;
  purpose: 'write' | 'migrate';
  ownerTabId: string;
  expiresAtMs: number;
  heartbeatAtMs: number;
};

export type WebChangeRow = {
  seq?: number;
  publishedAtMs: number;
  topicsJson: string;
  dataVersion: number;
};

export type WebSearchDocumentRow = {
  entityId: string;
  childId: string;
  sortAtMs: number;
  docType: string;
  textNormalized: string;
};

export type WebPhotoAttachmentRow = {
  attachmentId: string;
  childId: string;
  eventId: string;
  hostEventType: string;
  orderIndex: number;
  caption: string | null;
  recordedBy: string | null;
  createdAtMs: number;
  deletedAtMs: number | null;
  retainUntilMs: number | null;
  payloadJson: string;
};

export type WebPhotoAttachmentJobRow = {
  jobId: string;
  attachmentId: string;
  childId: string;
  eventId: string | null;
  state: string;
  errorCode: string | null;
  sourceMime: string;
  createdAtMs: number;
  updatedAtMs: number;
  payloadJson: string;
};

export type WebProjectRow = {
  projectId: string;
  childId: string;
  scope: string;
  status: string;
  ownerAppUserId: string | null;
  creatorAppUserId: string | null;
  familyId: string | null;
  templateRevisionId: string | null;
  updatedAtMs: number;
  payloadJson: string;
};

export type WebPortfolioItemRow = {
  portfolioItemId: string;
  projectId: string;
  childId: string;
  ownerAppUserId: string | null;
  createdAtMs: number;
  payloadJson: string;
};

export type WebShareSnapshotRow = {
  shareId: string;
  sourceProjectId: string;
  ownerAppUserId: string;
  revokedAtMs: number | null;
  createdAtMs: number;
  payloadJson: string;
};

export class LumiWebDatabase extends Dexie {
  childProfiles!: EntityTable<WebChildProfileRow, 'childId'>;
  careEvents!: EntityTable<WebCareEventRow, 'eventId'>;
  sessions!: EntityTable<WebSessionRow, 'sessionId'>;
  drafts!: EntityTable<WebDraftRow, 'draftId'>;
  revisions!: EntityTable<WebRevisionRow, 'revisionId'>;
  operationReceipts!: EntityTable<WebReceiptRow, 'operationId'>;
  deletionMarkers!: EntityTable<WebDeletionRow, 'deletionId'>;
  meta!: EntityTable<WebMetaRow, 'key'>;
  changeNotifications!: EntityTable<WebChangeRow, 'seq'>;
  searchDocuments!: EntityTable<WebSearchDocumentRow, 'entityId'>;
  photoAttachments!: EntityTable<WebPhotoAttachmentRow, 'attachmentId'>;
  photoAttachmentJobs!: EntityTable<WebPhotoAttachmentJobRow, 'jobId'>;
  projects!: EntityTable<WebProjectRow, 'projectId'>;
  portfolioItems!: EntityTable<WebPortfolioItemRow, 'portfolioItemId'>;
  shareSnapshots!: EntityTable<WebShareSnapshotRow, 'shareId'>;

  constructor(databaseName = WEB_DIARY_DATABASE_NAME) {
    super(databaseName);
    // v1 was the stack-probe shape; upgrading replaces it with the diary schema.
    this.version(1).stores({
      careEvents: 'eventId, childId, recordedAtIso, type',
      meta: 'key',
    });
    this.version(2)
      .stores({
        childProfiles: 'childId',
        careEvents: 'eventId, childId, sortAtMs, eventType',
        sessions: 'sessionId, [childId+kind], status',
        drafts: 'draftId, childId, updatedAtMs',
        revisions: 'revisionId, entityId, operationId',
        operationReceipts: 'operationId',
        deletionMarkers: 'deletionId, entityId',
        meta: 'key',
        changeNotifications: '++seq, publishedAtMs, dataVersion',
      })
      .upgrade(async (tx) => {
        // Drop legacy probe rows that do not match the diary contract.
        await tx.table('careEvents').clear();
      });
    this.version(3).stores({
      childProfiles: 'childId',
      careEvents: 'eventId, childId, sortAtMs, eventType',
      sessions: 'sessionId, [childId+kind], status',
      drafts: 'draftId, childId, updatedAtMs',
      revisions: 'revisionId, entityId, operationId',
      operationReceipts: 'operationId',
      deletionMarkers: 'deletionId, entityId, retainUntilMs',
      meta: 'key',
      changeNotifications: '++seq, publishedAtMs, dataVersion',
    });
    this.version(4)
      .stores({
        childProfiles: 'childId',
        careEvents: 'eventId, childId, sortAtMs, eventType',
        sessions: 'sessionId, [childId+kind], status',
        drafts: 'draftId, childId, updatedAtMs',
        revisions: 'revisionId, entityId, operationId',
        operationReceipts: 'operationId',
        deletionMarkers: 'deletionId, entityId, retainUntilMs',
        meta: 'key',
        changeNotifications: '++seq, publishedAtMs, dataVersion',
        searchDocuments: 'entityId, childId, sortAtMs, textNormalized',
      })
      .upgrade(async (tx) => {
        // Rebuildable index — empty until care saves or an explicit rebuild.
        await tx.table('searchDocuments').clear();
      });
    this.version(5).stores({
      childProfiles: 'childId',
      careEvents: 'eventId, childId, sortAtMs, eventType',
      sessions: 'sessionId, [childId+kind], status',
      drafts: 'draftId, childId, updatedAtMs',
      revisions: 'revisionId, entityId, operationId',
      operationReceipts: 'operationId',
      deletionMarkers: 'deletionId, entityId, retainUntilMs',
      meta: 'key',
      changeNotifications: '++seq, publishedAtMs, dataVersion',
      searchDocuments: 'entityId, childId, sortAtMs, textNormalized',
      photoAttachments: 'attachmentId, childId, eventId, orderIndex, createdAtMs',
      photoAttachmentJobs: 'jobId, attachmentId, eventId, updatedAtMs',
    });
    this.version(6).stores({
      childProfiles: 'childId',
      careEvents: 'eventId, childId, sortAtMs, eventType',
      sessions: 'sessionId, [childId+kind], status',
      drafts: 'draftId, childId, updatedAtMs',
      revisions: 'revisionId, entityId, operationId',
      operationReceipts: 'operationId',
      deletionMarkers: 'deletionId, entityId, retainUntilMs',
      meta: 'key',
      changeNotifications: '++seq, publishedAtMs, dataVersion',
      searchDocuments: 'entityId, childId, sortAtMs, textNormalized',
      photoAttachments: 'attachmentId, childId, eventId, orderIndex, createdAtMs',
      photoAttachmentJobs: 'jobId, attachmentId, eventId, updatedAtMs',
      projects: 'projectId, childId, scope, status, updatedAtMs',
    });
    this.version(WEB_SCHEMA_VERSION).stores({
      childProfiles: 'childId',
      careEvents: 'eventId, childId, sortAtMs, eventType',
      sessions: 'sessionId, [childId+kind], status',
      drafts: 'draftId, childId, updatedAtMs',
      revisions: 'revisionId, entityId, operationId',
      operationReceipts: 'operationId',
      deletionMarkers: 'deletionId, entityId, retainUntilMs',
      meta: 'key',
      changeNotifications: '++seq, publishedAtMs, dataVersion',
      searchDocuments: 'entityId, childId, sortAtMs, textNormalized',
      photoAttachments: 'attachmentId, childId, eventId, orderIndex, createdAtMs',
      photoAttachmentJobs: 'jobId, attachmentId, eventId, updatedAtMs',
      projects: 'projectId, childId, scope, status, updatedAtMs',
      portfolioItems: 'portfolioItemId, projectId, childId, createdAtMs',
      shareSnapshots: 'shareId, sourceProjectId, ownerAppUserId, createdAtMs',
    });
  }
}
