import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHILD_PRIVATE_MODE_GATES,
  assertProductionChildPrivateGatesClosed,
  emptyChildPrivateLiveGateEvidence,
  evaluateChildPrivateLiveGateEvidence,
  isChildPrivateModeActive,
} from '../../src/domain/index.ts';
import {
  drillCompleteChildPrivateLiveGateEvidence,
  runChildPrivateTwoAccountWalkthrough,
} from '../../src/application/childPrivateTwoAccountWalkthrough.ts';

test('production child-private gates stay closed and personal mode is inactive', () => {
  assertProductionChildPrivateGatesClosed();
  assert.equal(isChildPrivateModeActive(), false);
  assert.equal(CHILD_PRIVATE_MODE_GATES.verifiedChildIdentity, false);
  assert.equal(CHILD_PRIVATE_MODE_GATES.supportedRecovery, false);
  assert.equal(CHILD_PRIVATE_MODE_GATES.dedicatedDeviceOrAccount, false);
  assert.equal(CHILD_PRIVATE_MODE_GATES.legalOperationalFrameworkReady, false);

  const empty = evaluateChildPrivateLiveGateEvidence(emptyChildPrivateLiveGateEvidence());
  assert.equal(empty.evidenceComplete, false);
  assert.equal(empty.productionGatesRemainClosed, true);
  assert.ok(empty.externalBlockers.length >= 4);
});

test('incomplete evidence never invents an open legal framework gate', () => {
  const evaluated = evaluateChildPrivateLiveGateEvidence({
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
      ownerAttestedFrameworkReady: false,
    },
  });
  assert.equal(evaluated.gatesFromEvidence.legalOperationalFrameworkReady, false);
  assert.equal(evaluated.evidenceComplete, false);
  assert.equal(evaluated.productionGatesRemainClosed, true);
  assert.match(
    evaluated.externalBlockers.join(' '),
    /právního\/provozního rámce/i,
  );
});

test('two-account walkthrough with drill evidence proves matrix without opening production', () => {
  const result = runChildPrivateTwoAccountWalkthrough({
    evidence: drillCompleteChildPrivateLiveGateEvidence(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.evidenceComplete, true);
  assert.equal(result.productionGatesRemainClosed, true);
  assert.equal(result.liveReleaseReady, false);
  assert.equal(isChildPrivateModeActive(), false);
  assert.ok(result.cases.every((row) => row.ok));
  assert.ok(
    result.cases.some((row) => row.name === 'named_parent_reads_frozen_share'),
  );
  assert.ok(
    result.cases.some((row) => row.name === 'family_admin_denied_private_project'),
  );
});

test('two-account walkthrough with empty evidence refuses shell activation', () => {
  const result = runChildPrivateTwoAccountWalkthrough({
    evidence: emptyChildPrivateLiveGateEvidence(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.evidenceComplete, false);
  assert.equal(result.liveReleaseReady, false);
  assert.equal(result.productionGatesRemainClosed, true);
  const activation = result.cases.find((row) => row.name === 'child_shell_activation');
  assert.ok(activation?.ok);
  assert.match(activation?.detail ?? '', /blocked:/);
});
