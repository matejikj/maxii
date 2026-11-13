import {
  CHILD_PRIVATE_MODE_GATES,
  type ChildPrivateModeBlockerCode,
  type ChildPrivateModeGate,
} from './childMode';
import type { ChildShellActivationGates } from './childShell';
import { canActivateChildPrivateMode } from './privacy';

/**
 * Concrete evidence required before a child-private workspace may activate.
 * Each field must be measured or owner-attested — never inferred from age,
 * family payment, or a caregiver OTP.
 */
export type ChildPrivateLiveGateEvidence = {
  readonly verifiedChildIdentity: {
    /** Child has its own IdP subject bound to a stable appUserId. */
    readonly oidcSubjectBound: boolean;
    /** Parent OTP/reset was not accepted as the child's authentication. */
    readonly parentOtpNotUsedAsChildAuth: boolean;
    /** appUserId is distinct from every caregiver principal in the family. */
    readonly independentAppUserId: boolean;
  };
  readonly supportedRecovery: {
    /** Child-owned recovery factor is registered with the IdP. */
    readonly childOwnedRecoveryFactorRegistered: boolean;
    /** Family membership / payment is not treated as recovery proof. */
    readonly parentMembershipNotAcceptedAsRecovery: boolean;
  };
  readonly dedicatedDeviceOrAccount: {
    /** Separate supported OS account or device for the child principal. */
    readonly separateOsAccountOrDevice: boolean;
    /** Private workspace is not auto-downloaded onto a shared parent phone. */
    readonly notSharedParentPhonePrivateWorkspace: boolean;
  };
  readonly legalOperationalFrameworkReady: {
    /**
     * Owner-attested legal/operational readiness for a child release.
     * Software must never invent this as true.
     */
    readonly ownerAttestedFrameworkReady: boolean;
  };
};

export type ChildPrivateLiveGateEvaluation = {
  /** Gates derived only from the supplied evidence object. */
  readonly gatesFromEvidence: ChildShellActivationGates;
  /** True when evidence alone would allow activation in a controlled drill. */
  readonly evidenceComplete: boolean;
  readonly blockers: readonly ChildPrivateModeBlockerCode[];
  /**
   * Always mirrors the shipped production constants. Opening the live product
   * requires flipping those constants after real evidence — this helper never
   * does that silently.
   */
  readonly productionGates: typeof CHILD_PRIVATE_MODE_GATES;
  readonly productionGatesRemainClosed: boolean;
  /** Missing external inputs that still block a truthful live release. */
  readonly externalBlockers: readonly string[];
};

const EMPTY_EVIDENCE: ChildPrivateLiveGateEvidence = {
  verifiedChildIdentity: {
    oidcSubjectBound: false,
    parentOtpNotUsedAsChildAuth: false,
    independentAppUserId: false,
  },
  supportedRecovery: {
    childOwnedRecoveryFactorRegistered: false,
    parentMembershipNotAcceptedAsRecovery: false,
  },
  dedicatedDeviceOrAccount: {
    separateOsAccountOrDevice: false,
    notSharedParentPhonePrivateWorkspace: false,
  },
  legalOperationalFrameworkReady: {
    ownerAttestedFrameworkReady: false,
  },
};

/** Default empty evidence — personal builds start with nothing proven. */
export function emptyChildPrivateLiveGateEvidence(): ChildPrivateLiveGateEvidence {
  return EMPTY_EVIDENCE;
}

function gateFrom(evidence: ChildPrivateLiveGateEvidence): Record<ChildPrivateModeGate, boolean> {
  return {
    verifiedChildIdentity:
      evidence.verifiedChildIdentity.oidcSubjectBound &&
      evidence.verifiedChildIdentity.parentOtpNotUsedAsChildAuth &&
      evidence.verifiedChildIdentity.independentAppUserId,
    supportedRecovery:
      evidence.supportedRecovery.childOwnedRecoveryFactorRegistered &&
      evidence.supportedRecovery.parentMembershipNotAcceptedAsRecovery,
    dedicatedDeviceOrAccount:
      evidence.dedicatedDeviceOrAccount.separateOsAccountOrDevice &&
      evidence.dedicatedDeviceOrAccount.notSharedParentPhonePrivateWorkspace,
    legalOperationalFrameworkReady:
      evidence.legalOperationalFrameworkReady.ownerAttestedFrameworkReady,
  };
}

/**
 * Map measured/attested evidence onto activation gates without mutating the
 * shipped production constants. Live product activation stays closed until
 * those constants are deliberately updated after real proofs.
 */
export function evaluateChildPrivateLiveGateEvidence(
  evidence: ChildPrivateLiveGateEvidence = emptyChildPrivateLiveGateEvidence(),
): ChildPrivateLiveGateEvaluation {
  const gatesFromEvidence = gateFrom(evidence);
  const activation = canActivateChildPrivateMode(gatesFromEvidence);
  const productionClosed = Object.values(CHILD_PRIVATE_MODE_GATES).every(
    (value) => value === false,
  );
  const externalBlockers: string[] = [];
  if (!gatesFromEvidence.verifiedChildIdentity) {
    externalBlockers.push(
      'Chybí živý OIDC child účet (vlastní subject, bez rodičovského OTP fallbacku).',
    );
  }
  if (!gatesFromEvidence.supportedRecovery) {
    externalBlockers.push(
      'Chybí doložený child-owned recovery faktor v IdP (ne členství/platba rodiny).',
    );
  }
  if (!gatesFromEvidence.dedicatedDeviceOrAccount) {
    externalBlockers.push(
      'Chybí vlastní podporované zařízení/OS účet a zákaz auto-stahování private workspace na sdílený telefon.',
    );
  }
  if (!gatesFromEvidence.legalOperationalFrameworkReady) {
    externalBlockers.push('Chybí vlastnické potvrzení právního/provozního rámce dětského vydání.');
  }
  if (!productionClosed) {
    externalBlockers.push(
      'Produkční konstanty bran jsou neočekávaně otevřené — zkontrolovat CHILD_PRIVATE_MODE_GATES.',
    );
  }

  return {
    gatesFromEvidence,
    evidenceComplete: activation.active,
    blockers: activation.blockers as ChildPrivateModeBlockerCode[],
    productionGates: CHILD_PRIVATE_MODE_GATES,
    productionGatesRemainClosed: productionClosed,
    externalBlockers,
  };
}

/** Hard assertion for drills/tests: shipped product keeps every gate false. */
export function assertProductionChildPrivateGatesClosed(): void {
  for (const [key, value] of Object.entries(CHILD_PRIVATE_MODE_GATES)) {
    if (value !== false) {
      throw new Error(`production_gate_open:${key}`);
    }
  }
}
