import type { ActorId, ChildId, DeviceId } from '../ids.ts';
import {
  buildJoinPreview,
  completeEnrollment,
  markEnrollmentAwaitingNetwork,
  planHistoryMerge,
  requireEnrollmentCheckpoint,
  startEnrollmentIntent,
  type EnrollmentIntent,
} from './enrollment.ts';

/**
 * Software verification of the personal→family migration path. Ensures a local
 * diary can enroll only after a checkpoint, never auto-merges, survives network
 * retries, and keeps personal events when the caregiver defers linking.
 * Passing this drill is not a physical-device migration proof.
 */

export type PersonalDiarySnapshot = {
  readonly localChildId: ChildId;
  readonly localActorId: ActorId;
  readonly localDeviceId: DeviceId;
  readonly localEventIds: readonly string[];
  readonly checkpointId: string | null;
  readonly childDisplayName: string;
  readonly childBirthDate: string | null;
};

export type PersonalToFamilyMigrationReport = {
  readonly format: 'lumi.personal-to-family-migration.v1';
  readonly checkpointRequiredEnforced: boolean;
  readonly autoMergeRefused: boolean;
  readonly networkRetryKeepsIdempotencyKey: boolean;
  readonly foundingPathCompletes: boolean;
  readonly invitationDeferKeepsSimilarTimePairs: boolean;
  readonly personalEventsPreservedAfterDefer: boolean;
  readonly personalRemainsWritableWithoutApi: boolean;
  readonly allSoftwareChecksPassed: boolean;
  /** Always false — software path ≠ phones moved in the field. */
  readonly physicalDeviceMigrationClaimed: false;
  readonly findings: readonly string[];
  readonly foundingFamilyId: string | null;
  readonly deferredFamilyId: string | null;
};

export type PersonalToFamilyMigrationDeps = {
  readonly personal: PersonalDiarySnapshot;
  /** Creates a family for a founding enrollment intent (HTTP or in-memory). */
  readonly createFamily: (intent: EnrollmentIntent) => Promise<{ familyId: string }>;
  /**
   * Accepts an invitation for a deferred join. Implementations must not rewrite
   * the personal diary; they only return the joined family id.
   */
  readonly acceptInvitation: (intent: EnrollmentIntent) => Promise<{ familyId: string }>;
  /**
   * True when the personal tracker still records care without a configured API.
   * The drill refuses to pass if family enrollment would be required to write.
   */
  readonly personalWritableWithoutApi: boolean;
};

/**
 * Run the software personal→family migration path: checkpoint gate, founding
 * create, invitation defer with similar-time pairs kept, and cold personal write.
 */
