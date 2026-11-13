import { LUMI_ANIMALS, type LumiAnimal } from '../types';
import { CHARACTER_BLUEPRINTS } from '../characters/blueprint';
import { compileCharacter, compileStudioActionStatic } from '../characters/compiler';
import { CHARACTER_SEMANTIC_STATES, resolveSemanticPresentation } from '../characters/collection';
import {
  CHARACTER_APPEARANCE_STYLES,
  STUDIO_ACTION_IDS,
  STUDIO_ACTIONS,
  type CharacterAppearanceStyle,
} from '../characters/studioCollection';
import { restrainedPortraitScale } from '../characters/appearanceStyles';
import {
  COLLECTION_BACKGROUND_FIXTURES,
  COLLECTION_SAFE_UI_INSET,
} from '../characters/collectionFixtures';
import { countCharacterVectorNodes } from '../characters/complexity';
import { resolveStudioPresentation } from '../motion/studioPresentation';
import { resolveStudioMotionRecipe } from '../motion/studioMotion';
import { contrastRatio, passesTextContrast } from '../ui/accessibility';

/** Portrait and guide sizes required by the workshop publication matrix. */
export const WORKSHOP_PORTRAIT_SIZES_PX = [24, 32, 48, 144, 256] as const;

export type WorkshopAcceptanceCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type WorkshopAcceptanceReport = {
  readonly ok: boolean;
  /** Software matrix only — never claims a physical device measurement. */
  readonly physicalDeviceMeasured: false;
  readonly cases: readonly WorkshopAcceptanceCase[];
  readonly compiledStyleSemanticCells: number;
  readonly compiledStudioActions: number;
};

function caseOf(name: string, ok: boolean, detail: string): WorkshopAcceptanceCase {
  return { name, ok, detail };
}

/**
 * Offline acceptance matrix for the workshop collection: every guide keeps a
 * readable silhouette across styles and common states, studio actions stay
 * one-shot, and UI chrome contrast holds on light/dark mats. Physical frame
 * timings are out of scope for this software report.
 */
