/** Typed view of deploy/operations-owners.json for readiness gates. */

export type OperationsOwnersDocument = {
  readonly schemaVersion: number;
  readonly e2eeClaim: boolean;
  readonly hostingProfile: string;
  readonly roles: {
    readonly composeOwner: string;
    readonly identityOwner: string;
    readonly backupOwner: string;
    readonly observabilityOwner: string;
    readonly familyReleaseGate: string;
  };
  readonly onCall: {
    readonly primaryName: string;
    readonly primaryContact: string;
    readonly availability: string;
    readonly deputyName: string | null;
    readonly independentRecoveryHolder: string;
    readonly alertChannelOutsideVps: string;
  };
  readonly workingTargets: {
    readonly rpoHours: number;
    readonly rtoHours: number;
  };
  readonly liveDrillEvidence: {
    readonly vpsOutageAlarm: string | null;
    readonly luksUnlockAfterReboot: string | null;
    readonly fullDisk: string | null;
    readonly failedBackup: string | null;
    readonly identityLoss: string | null;
    readonly measuredRpoHours: number | null;
    readonly measuredRtoHours: number | null;
  };
  readonly backup: {
    readonly retentionDays: number;
    readonly rpoHoursWorkingTarget: number;
    readonly rtoHoursWorkingTarget: number;
    readonly livePgDataCopyForbidden: boolean;
    readonly erasureRegistryMustPrecedeServerConfirm: boolean;
  };
  /**
   * Paths/commits proving family release acceptance work. Null slots keep the
   * release gate closed — unit tests alone cannot fill them.
   */
  readonly familyReleaseEvidence: {
    readonly twoPhoneOfflineSync: string | null;
    readonly longDisconnectedReplica: string | null;
    readonly conflictMatrix: string | null;
    readonly independentSecurityReview: string | null;
    readonly remoteBackupNewDeviceRestore: string | null;
    readonly parentTransferLabels: string | null;
    readonly operatorLegalPack: string | null;
    readonly vpsHostMeasurements: string | null;
    readonly managedMigrationLocalDrill: string | null;
    readonly personalColdRegression: string | null;
  };
};

const UNASSIGNED = 'UNASSIGNED';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = UNASSIGNED): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readNullableString(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseOperationsOwners(raw: unknown): OperationsOwnersDocument {
  if (!isRecord(raw)) throw new Error('owners_not_object');
  if (raw.e2eeClaim !== false) throw new Error('e2ee_claim_forbidden');
  const roles = isRecord(raw.roles) ? raw.roles : {};
  const onCall = isRecord(raw.onCall) ? raw.onCall : {};
  const working = isRecord(raw.workingTargets) ? raw.workingTargets : {};
  const drills = isRecord(raw.liveDrillEvidence) ? raw.liveDrillEvidence : {};
  const backup = isRecord(raw.backup) ? raw.backup : {};
  const releaseEvidence = isRecord(raw.familyReleaseEvidence) ? raw.familyReleaseEvidence : {};

  return {
    schemaVersion: readNumber(raw.schemaVersion, 1),
    e2eeClaim: false,
    hostingProfile: readString(raw.hostingProfile, 'adr-0005-single-vps'),
    roles: {
      composeOwner: readString(roles.composeOwner),
      identityOwner: readString(roles.identityOwner),
      backupOwner: readString(roles.backupOwner),
      observabilityOwner: readString(roles.observabilityOwner),
      familyReleaseGate: readString(roles.familyReleaseGate),
    },
    onCall: {
      primaryName: readString(onCall.primaryName),
      primaryContact: readString(onCall.primaryContact),
      availability: readString(onCall.availability),
      deputyName: readNullableString(onCall.deputyName),
      independentRecoveryHolder: readString(onCall.independentRecoveryHolder),
      alertChannelOutsideVps: readString(onCall.alertChannelOutsideVps),
    },
    workingTargets: {
      rpoHours: readNumber(working.rpoHours, 24),
      rtoHours: readNumber(working.rtoHours, 8),
    },
    liveDrillEvidence: {
      vpsOutageAlarm: readNullableString(drills.vpsOutageAlarm),
      luksUnlockAfterReboot: readNullableString(drills.luksUnlockAfterReboot),
      fullDisk: readNullableString(drills.fullDisk),
      failedBackup: readNullableString(drills.failedBackup),
      identityLoss: readNullableString(drills.identityLoss),
      measuredRpoHours: readNullableNumber(drills.measuredRpoHours),
      measuredRtoHours: readNullableNumber(drills.measuredRtoHours),
    },
    backup: {
      retentionDays: readNumber(backup.retentionDays, 30),
      rpoHoursWorkingTarget: readNumber(backup.rpoHoursWorkingTarget, 24),
      rtoHoursWorkingTarget: readNumber(backup.rtoHoursWorkingTarget, 8),
      livePgDataCopyForbidden: backup.livePgDataCopyForbidden !== false,
      erasureRegistryMustPrecedeServerConfirm:
        backup.erasureRegistryMustPrecedeServerConfirm !== false,
    },
    familyReleaseEvidence: {
      twoPhoneOfflineSync: readNullableString(releaseEvidence.twoPhoneOfflineSync),
      longDisconnectedReplica: readNullableString(releaseEvidence.longDisconnectedReplica),
      conflictMatrix: readNullableString(releaseEvidence.conflictMatrix),
      independentSecurityReview: readNullableString(releaseEvidence.independentSecurityReview),
      remoteBackupNewDeviceRestore: readNullableString(
        releaseEvidence.remoteBackupNewDeviceRestore,
      ),
      parentTransferLabels: readNullableString(releaseEvidence.parentTransferLabels),
      operatorLegalPack: readNullableString(releaseEvidence.operatorLegalPack),
      vpsHostMeasurements: readNullableString(releaseEvidence.vpsHostMeasurements),
      managedMigrationLocalDrill: readNullableString(releaseEvidence.managedMigrationLocalDrill),
      personalColdRegression: readNullableString(releaseEvidence.personalColdRegression),
    },
  };
}

export function isAssigned(value: string): boolean {
  return value.trim().length > 0 && value.trim() !== UNASSIGNED;
}
