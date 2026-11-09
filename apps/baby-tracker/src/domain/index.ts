export { AppError, isAppError } from './errors';
export type { AppErrorCode, AppErrorDetails } from './errors';
export type {
  ActorId,
  ChildId,
  DeviceId,
  EntityId,
  OperationId,
  RevisionId,
} from './ids';
export {
  asActorId,
  asChildId,
  asDeviceId,
  asEntityId,
  asOperationId,
  asRevisionId,
} from './ids';
export * from './time';
export * from './entities';
export * from './commands';
export {
  DOMAIN_VOCABULARY,
  type DomainVocabularyKey,
} from './vocabulary';
export {
  knownNursingActiveMs,
  knownSleepDurationMs,
  summarizeBottles,
  summarizeDiapers,
  summarizeFood,
  summarizeNursing,
  summarizeSleepForDay,
  type BottleDaySummary,
  type DiaperDaySummary,
  type FoodDaySummary,
  type NursingDaySummary,
  type SleepDaySummary,
} from './projections/careSummaries';
export {
  buildGrowthSeries,
  type GrowthSeries,
  type GrowthSeriesPoint,
} from './projections/growthSeries';
export { careSortAtMs } from './projections/careTime';
export {
  compareCareTimelineAsc,
  compareCareTimelineDesc,
  eventMatchesHistoryBucket,
  isBeforeTimelineCursor,
  isDurableHistoryRow,
  matchesLocalSearch,
  nextTimelineCursor,
  normalizeSearchText,
  searchableTextFromCareEvent,
  searchDocumentFromCareEvent,
  type CareSubtype,
  type HistoryBucket,
  type HistoryTimelineRow,
  type SearchDocument,
  type TimelineCursor,
} from './projections/historyQuery';
export {
  buildDailyCareOverview,
  buildWeeklyCareOverview,
  careEventTouchesLocalDay,
  type CareOverviewPeriod,
  type DailyCareOverview,
  type IndicatorMeta,
  type RunningCareIndicator,
  type TracedSummary,
  type WeeklyCareOverview,
} from './projections/careOverview';
export {
  buildWeeklyDevelopmentGlance,
  type WeeklyDevelopmentGlance,
  type WeeklyGlanceStatement,
} from './projections/weeklyDevelopmentGlance';

export {
  cmToDisplay,
  displayToCm,
  displayToKg,
  formatDisplayMeasure,
  kgToDisplay,
  parseDecimalInput,
  type LengthDisplayUnit,
  type WeightDisplayUnit,
} from './growth/units';
export type {
  AppMetaRepository,
  CarePage,
  CareRepository,
  Clock,
  DiarySnapshotRepository,
  DraftRepository,
  FaultInjection,
  FaultKind,
  IdGenerator,
  Instant,
  OutboxEntry,
  OutboxPort,
  ProfileRepository,
  RevisionRepository,
  SearchIndexRepository,
  SessionRepository,
  UnitOfWork,
  UnitOfWorkFactory,
} from './ports';
export * from './attachments';
export {
  DIARY_ARCHIVE_FORMAT,
  DIARY_ARCHIVE_MAX_COMPAT,
  buildDiaryArchiveManifest,
  compareDiaryArchives,
  createDiaryArchive,
  type DiaryArchive,
  type DiaryArchiveCompare,
  type DiaryArchiveManifest,
  type DiaryArchiveMetaEntry,
} from './backup/diaryArchive';
export {
  MAX_DIARY_ARCHIVE_BYTES,
  MAX_DIARY_CARE_EVENTS,
  MAX_DIARY_RELATED_ROWS,
  filterExportableMeta,
  isExportableMetaKey,
  parseDiaryArchive,
} from './backup/parseDiaryArchive';
export {
  careEventsToPrivateCsv,
  escapeCsvCell,
} from './backup/diaryCsv';
export {
  bottleContentsSchema,
  careOccurrenceSchema,
  diaperContentsSchema,
  measuredQuantitySchema,
  recordDiaperInputSchema,
  recordSleepInputSchema,
  sessionStatusSchema,
  timePrecisionSchema,
  zonedInstantSchema,
} from './schemas/careBoundary';
export {
  RECOMMENDATION_REASON_COPY_CS,
  RECOMMENDATION_RULES_VERSION,
  checkRecommendationSetValidity,
  evaluateEligibility,
  isActiveDailySet,
  markRecommendationHidden,
  markRecommendationOpened,
  markRecommendationReplaced,
  offerPresentation,
  reasonCopyCs,
  selectDailyOffers,
  withInvalidation,
  type ContentDurationLike,
  type ContentEnvironmentLike,
  type EligibilityDecision,
  type InvalidationCheck,
  type OfferPresentation,
  type ParentRecommendationContext,
  type RankedCandidate,
  type RecommendableCandidate,
  type RecommendationReasonCode,
  type SelectionResult,
  type SuitabilityConditionLike,
} from './recommendation';
export type { RecommendationSetStatus } from './entities/development';
export {
  bindLocalActorToVerifiedAccount,
  buildJoinPreview,
  completeEnrollment,
  isolateUnsentChangesAfterRevoke,
  markEnrollmentAwaitingNetwork,
  planHistoryMerge,
  requireEnrollmentCheckpoint,
  startEnrollmentIntent,
  type ChildLinkDecision,
  type EnrollmentIntent,
  type JoinPreview,
} from './family/enrollment';
export {
  buildAuthorshipLine,
  buildDeleteVsEditPresentation,
  buildDualSleepPresentation,
  buildEditConflictPresentation,
  previewMergedSleepInterval,
  unresolvedSleepUnionMs,
  type AuthorshipLine,
  type DeleteVsEditPresentation,
  type DualSleepMeasurement,
  type DualSleepPresentation,
  type EditConflictPresentation,
  type FieldDiff,
  type MergeSleepPreview,
} from './family/conflictPresentation';
export {
  canCommitResolutionDraft,
  createResolutionDraft,
  markResolutionDraftCommitted,
  refreshResolutionDraftAgainstHeads,
  type ResolutionDraft,
} from './family/resolutionDraft';
export {
  describeCopiesAfterLogout,
  planIsolatedArchiveRestore,
  type IsolatedRestorePlan,
} from './family/isolatedRestore';
export {
  presentRemoteBackupStatus,
  type RemoteBackupPresentation,
} from './family/remoteBackupPresentation';
export {
  applyPushReceipts,
  commitPullPage,
  createEmptySyncState,
  enqueueDurableOutbox,
  isolateRejectedFamilyPush,
  markOutboxAttempt,
  pendingOutbox,
  syncBackoffMs,
  type DurableOutboxEntry,
  type InboxEntry,
  type LocalSyncState,
} from './sync/transport';
export { runSyncTick, type SyncTransportPort, type SyncWorkerResult } from './sync/worker';
export {
  buildSyncTransferPresentation,
  type SyncTransferPresentation,
} from './sync/presentation';
export {
  buildFamilyDurabilityPresentation,
  describeRecordTransferLine,
  type BackupDurabilityInput,
  type DurabilityKind,
  type DurabilityRow,
  type FamilyDurabilityPresentation,
} from './sync/durabilityLabels';
export {
  applyRevision,
  bumpEraseGeneration,
  convergeByRevisions,
  createEmptyEntityGraph,
  detectConcurrentSleepSessions,
  isolateOutboxForResync,
  materializeTombstone,
  type ApplyResult,
  type ConflictRecord,
  type EntityGraphState,
  type GraphRevision,
  type TombstoneRecord,
} from './sync/causality';
