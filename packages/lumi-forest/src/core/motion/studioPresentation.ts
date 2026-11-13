import type { LumiAnimal } from '../types';
import type { CharacterExpression, CharacterPose } from '../characters/blueprint';
import type { CharacterPropId, CharacterSemanticState } from '../characters/collection';
import { resolveCollectionSpecies, resolveSemanticPresentation } from '../characters/collection';
import type { CharacterAppearanceStyle, StudioActionId } from '../characters/studioCollection';
import { isCharacterAppearanceStyle, resolveStudioAction } from '../characters/studioCollection';
import type { CharacterMotion } from './types';
import { STUDIO_MOTION } from './studioMotion';

export type StudioPresentationInput = {
  readonly species?: unknown;
  readonly studioAction?: string | null;
  readonly appearanceStyle?: unknown;
  /** Optional installed capability ids from the content pack / app binary. */
  readonly installedCapabilities?: readonly string[] | null | undefined;
  readonly animate: boolean;
};

export type StudioPresentation = {
  readonly species: LumiAnimal;
  readonly appearanceStyle: CharacterAppearanceStyle;
  readonly studioActionId: StudioActionId | null;
  readonly capability: `studio.${StudioActionId}` | null;
  readonly pose: CharacterPose;
  readonly expression: CharacterExpression;
  readonly motion: CharacterMotion;
  readonly props: readonly CharacterPropId[];
  readonly prop: CharacterPropId | null;
  readonly semantic: CharacterSemanticState | null;
  readonly settlesToCalm: boolean;
  readonly animate: boolean;
  /** True when the requested studio action could not run and a semantic fallback was used. */
  readonly usedFallback: boolean;
};

function styleOrForest(value: unknown): CharacterAppearanceStyle {
  return isCharacterAppearanceStyle(value) ? value : 'forest';
}

function capabilityInstalled(
  capability: string,
  installed: readonly string[] | null | undefined,
): boolean {
  if (installed == null || installed.length === 0) return true;
  return installed.includes(capability) || installed.includes('art.studio.v1');
}

/**
 * Workshop actions animate only in the Dílna (workshop) look for the owning
 * species. Les / Střídmý and other guides keep a static semantic meaning.
 */
export function resolveStudioPresentation(input: StudioPresentationInput): StudioPresentation {
  const species = resolveCollectionSpecies(input.species);
  const appearanceStyle = styleOrForest(input.appearanceStyle);
  const action = resolveStudioAction(input.studioAction);

  if (
    action != null &&
    appearanceStyle === 'workshop' &&
    action.species === species &&
    capabilityInstalled(action.capability, input.installedCapabilities)
  ) {
    const animate = input.animate;
    return {
      species,
      appearanceStyle,
      studioActionId: action.id,
      capability: action.capability,
      pose: action.pose,
      expression: action.expression,
      motion: animate ? STUDIO_MOTION : 'still',
      props: action.props,
      prop: action.props[0] ?? null,
      semantic: action.semanticHint,
      settlesToCalm: true,
      animate,
      usedFallback: false,
    };
  }

  const semanticHint = action?.semanticHint ?? 'calm';
  const semantic = resolveSemanticPresentation(semanticHint, false);
  return {
    species,
    appearanceStyle,
    studioActionId: null,
    capability: null,
    pose: semantic.pose,
    expression: semantic.expression,
    motion: 'still',
    props: [],
    prop: null,
    semantic: semanticHint,
    settlesToCalm: false,
    animate: false,
    usedFallback: action != null,
  };
}
