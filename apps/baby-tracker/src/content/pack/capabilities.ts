/**
 * Renderer capabilities declared by the installed forest design. Packs may only
 * request IDs this list already understands — never remote executable code.
 * Keep in sync with the eight-species collection, workshop catalog, and props.
 */
export const INSTALLED_ART_CAPABILITIES = [
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

export function listInstalledArtCapabilities(): readonly string[] {
  return INSTALLED_ART_CAPABILITIES;
}

export function installedArtSupportsStudio(): boolean {
  return INSTALLED_ART_CAPABILITIES.includes('art.studio.v1');
}
