/**
 * Signed toddler 1–2 content pack envelope. Payload bytes are rebuilt from the
 * published catalog so ages 12–23 stay offline without remote URLs.
 */
import type { ContentPackManifest, ContentPackSignature } from './types';

export const EMBEDDED_TODDLER_1_2_MANIFEST = {
  "format": "lumi.content-pack.v1",
  "packId": "lumi.toddler-1-2.content",
  "kind": "content",
  "generation": 1,
  "readerVersion": "lumi.content-reader.v1",
  "catalogVersion": "toddler-1-2.v1",
  "collectionVersion": "lumi.characters.collection.v1",
  "rulesVersion": "lumi.recommendation.rules.v2",
  "language": "cs",
  "ageMonths": {
    "fromInclusive": 12,
    "toInclusive": 23
  },
  "activityRevisionIds": [
    "toddler-shared-hello-choice.r1",
    "toddler-two-pages-together.r1",
    "toddler-soft-ball-return.r1",
    "toddler-two-large-textures.r1",
    "toddler-follow-your-interest.r1",
    "toddler-cup-in-and-out.r1",
    "toddler-palm-pause-rhythm.r1",
    "toddler-choose-two-clothes.r1",
    "toddler-shared-ball-turn.r1",
    "toddler-words-for-two-things.r1",
    "toddler-own-way-to-toy.r1",
    "toddler-quiet-sound-source.r1",
    "toddler-toy-under-cloth-edge.r1",
    "toddler-empty-full-container.r1",
    "toddler-first-large-mark.r1",
    "toddler-toy-home-basket.r1",
    "toddler-plush-needs-pause.r1",
    "toddler-familiar-story-pause.r1",
    "toddler-slow-motion-statues.r1",
    "toddler-large-paper-surfaces.r1",
    "toddler-find-same-big-picture.r1",
    "toddler-big-small-cloth.r1",
    "toddler-your-sound-my-answer.r1",
    "toddler-choose-help-signal.r1"
  ],
  "capabilities": [
    "art.collection.v1",
    "art.studio.v1",
    "art.appearance-styles.v1",
    "art.semantic-states.v1",
    "art.signature-actions.v1",
    "art.static-fallback.v1",
    "art.props.v1",
    "art.species.rabbit",
    "art.species.bear",
    "art.species.fox",
    "art.species.otter",
    "art.species.hedgehog",
    "art.species.owl",
    "art.species.squirrel",
    "art.species.fawn",
    "art.semantic.calm",
    "art.semantic.greeting",
    "art.semantic.listening",
    "art.semantic.curiosity",
    "art.semantic.pointContent",
    "art.semantic.rest",
    "art.semantic.gentleJoy",
    "art.semantic.static",
    "art.prop.book",
    "art.prop.blocks",
    "art.prop.leaf",
    "art.prop.scarfProp",
    "art.prop.routeMap",
    "art.prop.bridgePieces",
    "art.prop.notebook",
    "art.prop.pencil",
    "art.prop.patternTiles",
    "art.prop.displayStand",
    "studio.planPath",
    "studio.tryAlternatePath",
    "studio.bridgeSpan",
    "studio.testBridge",
    "studio.sketchPlan",
    "studio.compareNotes",
    "studio.arrangePattern",
    "studio.presentCreation"
  ],
  "files": [
    {
      "logicalId": "catalog/toddler-1-2.json",
      "kind": "json",
      "mime": "application/json",
      "byteLength": 73523,
      "sha256": "8eccfb8dd64b0abf271f2160cb7f5054b590d05c6aafebcec3e128167706917b"
    }
  ],
  "totalBytes": 73523,
  "createdAt": "2026-11-09T01:00:00+01:00"
} as const satisfies ContentPackManifest;

export const EMBEDDED_TODDLER_1_2_SIGNATURE = {
  "format": "lumi.content-pack-signature.v1",
  "algorithm": "Ed25519",
  "keyId": "lumi-content-ed25519-v1",
  "signature": "jgQ_vdQMwRDq6sPTdi2NfhNezxx8e1-x7MxDYc6NuMpRls2OeegOcBllXTYTwe84RpQuC79MDLEJm9XIGt0PBg"
} as const satisfies ContentPackSignature;
