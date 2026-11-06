# Character Blueprint public contract — v0.3

The current public input is a tagged union, **`CharacterBlueprintV1 | CharacterBlueprintV2`**. Both compile to the same existing `VectorNode` type. The `SceneDocument` structure and `react-native-svg` renderer remain unchanged.

## V1 compatibility

Blueprints with `schemaVersion: 1` retain v0.2.1 behavior: `base` may be a `legacy` node or authored `parts`; non-default pose/expression combinations require explicit complete variants; accessories and proportions are not supported. Existing client-authored v1 blueprints continue to compile. No invisible fallback.

## V2 character model

V2 requires semantically named parts with stable `id`, `role`, `order`, and unmodified `VectorNode` geometry. `rig` defines facial landmarks, transform pivots, accessory anchors, and expression colors. Pose/expression/accessory/proportion options are additive, independent compilation passes. Default is sitting/neutral; default vector values are exactly the preserved originals.

```ts
import { CHARACTER_BLUEPRINTS, compileCharacter } from '@lumi/forest-design/core';

const original = compileCharacter(CHARACTER_BLUEPRINTS.rabbit);
const changed = compileCharacter(CHARACTER_BLUEPRINTS.rabbit, {
  pose: 'standing', expression: 'happy', accessories: ['flower', 'scarf'],
  proportions: { head: 1.08 },
});
```

For full schemas and geometry rules see [CHARACTER_ENGINE.md](CHARACTER_ENGINE.md). For schema changes past v2, add a migrator and versioned fixtures rather than changing the meanings of existing part IDs. Client-created blueprints are readonly-by-contract. A future remote/user JSON importer needs explicit schema and SVG attribute security validation.
