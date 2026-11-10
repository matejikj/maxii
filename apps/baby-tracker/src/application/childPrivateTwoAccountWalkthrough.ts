import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  assertProductionChildPrivateGatesClosed,
  attemptChildShellActivation,
  createChildPrivateProject,
  evaluateChildPrivateLiveGateEvidence,
  evaluateProjectAccess,
  planShareSnapshot,
  presentChildRecoveryPreview,
  presentShareToRecipient,
  publishShareSnapshot,
  revokeShareSnapshot,
  type ChildPrivateLiveGateEvidence,
} from '../domain';

export type ChildPrivateTwoAccountWalkthroughCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type ChildPrivateTwoAccountWalkthroughResult = {
  readonly ok: boolean;
  /** Shipped product gates stay closed even when drill evidence is complete. */
  readonly productionGatesRemainClosed: true;
  readonly liveReleaseReady: false;
  readonly evidenceComplete: boolean;
  readonly externalBlockers: readonly string[];
  readonly cases: readonly ChildPrivateTwoAccountWalkthroughCase[];
};

/**
 * Controlled two-principal walkthrough for the child-private matrix.
 * Pass complete evidence only inside drills/tests — never invent live proofs.
 * Production CHILD_PRIVATE_MODE_GATES remain closed regardless of this result.
 */