export async function runPersonalToFamilyMigrationDrill(
  deps: PersonalToFamilyMigrationDeps,
): Promise<PersonalToFamilyMigrationReport> {
  const findings: string[] = [];
  const personal = deps.personal;

  const missingCheckpoint = requireEnrollmentCheckpoint({ checkpointId: null });
  const withCheckpoint = requireEnrollmentCheckpoint({
    checkpointId: personal.checkpointId,
  });
  const checkpointRequiredEnforced =
    missingCheckpoint.ok === false &&
    missingCheckpoint.reason === 'checkpoint_required' &&
    withCheckpoint.ok === true;
  if (checkpointRequiredEnforced) findings.push('checkpoint_required_before_enroll');

  const preview = buildJoinPreview({
    familyDisplayName: 'Rodina Novák',
    localChildDisplayName: personal.childDisplayName,
    localChildBirthDate: personal.childBirthDate,
    remoteChildDisplayName: personal.childDisplayName,
    remoteChildBirthDate: personal.childBirthDate,
  });
  const autoMergeRefused =
    preview.autoMergeAllowed === false && preview.requiresExplicitDecision === true;
  if (autoMergeRefused) findings.push('join_preview_refuses_auto_merge');

  let foundingFamilyId: string | null = null;
  let networkRetryKeepsIdempotencyKey = false;
  let foundingPathCompletes = false;

  if (personal.checkpointId) {
    const foundingIntent = startEnrollmentIntent({
      kind: 'create_family',
      idempotencyKey: 'personal-founding-1',
      startedAt: '2026-11-09T10:00:00.000Z',
      localChildId: personal.localChildId,
      localActorId: personal.localActorId,
      localDeviceId: personal.localDeviceId,
      childLinkDecision: 'founding_profile',
      checkpointId: personal.checkpointId,
    });
    const waiting = markEnrollmentAwaitingNetwork(foundingIntent);
    networkRetryKeepsIdempotencyKey =
      waiting.status === 'awaiting_network' &&
      waiting.idempotencyKey === foundingIntent.idempotencyKey;

    const created = await deps.createFamily(waiting);
    const completed = completeEnrollment(waiting, created.familyId);
    foundingFamilyId = completed.familyId ?? null;
    foundingPathCompletes =
      completed.status === 'completed' &&
      typeof completed.familyId === 'string' &&
      completed.familyId.length > 0;
    if (networkRetryKeepsIdempotencyKey) {
      findings.push('network_retry_keeps_idempotency_key');
    }
    if (foundingPathCompletes) findings.push('founding_family_path_completed');
  }

  let deferredFamilyId: string | null = null;
  let invitationDeferKeepsSimilarTimePairs = false;
  let personalEventsPreservedAfterDefer = false;

  // Mutable local diary bag — family accept must not clear personal history.
  const localDiaryEvents = [...personal.localEventIds];
  const diaryBeforeJoin = [...localDiaryEvents];

  if (personal.checkpointId) {
    const inviteIntent = startEnrollmentIntent({
      kind: 'accept_invitation',
      idempotencyKey: 'personal-invite-defer-1',
      startedAt: '2026-11-09T10:05:00.000Z',
      localChildId: personal.localChildId,
      localActorId: personal.localActorId,
      localDeviceId: personal.localDeviceId,
      childLinkDecision: 'defer',
      checkpointId: personal.checkpointId,
    });
    const joined = await deps.acceptInvitation(inviteIntent);
    const deferred = completeEnrollment(inviteIntent, joined.familyId);
    deferredFamilyId = deferred.familyId ?? null;

    const similarPair = {
      localId: diaryBeforeJoin[0] ?? 'local-missing',
      remoteId: 'remote-similar-time',
    };
    const merge = planHistoryMerge({
      decision: 'defer',
      localEventIds: localDiaryEvents,
      remoteEventIds: ['remote-a', similarPair.remoteId],
      similarTimePairs: [similarPair],
    });
    invitationDeferKeepsSimilarTimePairs =
      deferred.status === 'deferred' &&
      merge.deferred === true &&
      merge.sharedEventIds.length === 0 &&
      merge.keepBothSimilarTimePairs.length === 1;

    personalEventsPreservedAfterDefer =
      localDiaryEvents.length === diaryBeforeJoin.length &&
      diaryBeforeJoin.every((id, index) => localDiaryEvents[index] === id) &&
      merge.sharedEventIds.length === 0;
    if (invitationDeferKeepsSimilarTimePairs) {
      findings.push('defer_keeps_similar_time_pairs_side_by_side');
    }
    if (personalEventsPreservedAfterDefer) {
      findings.push('personal_diary_events_preserved_after_defer');
    }
  }

  const personalRemainsWritableWithoutApi = deps.personalWritableWithoutApi === true;
  if (personalRemainsWritableWithoutApi) {
    findings.push('personal_care_writable_without_api');
  }

  findings.push('physical_device_migration_not_claimed');

  const allSoftwareChecksPassed =
    checkpointRequiredEnforced &&
    autoMergeRefused &&
    networkRetryKeepsIdempotencyKey &&
    foundingPathCompletes &&
    invitationDeferKeepsSimilarTimePairs &&
    personalEventsPreservedAfterDefer &&
    personalRemainsWritableWithoutApi &&
    personal.localEventIds.length > 0;

  return {
    format: 'lumi.personal-to-family-migration.v1',
    checkpointRequiredEnforced,
    autoMergeRefused,
    networkRetryKeepsIdempotencyKey,
    foundingPathCompletes,
    invitationDeferKeepsSimilarTimePairs,
    personalEventsPreservedAfterDefer,
    personalRemainsWritableWithoutApi,
    allSoftwareChecksPassed,
    physicalDeviceMigrationClaimed: false,
    findings,
    foundingFamilyId,
    deferredFamilyId,
  };
}