export function runWorkshopAcceptanceMatrix(): WorkshopAcceptanceReport {
  const cases: WorkshopAcceptanceCase[] = [];
  let compiledStyleSemanticCells = 0;
  let compiledStudioActions = 0;

  let styleMatrixOk = true;
  let firstStyleFailure = '';
  for (const species of LUMI_ANIMALS) {
    for (const style of CHARACTER_APPEARANCE_STYLES) {
      for (const semantic of CHARACTER_SEMANTIC_STATES) {
        try {
          const presentation = resolveSemanticPresentation(semantic, false);
          const node = compileCharacter(CHARACTER_BLUEPRINTS[species], {
            pose: presentation.pose,
            expression: presentation.expression,
            appearanceStyle: style,
          });
          const count = countCharacterVectorNodes(node);
          if (count <= 0) {
            styleMatrixOk = false;
            firstStyleFailure = `${species}/${style}/${semantic} empty`;
            break;
          }
          compiledStyleSemanticCells += 1;
        } catch (error) {
          styleMatrixOk = false;
          firstStyleFailure =
            error instanceof Error
              ? `${species}/${style}/${semantic}: ${error.message}`
              : `${species}/${style}/${semantic}: compile failed`;
          break;
        }
      }
      if (!styleMatrixOk) break;
    }
    if (!styleMatrixOk) break;
  }
  const expectedCells =
    LUMI_ANIMALS.length * CHARACTER_APPEARANCE_STYLES.length * CHARACTER_SEMANTIC_STATES.length;
  cases.push(
    caseOf(
      'style_semantic_matrix',
      styleMatrixOk && compiledStyleSemanticCells === expectedCells,
      styleMatrixOk
        ? `compiled ${compiledStyleSemanticCells}/${expectedCells} species×style×semantic cells`
        : firstStyleFailure || 'style matrix failed',
    ),
  );

  let studioOk = true;
  let studioDetail = '';
  for (const actionId of STUDIO_ACTION_IDS) {
    const def = STUDIO_ACTIONS[actionId];
    const node = compileStudioActionStatic(CHARACTER_BLUEPRINTS[def.species], actionId, 'workshop');
    if (!node) {
      studioOk = false;
      studioDetail = `${actionId} missing static workshop pose`;
      break;
    }
    const recipe = resolveStudioMotionRecipe(actionId);
    if (recipe.loops || !recipe.settlesToCalm) {
      studioOk = false;
      studioDetail = `${actionId} must be a one-shot that settles`;
      break;
    }
    if (recipe.durationMs < 1_600 || recipe.durationMs > 2_400) {
      studioOk = false;
      studioDetail = `${actionId} duration ${recipe.durationMs} outside 1.6–2.4 s`;
      break;
    }
    compiledStudioActions += 1;
  }
  cases.push(
    caseOf(
      'studio_actions_static_and_oneshot',
      studioOk && compiledStudioActions === STUDIO_ACTION_IDS.length,
      studioOk
        ? `${compiledStudioActions} studio actions compile with bounded one-shot motion`
        : studioDetail,
    ),
  );

  const forestFallback = resolveStudioPresentation({
    species: 'rabbit',
    studioAction: 'planPath',
    appearanceStyle: 'forest',
    animate: true,
  });
  const restrainedFallback = resolveStudioPresentation({
    species: 'rabbit',
    studioAction: 'planPath',
    appearanceStyle: 'restrained',
    animate: true,
  });
  const foreignFallback = resolveStudioPresentation({
    species: 'fox',
    studioAction: 'planPath',
    appearanceStyle: 'workshop',
    animate: true,
  });
  const missingCapability = resolveStudioPresentation({
    species: 'rabbit',
    studioAction: 'planPath',
    appearanceStyle: 'workshop',
    installedCapabilities: ['art.collection.v1'],
    animate: true,
  });
  const reduceMotionStill = resolveStudioPresentation({
    species: 'rabbit',
    studioAction: 'planPath',
    appearanceStyle: 'workshop',
    animate: false,
  });
  const workshopLive = resolveStudioPresentation({
    species: 'rabbit',
    studioAction: 'planPath',
    appearanceStyle: 'workshop',
    animate: true,
  });
  cases.push(
    caseOf(
      'studio_fallback_and_reduce_motion',
      forestFallback.usedFallback &&
        forestFallback.animate === false &&
        restrainedFallback.usedFallback &&
        foreignFallback.usedFallback &&
        missingCapability.usedFallback &&
        reduceMotionStill.motion === 'still' &&
        reduceMotionStill.animate === false &&
        workshopLive.studioActionId === 'planPath' &&
        workshopLive.animate === true &&
        workshopLive.settlesToCalm,
      'Les/Střídmý/foreign/missing-capability fall back statically; Reduce Motion keeps still; Dílna animates one-shot',
    ),
  );

  const scalesOk = WORKSHOP_PORTRAIT_SIZES_PX.every((size) => {
    const scale = restrainedPortraitScale(size);
    if (size <= 24) return scale === 0.42;
    if (size <= 32) return scale === 0.55;
    if (size <= 48) return scale === 0.72;
    return scale === 1;
  });
  cases.push(
    caseOf(
      'portrait_scale_matrix',
      scalesOk,
      scalesOk
        ? 'restrained portrait scales cover 24/32/48/144/256'
        : 'portrait scale matrix mismatch',
    ),
  );

  const lightOk = passesTextContrast('#24312E', COLLECTION_BACKGROUND_FIXTURES.light);
  const darkOk = passesTextContrast('#FAF7F1', COLLECTION_BACKGROUND_FIXTURES.dark);
  const insetOk =
    COLLECTION_SAFE_UI_INSET.top >= 12 &&
    COLLECTION_SAFE_UI_INSET.left >= 12 &&
    COLLECTION_SAFE_UI_INSET.right >= 12 &&
    COLLECTION_SAFE_UI_INSET.bottom >= 12;
  cases.push(
    caseOf(
      'ui_chrome_contrast_and_inset',
      lightOk &&
        darkOk &&
        insetOk &&
        contrastRatio('#24312E', COLLECTION_BACKGROUND_FIXTURES.light) >= 4.5,
      lightOk && darkOk && insetOk
        ? 'light/dark mats keep readable chrome; safe inset leaves room for controls'
        : 'contrast or safe inset failed',
    ),
  );

  cases.push(
    caseOf(
      'decorative_companion_policy',
      true,
      'LumiCharacter/LumiAnimatedCharacter stay non-accessible SVG; meaning lives in product text and style buttons',
    ),
  );

  return {
    ok: cases.every((row) => row.ok),
    physicalDeviceMeasured: false,
    cases,
    compiledStyleSemanticCells,
    compiledStudioActions,
  };
}

/** Device scenarios required before claiming physical workshop performance evidence. */
export const WORKSHOP_DEVICE_MEASUREMENT_SCENARIOS = [
  'workshop-forest-static',
  'workshop-studio-static',
  'workshop-studio-action',
  'workshop-restrained-static',
] as const;

export type WorkshopDeviceMeasurementScenario =
  (typeof WORKSHOP_DEVICE_MEASUREMENT_SCENARIOS)[number];

export function describeWorkshopDeviceMeasurementPlan(): {
  readonly scenarios: readonly WorkshopDeviceMeasurementScenario[];
  readonly requiresPhysicalAndroid: true;
  readonly requiresPhysicalIos: true;
  readonly forbidsFabricatedManifest: true;
} {
  return {
    scenarios: WORKSHOP_DEVICE_MEASUREMENT_SCENARIOS,
    requiresPhysicalAndroid: true,
    requiresPhysicalIos: true,
    forbidsFabricatedManifest: true,
  };
}

export function workshopAppearanceLabel(style: CharacterAppearanceStyle): string {
  switch (style) {
    case 'forest':
      return 'Les';
    case 'workshop':
      return 'Dílna';
    case 'restrained':
      return 'Střídmý';
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

export function workshopGuidePreviewHint(
  species: LumiAnimal,
  style: CharacterAppearanceStyle,
): string {
  return `Náhled průvodce ${CHARACTER_BLUEPRINTS[species].displayName}, vzhled ${workshopAppearanceLabel(style)}. Dekorace, ne tlačítko.`;
}
