# v0.6 validation log

This document separates tests run in the artifact environment from checks that require npm and real devices.

## Executed result (2026-11-06)

- Pure TypeScript core + unit/contract/architecture tests: **110/110 PASS**.
- Original SVG regression: **30/30 PASS**. Character regression: **40/40 PASS**. Procedural regression: **30/30 PASS**.
- Motion offline reference frames: **20/20 PASS** (no native playback implied).
- TypeScript/TSX syntax transpilation (not RN typecheck): **45 files, 0 errors**.
- Device frame parser fixture: **2/2 PASS**.
- Npm network probe: `EAI_AGAIN registry.npmjs.org`; full native compile / Metro / device run **unavailable**.

## Run locally

- `npm test`: TypeScript core compile + all unit/architecture/contract test suites.
- `npm run check:tsx`: transpile syntax of native source and Storybook, **not native typecheck**.
- `npm run test:visual`: existing 30 SVG screenshots across six viewport fixtures.
- `npm run test:characters:visual`: existing 40 character screenshots.
- `npm run test:procedural:visual`: existing 30 procedural scenes.
- `npm run test:motion:visual`: 20 static storyboard stills (not motion runtime frames).
- `npm run test:device-parser`: frame log parser fixture.
- `npm run bench:characters`: Node.js character compiler benchmark, never interpreted as FPS.

## Outstanding production gates

1. Restore `npm install` on a machine with network, then run `npm run typecheck:all` and `npm run expo:doctor`; commit the lockfile and switch CI to `npm ci`.
2. Build and boot Expo SDK 58 showcase on a real iPhone and mid-range Android with Hermes / Fabric and Reanimated 4.7 + Worklets 0.13. Verify SVG group numeric `rotation/scaleY` animated props and star offsets.
3. Run `apps/lumi-showcase/.maestro/motion.yaml` and test OS Reduce Motion while actively blinking / celebrating, AppState background/foreground, 30 rapid scene swaps, switch from idle to sleep.
4. Measure P50/P95 GPU/UI frame completion, dropped frames, JS & native memory, frame scheduler, and thermal effects on at least two devices. Log device model, OS, refresh rate, and release commit SHA.
5. Compare static frame with v0.5 artwork, verify no UI overlaps under animation; ensure a screen with no space to reserve safely omits the animal.
6. Conduct VoiceOver/TalkBack review: decorative characters must remain hidden to screen readers, milestone success must be expressed through accessible UI text / announcement separately.

Do not release solely on passing unit tests or offline CairoSVG raster baselines.
