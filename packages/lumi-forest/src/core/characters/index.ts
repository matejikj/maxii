import type { LumiAnimal } from '../types';
import type { VectorNode } from '../vector/types';
import { CHARACTER_BLUEPRINTS } from './blueprint';
import { compileCharacter } from './compiler';

/** Compatibility façade: the canonical sitting/neutral artwork is identical to v0.2.1. */
export interface CharacterDefinition {
  readonly id: LumiAnimal;
  readonly name: string;
  readonly anatomy: VectorNode;
}
export const CHARACTER_CATALOG: Readonly<Record<LumiAnimal, CharacterDefinition>> = {
  rabbit: { id: 'rabbit', name: CHARACTER_BLUEPRINTS.rabbit.displayName, anatomy: compileCharacter(CHARACTER_BLUEPRINTS.rabbit) },
  bear: { id: 'bear', name: CHARACTER_BLUEPRINTS.bear.displayName, anatomy: compileCharacter(CHARACTER_BLUEPRINTS.bear) },
  fox: { id: 'fox', name: CHARACTER_BLUEPRINTS.fox.displayName, anatomy: compileCharacter(CHARACTER_BLUEPRINTS.fox) },
  otter: { id: 'otter', name: CHARACTER_BLUEPRINTS.otter.displayName, anatomy: compileCharacter(CHARACTER_BLUEPRINTS.otter) },
  hedgehog: { id: 'hedgehog', name: CHARACTER_BLUEPRINTS.hedgehog.displayName, anatomy: compileCharacter(CHARACTER_BLUEPRINTS.hedgehog) },
};
export { CHARACTER_BLUEPRINTS, isCharacterRole } from './blueprint';
export { CHARACTER_ANATOMY } from './anatomy';
export { compileCharacter } from './compiler';
export { ACCESSORY_SLOTS, compileAccessory } from './accessories';
export { PROPORTION_LIMITS, validateProportions } from './proportions';
export type {
  CharacterBlueprint, CharacterBlueprintV1, CharacterBlueprintV2, CharacterRig,
  CharacterPart, CharacterPartRole, CharacterPose, CharacterExpression,
  CharacterAccessory, CharacterProportions, CharacterComposition, CharacterVariant,
  CharacterCompileOptions, ProportionChannel,
} from './blueprint';
