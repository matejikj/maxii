import {
  createDiaryArchive,
  type CareEvent,
  type DiaryArchive,
  type Draft,
  type SessionRecord,
  type ChildProfile,
  type Revision,
  type OperationReceipt,
  type DeletionMarker,
} from '../../domain';

/** Build the logical archive once adapters have listed every durable table. */
export function assembleDiaryArchive(input: {
  createdAtMs: number;
  schemaCompatibility: number;
  profiles: ChildProfile[];
  careEvents: CareEvent[];
  sessions: SessionRecord[];
  drafts: Draft[];
  revisions: Revision[];
  receipts: OperationReceipt[];
  deletions: DeletionMarker[];
  meta: { key: string; value: string }[];
}): DiaryArchive {
  return createDiaryArchive(input);
}
