import {
  applyChildPrivateWorkspaceWipe,
  childPrivateWipeConfirmationMatches,
  planChildPrivateWorkspaceWipe,
  type ActorId,
  type ChildPrivateWipeFailureReason,
  type ChildPrivateWipePlan,
  type UnitOfWorkFactory,
} from '../domain';

export type ChildPrivateWipeResult = {
  readonly ok: true;
  readonly wipedAtMs: number;
  readonly projectCount: number;
  readonly portfolioCount: number;
  readonly shareCount: number;
  readonly familyGuidedPreserved: true;
  readonly familyCarePreserved: true;
  readonly familyHistoryAutoTransfer: false;
  readonly liveAccountCancellation: false;
  readonly externalExportNote: string;
  readonly summaryLines: readonly string[];
};

export type ChildPrivateWipeFailure = {
  readonly ok: false;
  readonly reason: ChildPrivateWipeFailureReason;
};

/**
 * Erases only this owner's childPrivate projects, portfolio rows and derived
 * shares on the local device. Confirmation must match exactly; family care and
 * other principals' private rows stay untouched. This is not a live account
 * cancellation.
 */
export async function wipeChildPrivateWorkspace(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly confirmationPhrase: string;
  readonly wipedAtMs: number;
}): Promise<ChildPrivateWipeResult | ChildPrivateWipeFailure> {
  if (!input.childPrivateModeActive) {
    return { ok: false, reason: 'child_mode_inactive' };
  }
  if (!childPrivateWipeConfirmationMatches(input.confirmationPhrase)) {
    return { ok: false, reason: 'confirmation_mismatch' };
  }

  return input.unitOfWork.run(async (uow) => {
    const projects = await uow.projects.listAll();
    const portfolio = await uow.portfolio.listAll();
    const shares = await uow.shares.listAll();

    const plan = planChildPrivateWorkspaceWipe({
      ownerAppUserId: input.ownerAppUserId,
      principalAppUserId: input.ownerAppUserId,
      principalKind: 'owner',
      childPrivateModeActive: true,
      projects,
      portfolio,
      shares,
    });
    if (!plan.ok) {
      return { ok: false, reason: plan.reason };
    }

    const staging = applyChildPrivateWorkspaceWipe({
      plan,
      projects,
      portfolio,
      shares,
      wipedAtMs: input.wipedAtMs,
    });

    // Clear-then-restore keeps sibling and familyGuided rows when repositories
    // only expose clearAll + save (no owner-scoped bulk delete).
    await uow.projects.clearAll();
    for (const project of staging.projects) {
      await uow.projects.save(project);
    }
    await uow.portfolio.clearAll();
    for (const item of staging.portfolio) {
      await uow.portfolio.save(item);
    }
    await uow.shares.clearAll();
    for (const share of staging.shares) {
      await uow.shares.save(share);
    }

    return {
      ok: true,
      wipedAtMs: input.wipedAtMs,
      projectCount: plan.projectCount,
      portfolioCount: plan.portfolioCount,
      shareCount: plan.shareCount,
      familyGuidedPreserved: true,
      familyCarePreserved: true,
      familyHistoryAutoTransfer: false,
      liveAccountCancellation: false,
      externalExportNote:
        'Heslem chráněné přenosné soubory uložené mimo aplikaci smažte ručně v jejich umístění.',
      summaryLines: plan.summaryLines,
    };
  });
}

export type { ChildPrivateWipePlan };