export function runChildPrivateTwoAccountWalkthrough(input: {
  readonly evidence: ChildPrivateLiveGateEvidence;
  readonly nowMs?: number;
}): ChildPrivateTwoAccountWalkthroughResult {
  const cases: ChildPrivateTwoAccountWalkthroughCase[] = [];
  const now = { epochMs: input.nowMs ?? Date.parse('2026-11-11T02:00:00.000Z') };
  const childOwner = asActorId('child_owner_walk');
  const namedParent = asActorId('parent_named_walk');
  const familyAdmin = asActorId('family_admin_walk');
  const sibling = asActorId('sibling_walk');

  assertProductionChildPrivateGatesClosed();
  cases.push({
    name: 'production_gates_closed',
    ok: true,
    detail: 'CHILD_PRIVATE_MODE_GATES remain all false',
  });

  const evaluation = evaluateChildPrivateLiveGateEvidence(input.evidence);
  cases.push({
    name: 'evidence_evaluation',
    ok: evaluation.productionGatesRemainClosed,
    detail: evaluation.evidenceComplete
      ? 'evidence complete for controlled drill; production still closed'
      : `evidence incomplete: ${evaluation.blockers.join(',')}`,
  });

  const activation = attemptChildShellActivation({
    gates: evaluation.gatesFromEvidence,
    appUserId: childOwner,
    displayAlias: 'Mája',
    linkedChildProfileId: asChildId('child_profile_walk'),
  });
  cases.push({
    name: 'child_shell_activation',
    ok: evaluation.evidenceComplete ? activation.ok === true : activation.ok === false,
    detail: activation.ok
      ? `shell open for ${activation.session.principal.displayAlias}`
      : `blocked: ${(activation.blockers ?? []).join(',')}`,
  });

  if (!evaluation.evidenceComplete || !activation.ok) {
    return {
      ok: cases.every((row) => row.ok),
      productionGatesRemainClosed: true,
      liveReleaseReady: false,
      evidenceComplete: false,
      externalBlockers: evaluation.externalBlockers,
      cases,
    };
  }

  const project = createChildPrivateProject({
    projectId: asEntityId('proj_walk'),
    revisionId: asRevisionId('rev_walk_1'),
    childId: asChildId('child_profile_walk'),
    ownerAppUserId: childOwner,
    template: null,
    title: 'Dvouúčtový most',
    intent: 'Soukromý záměr',
    now,
    createStepId: (index) => asEntityId(`step_walk_${index}`),
    childPrivateModeActive: true,
  });

  const ownerRead = evaluateProjectAccess('read', {
    principalKind: 'owner',
    principalAppUserId: childOwner,
    childPrivateModeActive: true,
    project,
  });
  cases.push({
    name: 'owner_reads_private_project',
    ok: ownerRead.allowed,
    detail: ownerRead.reason,
  });

  const adminReadPrivate = evaluateProjectAccess('read', {
    principalKind: 'other_adult_admin',
    principalAppUserId: familyAdmin,
    childPrivateModeActive: true,
    project,
  });
  cases.push({
    name: 'family_admin_denied_private_project',
    ok: !adminReadPrivate.allowed,
    detail: adminReadPrivate.reason,
  });

  const siblingRead = evaluateProjectAccess('read', {
    principalKind: 'other_child',
    principalAppUserId: sibling,
    childPrivateModeActive: true,
    project,
  });
  cases.push({
    name: 'sibling_denied_private_project',
    ok: !siblingRead.allowed,
    detail: siblingRead.reason,
  });

  const draft = planShareSnapshot({
    project,
    publishedTitle: 'Ukázka mostu',
    publishedBody: 'Jen tato věta.',
    audienceAppUserIds: [namedParent],
    childPrivateModeActive: true,
  });
  const share = publishShareSnapshot({
    shareId: asEntityId('share_walk'),
    draft,
    ownerAppUserId: childOwner,
    now,
  });

  const recipientShare = evaluateProjectAccess('read', {
    principalKind: 'named_recipient',
    principalAppUserId: namedParent,
    childPrivateModeActive: true,
    project,
    share,
  });
  cases.push({
    name: 'named_parent_reads_frozen_share',
    ok: recipientShare.allowed && recipientShare.reason === 'named_recipient_read_share',
    detail: recipientShare.reason,
  });

  const edited = {
    ...project,
    reflection: 'tajná reflexe',
    intent: 'nový záměr po publikaci',
  };
  const presented = presentShareToRecipient(share, edited);
  cases.push({
    name: 'share_presentation_frozen',
    ok:
      presented.body === 'Jen tato věta.' &&
      presented.liveProjectLeaked === false &&
      presented.title === 'Ukázka mostu',
    detail: 'recipient sees frozen body only',
  });

  const adminShare = evaluateProjectAccess('read', {
    principalKind: 'other_adult_admin',
    principalAppUserId: familyAdmin,
    childPrivateModeActive: true,
    project,
    share,
  });
  cases.push({
    name: 'admin_denied_unaddressed_share',
    ok: !adminShare.allowed,
    detail: adminShare.reason,
  });

  const revoked = revokeShareSnapshot(share, { epochMs: now.epochMs + 1 });
  const recipientAfterRevoke = evaluateProjectAccess('read', {
    principalKind: 'named_recipient',
    principalAppUserId: namedParent,
    childPrivateModeActive: true,
    project,
    share: revoked,
  });
  cases.push({
    name: 'revoke_blocks_recipient',
    ok: !recipientAfterRevoke.allowed,
    detail: recipientAfterRevoke.reason,
  });

  const recoveryOwner = presentChildRecoveryPreview({
    gates: evaluation.gatesFromEvidence,
  });
  const recoveryWithout = presentChildRecoveryPreview({
    gates: {
      ...evaluation.gatesFromEvidence,
      supportedRecovery: false,
    },
  });
  cases.push({
    name: 'recovery_owner_gate',
    ok: recoveryOwner.status === 'preview' && recoveryWithout.status === 'blocked',
    detail:
      recoveryOwner.status === 'preview'
        ? 'recovery preview opens only with supportedRecovery evidence'
        : recoveryOwner.detail,
  });

  assertProductionChildPrivateGatesClosed();
  cases.push({
    name: 'production_gates_still_closed_after_walkthrough',
    ok: true,
    detail: 'walkthrough did not mutate CHILD_PRIVATE_MODE_GATES',
  });

  return {
    ok: cases.every((row) => row.ok),
    productionGatesRemainClosed: true,
    liveReleaseReady: false,
    evidenceComplete: evaluation.evidenceComplete,
    externalBlockers: evaluation.externalBlockers,
    cases,
  };
}

/** Complete evidence object for controlled drills only — not a live attestation. */
export function drillCompleteChildPrivateLiveGateEvidence(): ChildPrivateLiveGateEvidence {
  return {
    verifiedChildIdentity: {
      oidcSubjectBound: true,
      parentOtpNotUsedAsChildAuth: true,
      independentAppUserId: true,
    },
    supportedRecovery: {
      childOwnedRecoveryFactorRegistered: true,
      parentMembershipNotAcceptedAsRecovery: true,
    },
    dedicatedDeviceOrAccount: {
      separateOsAccountOrDevice: true,
      notSharedParentPhonePrivateWorkspace: true,
    },
    legalOperationalFrameworkReady: {
      // Drill-only synthetic attestation — must never be copied into production.
      ownerAttestedFrameworkReady: true,
    },
  };
}
