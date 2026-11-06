# Validation record — v0.3.0 — 2026-11-06

## Locally executed checks

- `npm run typecheck:core`: strict core TypeScript compilation, including schema-v2 interfaces, compiler and generic parameter passes.
- `npm test`: **65/65 PASS** Node unit, architecture, viewport, pose/expression, accessory and proportion contract tests, compatibility with blueprint-v1, original five golden SVG hashes.
- `npm run test:visual`: original **30/30** scene pixel regressions, using pinned CairoSVG/Pillow.
- `npm run test:characters:visual`: new **40/40** character regressions, 5 species × 2 poses × 4 expressions.
- `npm run test:device-parser`: Android gfxinfo parser fixture tests.
- All five legacy scene SHA-256 golden hashes remain unchanged from v0.2.1.
- 45 standalone SVG character exports are derived from the same renderer-neutral IR: 40 expressions/poses and 5 accessory combinations.

Check terminal output or CI for the latest numerical test counts; the values above apply to the source tree at release preparation.

## Configured but **not** executed in this environment

- `npm run typecheck:all`: full React Native and Expo typecheck, because registry-installed dependencies are unavailable.
- Expo start, Expo SDK dependency doctor, Android/iOS Metro production exports, native release builds.
- Real-device Android/iOS screenshot capture (`apps/lumi-showcase/.maestro/capture.yaml`, `apps/lumi-showcase/.maestro/characters.yaml`).
- Real-device frame pacing, GPU timing, memory and screen-switch latency. Budgets in `PERFORMANCE.md` remain targets, not measured results.

The source archive intentionally contains no unverified `package-lock.json`. On a network-enabled workstation, run `npm install`, validate Expo peer versions, commit the resulting lock and change the CI installation step to `npm ci`.

## Signoff gate

A green pure-core/image suite is **not** enough to label this a fully production-validated mobile library. Release signoff requires full RN/Expo typecheck, successful iOS/Android release builds and image/performance testing on representative physical devices.
