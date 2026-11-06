# LUMI Forest v0.6.0 — Implementation changelog

- `core/motion`: declarative motion profiles, safe bounded amplitudes, painter-stable character part topology.
- `LumiAnimatedCharacter`: Reanimated-driven eye blink, independent ear rotation, breathing, sleeping drift, milestone bounce and stars, no per-frame compiler calls.
- `LumiSceneTransition`: two-document crossfade, static document memoization, old document cleanup.
- `LumiAnimatedProceduralBackground`: viewport-aware integration with v0.4 planner and an opt-in 18dp motion safety clearance around the character. Core default for old scenes is 0dp, retaining all goldens.
- `LumiMotionProvider`: runtime OS Reduce Motion observer and foreground lifecycle pausing, opt-in app preference. No Reanimated-wide global configuration changes.
- Expo Motion Lab, standalone Storybook motion story, Maestro E2E smoke sequence, release-build Android frame measurement helper.
- 16 dedicated motion tests (including renderer-free exact geometry reconstruction and motion envelope collision checks) plus 20 offline still regressions.

### Local validation

- 110/110 unit, contract, architecture tests pass.
- 30/30 original scene, 40/40 character, 30/30 procedural and 20/20 motion still raster regressions pass.
- Syntax transpilation of 45 React Native and Storybook TS/TSX sources passes.
- 2/2 Android gfxinfo parser fixtures pass.
- **NOT verified**: full native typecheck, Metro bundle, animated SVG native props, app on hardware, FPS/energy consumption, Maestro runtime. npm registry unavailable (`EAI_AGAIN`).

See `docs/ANIMATION_ENGINE.md` and `docs/VALIDATION_V0_6.md`.
