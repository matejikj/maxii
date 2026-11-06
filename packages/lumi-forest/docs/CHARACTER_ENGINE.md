# LUMI Character Engine — v0.3

## Scope and acceptance

The goal is a **real parameter-driven compiler** from semantically authored animal parts, not a set of 40 manually duplicated pictures. Every species provides 4 expressions × 2 poses and may be decorated independently. The initial illustration is reconstructed from exactly the original shape nodes, in exactly their previous painter order, so the existing `createLumiSvg()` golden test hashes remain unchanged.

| Species | Named parts | Eyes | Limbs | Tail / ears | Base-preserved |
|---|---:|---|---|---|---|
| rabbit | 20 | left/right | paws/feet | long ears | yes |
| bear | 19 | left/right | paws/feet | round ears | yes |
| fox | 21 | left/right | paws/feet | two tail shapes + ears | yes |
| otter | 18 | left/right | paws/feet | tail + ears | yes |
| hedgehog | 15 | left/right | paws/feet | spines (not ears) | yes |

**Single source of geometry**: `src/core/characters/anatomy.ts` contains 93 `CharacterPart` records. The old artwork facade (`CHARACTER_ARTWORK`) and all 40 new variant exports are derived from the same records. The serializer or mobile renderer does not need to understand which nodes are ears or paws.

## Serialization contract

```ts
interface CharacterBlueprintV2 {
  schemaVersion: 2;
  species: LumiAnimal;
  displayName: string;
  base: { kind: 'parts'; parts: readonly CharacterPart[] };
  rig: CharacterRig; // face landmarks, part pivots, accessory anchors, palette
  supportedPoses: readonly ('sitting' | 'standing' | 'sleeping')[];
  supportedExpressions: readonly CharacterExpression[];
  supportedAccessories: readonly CharacterAccessory[];
}

interface CharacterCompileOptions {
  pose?: 'default' | 'sitting' | 'standing' | 'sleeping';
  expression?: 'neutral' | 'happy' | 'curious' | 'sleepy';
  accessories?: readonly ('bow' | 'flower' | 'scarf' | 'star')[];
  proportions?: { body?: number; head?: number; ears?: number; paws?: number };
}
```

`pose: 'default'` aliases sitting for v2, preserving older callers. Without additional options, a compiled blueprint is identical to the v0.2.1 artwork. `pose: 'sleeping'` implies `expression: 'sleepy'` unless explicitly overridden.

### Pipeline

1. Validate immutable blueprint: schema version, stable IDs, valid roles/paint order, complexity limit, required facial parts, finite rig anchor coordinates. Prepared part order is memoized by blueprint identity.
2. Validate options: supported pose/expression, accessory count and exclusivity of slots, proportion ranges and species anatomy (hedgehogs have no ears).
3. Select neutral facial anatomy or replace the two named eye parts and mouth by generic, parameterized expression nodes.
4. Apply independent pose and scale transforms to anatomical layers without editing the original path data.
5. Add vector accessories at semantic `head`, `neck`, `hand` anchors.
6. Emit a `VectorNode` group. Consumers choose native SVG or SVG serializer. No string parsing at render time.

All passes are deterministic, synchronous and platform-neutral. Common low-cardinality compiled variants are cached in a bounded Map (48 entries per blueprint, in a WeakMap keyed by blueprint identity). Original nodes are reused; no deep cloning or repeated regeneration of SVG path strings for unchanged parts. The pure compiler is not an animation clock.

### Expression grammar

`neutral` uses exact original eyes and mouth, including the originally smiling closed rabbit/fox eyes. `happy` draws closed smiling eye curves and a larger mouth. `curious` draws open eyes with tiny highlights and a small rounded mouth. `sleepy` uses relaxed shut eyes and a soft yawning mouth. All anchor coordinates and dark colors come from each character's rig.

### Pose recipes

- **Sitting**: original anatomy, same coordinates and painter order as v0.2.1.
- **Standing**: body stretches vertically, feet move down, paws move up and the entire face/head assembly lifts together. This is a deliberate stylized second pose, not a physics-accurate skeleton.
- **Sleeping**: optional third pose, soft whole-character recline; sleepy facial expression is default.

Future animation should move designated native SVG groups without invoking `compileCharacter()` every frame. Character expressions could later have authored overlays on a per-species basis without changing the IR.

### Proportion ranges

| Channel | Allowed interval | Effect |
|---|---|---|
| body | 0.82–1.16 | Local body, belly, mark, spines scale |
| head | 0.85–1.15 | Head and face landmarks/ears scale together |
| ears | 0.76–1.30 | Ears scale vertically about root pivots (not supported on hedgehog) |
| paws | 0.86–1.14 | Front paws and feet scale about paw pivot |

Out-of-range or non-finite values throw `RangeError`; no silent coercion or fallback. `1` is neutral.

### Accessories

| Accessory | Slot | Local semantics |
|---|---|---|
| bow | head | small pastel loops |
| flower | head | radial petals |
| scarf | neck | fixed curved wrap + tail |
| star | hand | five-point star |

At most 3 simultaneously, no duplicates in the same slot (bow + flower is invalid). Accessory geometry is authored with local coordinates and placed using the species rig. Position never depends on the device's screen dimensions.

## Limits and risks

- This is parametrically layered vector artwork, **not** inverse-kinematic posing, skeletal skinning or a full animation rig.
- Native SVG surface and frame performance are not benchmarked in this environment. Pixel tests use CairoSVG, not React Native.
- The `VectorNode` IR and v1 SceneDocument are intentionally unchanged, allowing a future Skia backend without re-authoring animals.
- Untrusted JSON may require a separate schema validator before import (validate all shape properties and whitelist SVG attributes). This library's built-in blueprints are locally authored and typed.
- Avoid attaching a new array/object literal as `accessories` or `proportions` every parent render in React. Use stable references.

## Tests and review

- `npm test`: finite geometry, required anatomical roles, no mutations, variant uniqueness and determinism, accessories/ranges, v1 backward compatibility, scene integration and original scene SHA-256 hashes.
- `npm run test:characters:visual`: 40 character PNG snapshots. To approve intentional design changes, run `npm run characters:visual:approve` and review every changed cell in `previews/lumi-v0.3-character-matrix.png`.
- `npm run test:visual`: 30 prior screen/viewport raster snapshots must remain unchanged.
- `.maestro/characters.yaml`: capture actual Expo Character Lab across the five species on physical devices after building.
