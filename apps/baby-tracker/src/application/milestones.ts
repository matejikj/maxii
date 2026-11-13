import type { ChildId, MilestoneCareEvent, UnitOfWorkFactory } from '../domain';

/** Query by kind, not the most recent N care rows: first words must remain
 * discoverable after years of feeding and sleep records. No readiness writes. */
export function listMilestoneMemories(unitOfWork: UnitOfWorkFactory, childId: ChildId): Promise<MilestoneCareEvent[]> {
  return unitOfWork.run(async (uow) => (await uow.care.listByType(childId, 'milestone'))
    .filter((event): event is MilestoneCareEvent => event.type === 'milestone'));
}
