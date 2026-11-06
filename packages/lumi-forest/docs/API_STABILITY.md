# Public API stability and Semantic Versioning

- Package version: **1.0.0 source release candidate**.
- The stable entrypoints are `.`, `./core`, `./native`; `contracts/public-api.json` snapshots all exported public names (including TypeScript types).
- **Patch** changes fix behavior without changing public names or persisted formats.
- **Minor** versions add optional API, tokens, new scenes or expressions, without altering existing outputs, defaults or serialized formats.
- **Major** versions may change documented defaults, remove/rename APIs or require a new persistence format. Provide migration and deprecation for at least one minor cycle where practical.
- Deep imports (`src/core/...`, `.test-dist/...`, `lib/...`) are private; add an explicit subpath to stabilize an import rather than relying on internals.
- Do not alter default animal art without explicitly updating golden hashes, 120 visual baselines, and announcing the visual breaking change.
- Default animation behavior must respect Reduce Motion and remain isolated from scene compilation.
- Renderers may evolve independently as long as they implement the same `SceneDocument` IR semantics.

## API review check

`npm run api:check` fails on an exported-name mismatch. Run `npm run api:approve` only after human review of the API diff and SemVer implications. This check freezes names, **not TypeScript signatures**; full declaration compatibility tests against a saved v1.0 package should be added when a verified npm tarball is available. Existing TypeScript typecheck exercises consumer examples, but is not a full API Extractor report.

## Supported compatibility baseline

Expo SDK 58 / RN 0.88 / React 19.3 with svg 15.16, Reanimated 4.7.1, Worklets 0.13.0. `^` peer ranges follow SemVer and should be adjusted when testing a new SDK. The framework is not currently certified for earlier Expo SDKs or RN versions.
