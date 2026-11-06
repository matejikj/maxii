# Validation record — LUMI Forest v0.4.0

Date: 2026-11-06. Tests were executed in a Linux container with globally available TypeScript, Python 3.13, CairoSVG and Pillow. None of the following is a substitute for physical-device QA.

## Passed locally

- `npm run typecheck:core` — TypeScript checks, platform-neutral core.
- `npm test` — **76/76 tests** including the previous 65 regressions and 11 new procedural cases (each scene test loops across six viewport sizes and all three densities).
- `npm run test:visual` — **30/30** offline snapshots of legacy environments.
- `npm run test:characters:visual` — **40/40** offline snapshots of Character Engine variants.
- `npm run test:procedural:visual` — **30/30** new canonical off-device SVG/PNG snapshots.
- `python3 -m unittest discover -s tests -p '*_test.py'` — **2/2** native frame stats parser tests.
- `npm run bench:procedural` — completed Node-only pure-compiler microbenchmarks; specific timings may vary by hardware and are not mobile FPS.
- Visual manual check: all five reference-phone procedural scenes and landscape-tablet variants included in `previews/lumi-v0.4-procedural-worlds.png`.

## Not executed in this container

- Full TypeScript React/React Native/Expo check (React Native dependencies were not installed).
- Expo Metro Android/iOS production bundling and Expo Doctor.
- Android/iOS native build, Maestro device screenshot flows, profiling on physical hardware.
- Production rendering FPS, GPU time, memory usage, accessibility audit.

These remain hard **release gates**. CI is configured to run the typecheck, Metro bundle exports and offline visual regressions after a successful dependency installation. A lockfile should be committed from a connected development environment to make installs reproducible; then change the CI command to `npm ci`.
