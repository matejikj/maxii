/**
 * Renderer capabilities declared by the installed forest design. Packs may only
 * request IDs this list already understands — never remote executable code.
 * Keep in sync with the ten-species collection, workshop catalog, and props.
 */
/** Immutable capabilities used to serialize the already signed generation-1 packs.
 * Reader additions must never change their bytes or invalidate their signatures. */
export const BASE_PACK_ART_CAPABILITIES = [
  'art.collection.v1',
  'art.studio.v1',
  'art.appearance-styles.v1',
  'art.semantic-states.v1',
  'art.signature-actions.v1',
  'art.static-fallback.v1',
  'art.props.v1',
  'art.species.rabbit',
  'art.species.bear',
  'art.species.fox',
  'art.species.otter',
  'art.species.hedgehog',
  'art.species.owl',
  'art.species.squirrel',
  'art.species.fawn',
  'art.semantic.calm',
  'art.semantic.greeting',
  'art.semantic.listening',
  'art.semantic.curiosity',
  'art.semantic.pointContent',
  'art.semantic.rest',
  'art.semantic.gentleJoy',
  'art.semantic.static',
  'art.prop.book',
  'art.prop.blocks',
  'art.prop.leaf',
  'art.prop.scarfProp',
  'art.prop.routeMap',
  'art.prop.bridgePieces',
  'art.prop.notebook',
  'art.prop.pencil',
  'art.prop.patternTiles',
  'art.prop.displayStand',
  'studio.planPath',
  'studio.tryAlternatePath',
  'studio.bridgeSpan',
  'studio.testBridge',
  'studio.sketchPlan',
  'studio.compareNotes',
  'studio.arrangePattern',
  'studio.presentCreation',
] as const;

/** The installed renderer may be a strict superset of the signed base pack. */
export const INSTALLED_ART_CAPABILITIES = [
  ...BASE_PACK_ART_CAPABILITIES, 'art.species.tiger', 'art.species.hippo',
] as const;
export function listBasePackArtCapabilities(): readonly string[] {
  return BASE_PACK_ART_CAPABILITIES;
}

export function listInstalledArtCapabilities(): readonly string[] {
  return INSTALLED_ART_CAPABILITIES;
}

export function installedArtSupportsStudio(): boolean {
  return INSTALLED_ART_CAPABILITIES.includes('art.studio.v1');
}
