# LUMI Forest v0.3 — architecture

```text
                                     SceneOptions
                                          |
                        SceneCatalog / Theme Tokens
                              /                      \
   CharacterBlueprintV2 + CharacterRig            Decoration Engine
                   |                                    |
         Named Anatomy (93 parts)                       |
                   |                                    |
       compileCharacter()  ____________________  composeScene()
                   \                                  /
                       SceneDocument v1 / VectorNode
                                     /       \
                       React Native SVG       Offline SVG serializer
                       /             \              |
               LumiBackground     LumiCharacter     5+40 exports and PNG tests
                                     |
                        Expo Character Lab
```

## Design constraints

1. `src/core` is pure TypeScript and cannot import React, RN, Expo, native modules, or call the network; this is enforced by architecture tests.
2. `VectorNode` and `SceneDocument v1` are renderer-neutral, serializable and unchanged by the v0.3 Character Engine.
3. `src/core/characters/anatomy.ts` holds the **only authoring copies** of each of the 93 original vector parts. `CHARACTER_ARTWORK` and the v0.2 compatibility catalog are derived views of that source, not separately maintained drawings.
4. `CharacterBlueprintV2` couples named anatomy with explicit rig metadata: face landmarks, pivots, accessory anchor slots and expression colors. Compiler passes are pure and deterministic. An unsupported blueprint schema or anatomically impossible proportion fails closed.
5. Character expressions and poses do not alter path definitions. Transforms are composed into SVG groups; unchanged geometry references are reused.
6. Default poses compile to exactly the original v0.2 SVG scene output; existing 5 golden hashes and 30 responsive viewport baselines must remain green.
7. Mobile adapter renders directly to native SVG primitives. No runtime XML parsing or image downloads.
8. Character Lab compiles at most eight visible combinations per species; the main screen does not mount 40 SVG surfaces simultaneously.
9. Animated changes must run in a dedicated UI/renderer layer; do not call the character compiler at 60/120 FPS.
10. The visual engine never reads or persists data about children, growth or health. User content/state remains in an independent product domain.

## Compatibility boundaries

- **Blueprint v1:** fully supported via tagged union. It retains manually authored complete variants and has no accessories/proportions.
- **Blueprint v2:** semantic composition and generic parametric passes; `schemaVersion: 2` is required for new features.
- **SceneDocument v1:** unchanged. `LumiBackground` receives optional `pose`, `expression`, `accessories`, `proportions` but defaults are compatible.
- **Renderer:** `VectorNodeView` unchanged, so future scene engine or Skia renderer will not need special Character Engine logic.

## Caching and complexity

Immutable blueprint identity is the cache key. Prepared sorted/validated parts are stored once in a WeakMap; the neutral default has a stable reference, and frequently used presets are bounded at 48 per blueprint. Custom proportions bypass the variant cache to avoid unbounded cardinality. Each blueprint has a maximum of 96 authored parts, 256 nested vector nodes and 14 levels of nesting, validated at preparation time. These caps are intentionally conservative initial budgets, not proven device performance limits.

## Roadmap seam

The next Procedural Scene Engine adds `SceneRecipe`, `LayoutConstraints`, `SafeZones`, typed landscape and placement grammars while reusing the same `SceneDocument v1`. A future UI design system continues to share semantic tokens but not SVG path types.

See [CHARACTER_ENGINE.md](CHARACTER_ENGINE.md) for expression/pose grammars and [PERFORMANCE.md](PERFORMANCE.md) for measurement targets.
