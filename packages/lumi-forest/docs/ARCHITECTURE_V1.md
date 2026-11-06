# Architecture v1.0 — stable boundaries

```text
App Data (child's records)  [NOT in LUMI library]
                 |
         UI Layout / Safe Zones          Stored Scene Recipe v1/v2
                 |                                  |
                 |                       validate + migrateSceneRecipe()
                 |                                  |
                 +------------> compileSceneRecipe() <----------+
                                                    |
                        Character Blueprint v1/v2 + Scene Grammar
                                 |                  |
                          compileCharacter()  planProceduralScene()
                                 \                 /
                                  \               /
                              SceneDocument v1 / VectorNode
                                      |         |
                              RN Svg primitives  Offline SVG export
                                      |
                              Motion adapters (Reanimated UI thread)
                                      |
                              UI primitives (semantic theme tokens)
```

## Key invariants

1. `src/core` is independent of React, React Native, native modules and network IO. This boundary has a scanned unit test.
2. App records, photos, growth charts and health data never enter the illustrator compiler or seed algorithm.
3. `SceneDocument v1` is a renderer contract and should stay unchanged for v1.x. Durable UI preference recipes have their *own* version number.
4. Different renderers must consume the same IR. React Native uses SVG elements; offline tools serialize safely. Skia is explicitly deferred until an A/B native benchmark proves an advantage.
5. `compileCharacter`, `composeScene` and `planProceduralScene` run when semantic parameters change. The motion layer updates only transformations/opacity via shared values, never re-compiles a character on a frame tick.
6. UI is composed of React Native primitives plus semantic theme tokens, with controlled accessibility and Reduce Motion.
7. Visual regression includes 30 original screen baselines, 40 character poses/expressions, 30 procedural layouts and 20 motion stills. Native runtime animation and frame timing require device validation.
8. Untrusted JSON passes through `readSceneDocument` or `readSceneRecipe` before entering the engine. No arbitrary SVG XML is accepted as a native runtime input.
9. Stable entrypoints: `@lumi/forest-design`, `@lumi/forest-design/core`, `@lumi/forest-design/native`. No deep imports.
10. Tagged releases are **not** automatically published. Lockfile, built artifacts, compiled ESM smoke check, mobile bundles, screenshots and physical-device evidence are mandatory gates.

## Monorepo layout

- `src/core/vector`: typed IR + serializer.
- `src/core/scenes`, `characters`, `procedural`, `motion`, `ui`: platform-independent compilers.
- `src/core/versioning`: persistent recipes, blueprint migration and untrusted-document validation.
- `src/react-native`: SVG adapters, animated components and accessible UI.
- `apps/lumi-showcase`: demo, labs and isolated Storybook.
- `tests`: contract and regression tests; `contracts/public-api.json` freezes names.
- `tools/device`: parsers and release-evidence verifier, not automatically authenticated device tests.
- `docs`: public API, versioning, integration, performance and release operations.
- `.github/workflows`: CI, manual GitHub draft release, optional npm OIDC publication.

## Remaining release blockers

- npm dependencies could not be fetched in this environment (`EAI_AGAIN`), preventing full RN typecheck, Bob build, Metro exports and generating a lockfile.
- Real Android and iPhone releases cannot be certified without physical-device captures.
- Package namespace and license need explicit owner decisions. Until then this is a **source release candidate**, not a published package.
