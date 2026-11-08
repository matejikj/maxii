import type { LumiAnimal } from '../types';
import type { CharacterExpression, CharacterPose } from '../characters/blueprint';
import type { CharacterPropId, CharacterSemanticState } from '../characters/collection';
import {
  CHARACTER_COLLECTION,
  CHARACTER_SEMANTIC_STATES,
  resolveCollectionSpecies,
  resolveSemanticPresentation,
} from '../characters/collection';
import type { CharacterMotion } from './types';
import type { RecognitionAction } from './recognition';
import { recognitionPresentation } from './recognition';

export type CompanionPresentationInput = {
  readonly species?: unknown;
  readonly semantic?: CharacterSemanticState | null;
  readonly signatureAction?: string | null;
  /** Legacy rabbit pilot cues — prefer signatureAction going forward. */
  readonly recognition?: RecognitionAction | null;
  readonly expression?: CharacterExpression;
  readonly motion?: CharacterMotion;
  readonly pose?: CharacterPose;
  readonly animate: boolean;
};

export type CompanionPresentation = {
  readonly species: LumiAnimal;
  readonly pose: CharacterPose;
  readonly expression: CharacterExpression;
  readonly motion: CharacterMotion;
  readonly prop: CharacterPropId | null;
  readonly semantic: CharacterSemanticState | null;
  readonly signatureActionId: string | null;
  /** True when a short one-shot gesture should settle back to calm. */
  readonly settlesToCalm: boolean;
  readonly animate: boolean;
};

const ONE_SHOT_MOTIONS: ReadonlySet<CharacterMotion> = new Set(['perk', 'tilt']);

/**
 * Resolve product-facing companion presentation without reading child health
 * data. Unknown species and action ids fail closed to a calm static rabbit.
 */
export function resolveCompanionPresentation(
  input: CompanionPresentationInput,
): CompanionPresentation {
  const species = resolveCollectionSpecies(input.species);
  const signatureActionId =
    typeof input.signatureAction === 'string' && input.signatureAction.length > 0
      ? input.signatureAction
      : input.recognition ?? null;

  if (signatureActionId != null) {
    const entry = CHARACTER_COLLECTION[species];
    const action =
      entry.signatureActions.find((item) => item.id === signatureActionId) ??
      (species === 'rabbit' &&
      (signatureActionId === 'earPerk' || signatureActionId === 'headTilt')
        ? {
            id: signatureActionId,
            prop: null as CharacterPropId | null,
            semantic:
              signatureActionId === 'earPerk'
                ? ('curiosity' as const)
                : ('listening' as const),
          }
        : null);

    if (action) {
      const semantic = resolveSemanticPresentation(action.semantic, input.animate);
      // Rabbit recognition keeps its established static standing tilt fallback.
      if (
        !input.animate &&
        (signatureActionId === 'headTilt' || signatureActionId === 'earPerk')
      ) {
        const legacy = recognitionPresentation(signatureActionId);
        return {
          species,
          pose: legacy.staticFallback.pose,
          expression: legacy.staticFallback.expression,
          motion: 'still',
          prop: action.prop,
          semantic: action.semantic,
          signatureActionId: action.id,
          settlesToCalm: true,
          animate: false,
        };
      }
      return {
        species,
        pose: semantic.pose,
        expression: semantic.expression,
        motion: semantic.motion,
        prop: action.prop,
        semantic: action.semantic,
        signatureActionId: action.id,
        settlesToCalm: ONE_SHOT_MOTIONS.has(semantic.motion),
        animate: input.animate && semantic.motion !== 'still',
      };
    }
  }

  if (input.semantic != null && (CHARACTER_SEMANTIC_STATES as readonly string[]).includes(input.semantic)) {
    const semantic = resolveSemanticPresentation(input.semantic, input.animate);
    return {
      species,
      pose: semantic.pose,
      expression: semantic.expression,
      motion: semantic.motion,
      prop: null,
      semantic: input.semantic,
      signatureActionId: null,
      settlesToCalm: ONE_SHOT_MOTIONS.has(semantic.motion) || input.semantic === 'greeting',
      animate: input.animate && semantic.motion !== 'still',
    };
  }

  const pose = input.pose ?? 'sitting';
  const expression = input.expression ?? 'happy';
  const motion = input.animate ? (input.motion ?? 'idle') : 'still';
  return {
    species,
    pose,
    expression,
    motion,
    prop: null,
    semantic: null,
    signatureActionId: null,
    settlesToCalm: false,
    animate: input.animate && motion !== 'still',
  };
}

export function listSignatureActionIds(species: LumiAnimal): readonly string[] {
  return CHARACTER_COLLECTION[resolveCollectionSpecies(species)].signatureActions.map(
    (action) => action.id,
  );
}
