import type { CareEvent } from '../entities/careEvent';
import type { Draft } from '../entities/draft';
import type { EntityId, RevisionId } from '../ids';
import type { CareWriteCommand } from './careCommands';
import type { CommandIntent } from './results';
import type { SessionCommand } from './sessionCommands';

export type SoftDeleteCareCommand = CommandIntent & {
  type: 'softDeleteCare';
  eventId: EntityId;
  deletionId: EntityId;
  revisionId: RevisionId;
};

export type RestoreCareCommand = CommandIntent & {
  type: 'restoreCare';
  eventId: EntityId;
  deletionId: EntityId;
  revisionId: RevisionId;
  /** Soft-delete revision that must still be the trash head; blocks blind restore. */
  expectedDeletionRevisionId: RevisionId;
};

export type SaveDraftCommand = CommandIntent & {
  type: 'saveDraft';
  draft: Draft;
  revisionId: RevisionId;
};

export type DiscardDraftCommand = CommandIntent & {
  type: 'discardDraft';
  draftId: EntityId;
  revisionId: RevisionId;
};

export type UndoCreateCareCommand = CommandIntent & {
  type: 'undoCreateCare';
  eventId: EntityId;
  /** Revision written by the create we are reversing. */
  expectedRevisionId: RevisionId;
  deletionId: EntityId;
  revisionId: RevisionId;
};

export type UndoSoftDeleteCommand = CommandIntent & {
  type: 'undoSoftDelete';
  eventId: EntityId;
  deletionId: EntityId;
  expectedDeletionRevisionId: RevisionId;
  revisionId: RevisionId;
};

export type PurgeExpiredTrashCommand = CommandIntent & {
  type: 'purgeExpiredTrash';
  revisionId: RevisionId;
};

export type LifecycleCommand =
  | SoftDeleteCareCommand
  | RestoreCareCommand
  | SaveDraftCommand
  | DiscardDraftCommand
  | UndoCreateCareCommand
  | UndoSoftDeleteCommand
  | PurgeExpiredTrashCommand;

/** Optional optimistic-concurrency token turns a create-shaped write into an update. */
export type CareMutationCommand = CareWriteCommand & {
  expectedRevisionId?: RevisionId;
};

export type ApplicationCommand = CareMutationCommand | LifecycleCommand | SessionCommand;

export type SoftDeletedCarePayload = {
  kind: 'careEvent';
  event: CareEvent;
};

export type CareWriteRevisionState = {
  kind: 'careWrite';
  fingerprint: string;
  entity: CareEvent;
};

export type SoftDeleteRevisionState = {
  kind: 'softDelete';
  fingerprint: string;
  entity: CareEvent;
};

export type RestoreRevisionState = {
  kind: 'restore';
  fingerprint: string;
  entity: CareEvent;
};

export type DraftRevisionState = {
  kind: 'draftSave' | 'draftDiscard';
  fingerprint: string;
  draftId: EntityId;
};
