import type { CharacterBlueprint, CharacterBlueprintV1, CharacterBlueprintV2, CharacterPose, CharacterExpression } from '../characters/blueprint';
import { CHARACTER_BLUEPRINTS } from '../characters/blueprint';
import { compileCharacter } from '../characters/compiler';
import { serializeVectorNode } from '../vector/serialize';

export const LATEST_CHARACTER_BLUEPRINT_VERSION = 2 as const;
export const SUPPORTED_CHARACTER_BLUEPRINT_VERSIONS = [1, 2] as const;
export class BlueprintMigrationError extends Error {
  constructor(message: string) { super(message); this.name = 'BlueprintMigrationError'; }
}
/**
 * V1 has authored complete variants, whereas v2 has a parameterized rig.
 * A generic lossless conversion is IMPOSSIBLE. Only matched bundled artwork
 * can be upgraded; mismatching custom v1 authors must keep using v1 or supply
 * a manually authored v2 rig. Never silently swap custom art for stock art.
 */
export function migrateCharacterBlueprint(input: CharacterBlueprint): CharacterBlueprintV2 {
  if (!input || typeof input !== 'object') throw new BlueprintMigrationError('Invalid blueprint');
  if (input.schemaVersion === 2) {
    try { compileCharacter(input); }
    catch { throw new BlueprintMigrationError('Invalid v2 blueprint anatomy/rig'); }
    return input;
  }
  if (input.schemaVersion !== 1) throw new BlueprintMigrationError('Unsupported blueprint schemaVersion');
  const old = input as CharacterBlueprintV1;
  const modern = CHARACTER_BLUEPRINTS[old.species];
  if (!modern) throw new BlueprintMigrationError(`Unknown species: ${String(old.species)}`);
  const equivalent = (pose: CharacterPose, expression: CharacterExpression): boolean => {
    try {
      const legacy = compileCharacter(old, { pose: pose as 'default'|'sitting'|'standing'|'sleeping', expression: expression as 'neutral'|'happy'|'curious'|'sleepy' });
      const updated = compileCharacter(modern, { pose: pose === 'default' ? 'sitting' : pose as 'sitting'|'standing'|'sleeping', expression: expression as 'neutral'|'happy'|'curious'|'sleepy' });
      return serializeVectorNode(legacy) === serializeVectorNode(updated);
    } catch { return false; }
  };
  if (!equivalent('default', 'neutral')) {
    throw new BlueprintMigrationError('V1 artwork differs from built-in v2; supply an authored v2 blueprint instead');
  }
  for (const variant of old.variants ?? []) {
    if (!equivalent(variant.pose, variant.expression)) {
      throw new BlueprintMigrationError(`Cannot losslessly migrate authored variant ${variant.pose}/${variant.expression}`);
    }
  }
  return modern;
}

/** Keep native support for old blueprints without losing authored details. */
export function resolveCharacterBlueprint(input: CharacterBlueprint): CharacterBlueprint {
  if (input.schemaVersion !== 1 && input.schemaVersion !== 2) {
    throw new BlueprintMigrationError('Unknown blueprint schemaVersion');
  }
  compileCharacter(input); // validate before passing across a trust boundary
  return input;
}
