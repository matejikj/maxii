# LUMI Forest v0.4.0 — Procedural Scene Engine

## What was shipped

- **Deterministic platform-agnostic generator:** `planProceduralScene(request)` returns `ScenePlan` with `SceneDocument`, calculated collision bounds, clipped safe zones and omitted-item counters. `composeProceduralScene(request)` returns just the `SceneDocument` for rendering.
- **Layered SVG:** full-bleed canvas, sky, three continuous Bézier hill strata, microdetails, plants, objects and characters. All output goes through the SAME `VectorNode` IR and `LumiVectorDocument` renderer as prior versions.
- **Motif recipes:** clouds, stars, sun/moon, sprigs, grass, flowers, mushrooms, bushes, stones. Objects are self-contained reusable vector shapes in a bottom-center local coordinate system.
- **Deterministic placement:** seeded shuffle and independent PRNG streams for terrain, characters, foreground, and sky. Fixed 35 attempts per item, 44 foreground-item maximum, conservative bounding rectangles, ~80dp spatial hash cells and a 4dp exclusion margin.
- **UI avoidance:** `SafeZone` bounding rectangles are specified in *logical dp relative to the exact rendered background View*, with optional padding. They are clipped to the viewport. All zones reserve grid space **even if they overlap one another**. All discrete decorations and characters are omitted if a non-colliding placement cannot be found. Continuous full-bleed terrain is intentionally allowed behind UI.
- **Adaptive composition:** width/height from the real `onLayout` callback; six offline fixtures cover portrait/landscape phones and tablets; wide displays receive additional sky motifs and a higher density budget. The renderer uses `mode="contain"` with the matching viewport to avoid inadvertent cropping.
- **React Native:** `LumiProceduralBackground` measures its own surface, memoizes scene generation by props and renders via `react-native-svg` while remaining touch-transparent / absent from the accessibility tree. `SceneLab` in the Expo showcase lets you switch scene, density and seed.

## Public API

```ts
import { planProceduralScene, composeProceduralScene } from '@lumi/forest-design/core';

const request = {
  scene: 'sleep' as const,
  viewport: { width: 390, height: 844 },
  seed: 'non-sensitive-local-seed',
  density: 'regular' as const,
  safeZones: [
    { id: 'header', x: 16, y: 16, width: 280, height: 85, padding: 10 },
    { id: 'graph', x: 16, y: 125, width: 320, height: 220, padding: 12 },
  ],
};
const plan = planProceduralScene(request);
const vectorIR = plan.document;
```

```tsx
import { LumiProceduralBackground } from '@lumi/forest-design';

<LumiProceduralBackground
  scene="sleep" seed="stable-seed" density="quiet"
  animal="fox" pose="sleeping" expression="sleepy"
  safeZones={reservedRegions}
/>
```

> **Production integration:** Safe zones must reflect the *actual* rectangles of UI overlays, including dynamic text sizes and device insets. Use `onLayout` measurements for variable content, convert them to background-view coordinates, memoize the resulting array and update it only when geometry changes. If an overlay moves, stale zones **cannot** protect the new position. Use generous measured padding for shadows, strokes and animation excursions. Avoid seeds derived from child data or identifiers.

## Collision policy and limitations

1. Foreground motifs and the character use conservative *axis-aligned bounding boxes*, not exact per-pixel geometry; the `OccupancyGrid` guards these boxes and clips to the viewport. The 4dp margin adds extra breathing room. Overlapping safe zones are allowed, but decoration-to-decoration and decoration-to-safe-zone intersection is forbidden.
2. Character bounds assume approved `CharacterBlueprint` variants and v0.3 proportion limits. Authoring an oversized new accessory or anatomy requires updating corresponding conservative character bounds before using it procedurally.
3. Backdrop canvas and hills are **not** prevented from extending under content; only independent illustration objects are. This is intentional, since the underlying colored hills are background, not obstructions to text.
4. Rather than sacrificing clarity, when constrained space is inadequate (e.g. a card covers the entire scene), the engine **omits** the character and/or decorations. `ScenePlan.omitted` allows telemetry in tests without logging child data.
5. There is no arbitrary HTML/SVG XML injection; motif definitions are TypeScript-authored vector nodes, and seed length is capped. Maximum safe zones: 32, viewports: 240..4096dp, and aspect ratios within 1:5..5:1.
6. The landscape math is seeded and aesthetic, not a physics engine or globally optimized blue-noise solver. Motion, scrolling and parallax are outside v0.4.

## Determinism, compatibility, performance

- Same request + same v0.4 procedural algorithm yields the same `SceneDocument` and layout, independent of React Native. **Different algorithm versions may intentionally change scenery**; avoid persisting layout coordinates as user data. Generated version prefix: `proc:v1`.
- All old v0.1–v0.3 `composeScene()` and `LumiBackground` outputs are unaffected; the procedural API is opt-in.
- Hard caps: 44 attempted foreground objects, at most 35 placement attempts per object, 32 exclusion zones and a small sky motif count. Targets: ≤250 total vector nodes, ≤52 planned items. Run `npm run bench:procedural` for the current Node-only algorithm profile, and check actual RN render, frame times and memory on physical devices before claiming production performance.
- 5 scenes × 6 viewports × 3 densities have unit coverage, including pairwise collision checks, invalid-input validation, deterministic equality, character omission, and overlapping safe zones. Thirty canonical off-device SVG/PNG snapshots are protected by separate visual regression tests.

## Validation

```bash
npm run test:all
npm run bench:procedural
npm run expo:start
```

Offline PNG goldens are **not** Android/iOS screenshot evidence. Existing Maestro device instrumentation still requires a network-installed Expo setup, device provisioning and actual review of the resulting screenshots.
