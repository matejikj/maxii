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
