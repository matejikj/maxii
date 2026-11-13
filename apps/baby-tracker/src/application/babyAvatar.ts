import { asChildId, META_CHILD_AVATAR_PREFIX, type UnitOfWorkFactory } from '../domain';

export const BABY_AVATAR_VARIANTS = ['neutral', 'girl', 'boy'] as const;
export type BabyAvatarVariant = typeof BABY_AVATAR_VARIANTS[number];
export const babyAvatarKey = (childId: string) => `${META_CHILD_AVATAR_PREFIX}${childId}`;
/** A visual preference per child, kept in the diary's backed-up metadata. */
export async function loadBabyAvatar(unitOfWork: UnitOfWorkFactory, childId: string): Promise<BabyAvatarVariant> {
  return unitOfWork.run(async (uow) => {
    const value = await uow.meta.get(babyAvatarKey(childId));
    return value === 'girl' || value === 'boy' ? value : 'neutral';
  });
}
export async function saveBabyAvatar(unitOfWork: UnitOfWorkFactory, childId: string, variant: BabyAvatarVariant): Promise<void> {
  if (!(BABY_AVATAR_VARIANTS as readonly string[]).includes(variant)) throw new Error('Neznámý vzhled miminka.');
  await unitOfWork.run(async (uow) => {
    const profile = await uow.profiles.get(asChildId(childId));
    if (!profile) throw new Error('Profil dítěte už není dostupný.');
    await uow.meta.set(babyAvatarKey(childId), variant);
  });
}
