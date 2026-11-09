/**
 * Structured incident responses for the single-VPS family beta.
 * Isolating the remote service must never wipe or lock the on-device diary.
 */

export type IncidentKind =
  | 'token_leak'
  | 'foreign_access'
  | 'database_failure'
  | 'malicious_update'
  | 'bad_content_pack'
  | 'vps_total_outage'
  | 'disk_full'
  | 'identity_loss';

export type IncidentPlaybook = {
  readonly kind: IncidentKind;
  readonly ownerRole: 'identityOwner' | 'composeOwner' | 'backupOwner' | 'observabilityOwner';
  readonly runbook: string;
  readonly steps: readonly string[];
  /** Explicit product invariant: phones keep local care without the API. */
  readonly localTrackerRemainsAvailable: true;
  readonly remoteKillSwitchForbidden: true;
};

export const INCIDENT_PLAYBOOKS: Readonly<Record<IncidentKind, IncidentPlaybook>> = {
  token_leak: {
    kind: 'token_leak',
    ownerRole: 'identityOwner',
    runbook: 'deploy/incident-runbooks.txt',
    steps: [
      'Revoke affected sessions and rotate the leaked client/server secret offline.',
      'Invalidate refresh material at the IdP; do not paste tokens into tickets.',
      'Confirm local diaries remain readable without re-login.',
    ],
    localTrackerRemainsAvailable: true,
    remoteKillSwitchForbidden: true,
  },
  foreign_access: {
    kind: 'foreign_access',
    ownerRole: 'identityOwner',
    runbook: 'deploy/incident-runbooks.txt',
    steps: [
      'Freeze the membership or revoke the invitation hash; keep audit IDs only.',
      'Force re-auth for the family admins from a trusted device.',
      'Preserve minimal evidence without exporting diary notes into chat.',
    ],
    localTrackerRemainsAvailable: true,
    remoteKillSwitchForbidden: true,
  },
  database_failure: {
    kind: 'database_failure',
    ownerRole: 'composeOwner',
    runbook: 'deploy/restore-runbook.txt',
    steps: [
      'Mark /ready failing; stop writers that would corrupt a partial volume.',
      'Restore from the latest verified off-server dump after applying the erasure registry.',
      'Clients keep offline capture; sync resumes only after readiness returns.',
    ],
    localTrackerRemainsAvailable: true,
    remoteKillSwitchForbidden: true,
  },
  malicious_update: {
    kind: 'malicious_update',
    ownerRole: 'composeOwner',
    runbook: 'deploy/incident-runbooks.txt',
    steps: [
      'Pin traffic to the last known-good image digest; block the bad tag.',
      'Verify schema compatibility before any binary rollback.',
      'Phones continue with embedded content; do not force a remote wipe.',
    ],
    localTrackerRemainsAvailable: true,
    remoteKillSwitchForbidden: true,
  },
  bad_content_pack: {
    kind: 'bad_content_pack',
    ownerRole: 'composeOwner',
    runbook: 'deploy/incident-runbooks.txt',
    steps: [
      'Refuse activation of the unsigned or lower-generation pack.',
      'Keep the previously verified local catalog active.',
      'Publish a higher signed generation only after review — never a silent swap.',
    ],
    localTrackerRemainsAvailable: true,
    remoteKillSwitchForbidden: true,
  },
  vps_total_outage: {
    kind: 'vps_total_outage',
    ownerRole: 'observabilityOwner',
    runbook: 'deploy/family-ops-runbook.txt',
    steps: [
      'Confirm the off-host probe fired; do not rely on monitoring that lived only on the dead VPS.',
      'Provision a replacement host; unlock LUKS from the independent recovery vault.',
      'Restore dumps + erasure registry per restore-runbook.txt; measure RPO/RTO.',
    ],
    localTrackerRemainsAvailable: true,
    remoteKillSwitchForbidden: true,
  },
  disk_full: {
    kind: 'disk_full',
    ownerRole: 'composeOwner',
    runbook: 'deploy/family-ops-runbook.txt',
    steps: [
      'Stop non-essential writers; rotate or prune logs without deleting the live DB volume.',
      'Verify off-server backup age before expanding the disk.',
      'Keep /ready false until free space and backup health recover.',
    ],
    localTrackerRemainsAvailable: true,
    remoteKillSwitchForbidden: true,
  },
  identity_loss: {
    kind: 'identity_loss',
    ownerRole: 'identityOwner',
    runbook: 'deploy/incident-runbooks.txt',
    steps: [
      'Restore the identity database from the coordinated off-server export.',
      'Re-bind recovery using the supported OIDC export — never family archive passwords.',
      'Local history stays; membership re-auth is required before remote writes.',
    ],
    localTrackerRemainsAvailable: true,
    remoteKillSwitchForbidden: true,
  },
};

export type SimulatedIncidentResult = {
  readonly kind: IncidentKind;
  readonly playbook: IncidentPlaybook;
  readonly remoteServiceIsolated: boolean;
  readonly localTrackerAvailable: true;
  readonly wipeOrLockHistoryAttempted: false;
};

/** Dry-run used in tests and tabletop drills — does not touch production. */
export function simulateIncidentResponse(kind: IncidentKind): SimulatedIncidentResult {
  const playbook = INCIDENT_PLAYBOOKS[kind];
  return {
    kind,
    playbook,
    remoteServiceIsolated: true,
    localTrackerAvailable: true,
    wipeOrLockHistoryAttempted: false,
  };
}
