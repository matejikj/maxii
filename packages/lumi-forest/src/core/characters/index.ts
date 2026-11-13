import type { LumiAnimal } from '../types';
import type { VectorNode } from '../vector/types';
import { CHARACTER_BLUEPRINTS } from './blueprint';
import { compileCharacter } from './compiler';
import { LUMI_ANIMALS } from '../types';

/** Compatibility façade for the current canonical sitting/neutral artwork. */
export interface CharacterDefinition {
  readonly id: LumiAnimal;
  readonly name: string;
  readonly anatomy: VectorNode;
}
export const CHARACTER_CATALOG: Readonly<Record<LumiAnimal, CharacterDefinition>> =
  Object.fromEntries(
    LUMI_ANIMALS.map((species) => [
      species,
      {
        id: species,
        name: CHARACTER_BLUEPRINTS[species].displayName,
        anatomy: compileCharacter(CHARACTER_BLUEPRINTS[species]),
      },
    ]),
  ) as Readonly<Record<LumiAnimal, CharacterDefinition>>;
export { CHARACTER_BLUEPRINTS, isCharacterRole } from './blueprint';
export { CHARACTER_ANATOMY, RABBIT_ANATOMY_BASELINE } from './anatomy';
export { compileCharacter, compileStudioActionStatic } from './compiler';
export { ACCESSORY_SLOTS, compileAccessory } from './accessories';
export { PROPORTION_LIMITS, validateProportions } from './proportions';
export {
  RABBIT_ARTWORK_REVISION,
  RABBIT_ART_DIRECTION_NOTES,
  SELECTED_RABBIT_ART_VARIANT,
  buildRabbitArtVariants,
} from './rabbitArtDirection';
export {
  CHARACTER_COLLECTION,
  CHARACTER_COLLECTION_COMPAT,
  CHARACTER_COLLECTION_VERSION,
  CHARACTER_PROP_IDS,
  FOREST_PROP_IDS,
  CHARACTER_SEMANTIC_STATES,
  DEFAULT_GUIDE_SPECIES,
  SEMANTIC_PRESENTATIONS,
  listCollectionEntries,
  resolveCollectionSpecies,
  resolveSemanticPresentation,
  summarizeCollectionComplexity,
} from './collection';
export { compileCharacterProp } from './props';
export { applyAppearanceStylePolish, restrainedPortraitScale } from './appearanceStyles';
export {
  CHARACTER_APPEARANCE_STYLES,
  STUDIO_ACTION_IDS,
  STUDIO_ACTIONS,
  STUDIO_COLLECTION_COMPAT,
  STUDIO_COLLECTION_VERSION,
  STUDIO_PROP_IDS,
  isCharacterAppearanceStyle,
  isStudioActionId,
  listStudioActionsForSpecies,
  primaryStudioProp,
  resolveStudioAction,
  summarizeStudioComplexity,
} from './studioCollection';
export {
  planNextCollectionExpansion,
  publishCurrentCharacterCollections,
  resolvePublishedAppearanceStyle,
  studioActionsPublishedForSpecies,
} from './collectionPublication';
export type { CharacterCollectionPublication } from './collectionPublication';
export {
  countCharacterVectorNodes,
  measureForestSittingNodes,
  measureStudioSceneComplexity,
} from './complexity';
export type { StudioComplexityReport } from './complexity';
export {
  COLLECTION_BACKGROUND_FIXTURES,
  COLLECTION_EXTREME_PROPORTIONS,
  COLLECTION_POSE_EXPRESSION_FIXTURES,
  COLLECTION_SAFE_UI_INSET,
  COLLECTION_SCALE_FIXTURES,
} from './collectionFixtures';
export type {
  CharacterBlueprint,
  CharacterBlueprintV1,
  CharacterBlueprintV2,
  CharacterRig,
  CharacterPart,
  CharacterPartRole,
  CharacterPose,
  CharacterExpression,
  CharacterAccessory,
  CharacterProportions,
  CharacterComposition,
  CharacterVariant,
  CharacterCompileOptions,
  ProportionChannel,
  CharacterForestPose,
  CharacterStudioPose,
} from './blueprint';
export type { RabbitArtVariant, RabbitArtVariantId } from './rabbitArtDirection';
export type {
  CharacterCollectionEntry,
  CharacterPropId,
  ForestPropId,
  CharacterSemanticState,
  CharacterSignatureAction,
  SemanticPresentation,
} from './collection';
export type {
  CharacterAppearanceStyle,
  StudioActionDefinition,
  StudioActionId,
  StudioPropId,
} from './studioCollection';
