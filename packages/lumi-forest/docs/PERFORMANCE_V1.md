# v1.0 performance acceptance and evidence

## Verified locally (CPU / geometry only)

- Max SVG nodes across the 5 legacy scenes with the release benchmark fixture: **65** (budget ≤ 110).
- Max SVG nodes across the 5 procedural scenes at 1024×768 with the release fixture: **179** (budget ≤ 250).
- Approximate Node.js CPU p95 on AMD EPYC 9V74 (Node 22.16.0, 2500 samples per case): legacy scene **0.0221 ms**, procedural **0.5107 ms**, cached character **0.0007 ms**, uncached character **0.0131 ms**.
- These numbers are diagnostic and sensitive to CPU load, V8/JIT, scene parameters and runtime versions. **They do NOT measure React Native native SVG rasterization, animation FPS, UI memory usage or battery drain.** See `reports/performance/node-cpu-local.json`.

## Hardware release targets — NOT YET VERIFIED

| Requirement | Acceptance gate | Evidence |
| --- | --- | --- |
| Physical-device coverage | ≥ 1 low/midrange Android AND ≥ 1 iPhone | Device model/OS/refresh, release build, commit SHA |
| 4 usage scenarios/device | `scene-scroll`, `motion-idle`, `milestone-celebration`, `scene-transition` | ≥ 300 native frames per scenario |
| Native frame p95 | ≤ 1.5 × refresh interval (60 Hz: 25 ms), not a claim of 60 FPS | Android framestats + iOS Instruments |
| Native frames over refresh threshold | ≤ 3% | Raw native trace |
| Additional memory vs baseline | ≤ 8 MB | Stable after warm-up and GC |
| Frame-loop geometry recompilation | 0 | Architecture invariant + profiling |
| Raster visual regression | 120/120 approved baselines | CairoSVG image comparisons (not native screenshot proof) |

`node tools/device/verify-release-evidence.cjs release-evidence/manifest.json` validates the evidence manifest and checks that trace files exist; it **cannot** determine the authenticity of a trace or assert that Android and iOS use perfectly comparable frame-latency semantics. A qualified engineer should review traces and device recording conditions before release. For high-refresh devices, adjust the measurement methodology accordingly; p95 bounds are a decision threshold, not a mathematical FPS guarantee.

## Native device procedure

- Checkout the release SHA and install a **release** build; first capture an empty screen control. Disable remote JS debugging and record the refresh rate.
- Android: use `bash tools/device/measure-motion-android.sh <package> 60 <out-dir> 30` on **physical** device; preserve raw `framestats.txt`, device metadata, and `summary.json`.
- iOS: collect Instruments `Animation Hitches` / `Core Animation` / `Allocations` traces on a **physical** device; include model/OS, measurements and trace.
- Record four scenarios, pre-warm, and compare against an empty UI; report thermal state, throttling, sampling windows and memory baseline. Use no child data in measurements.
- Review results, copy sanitized raw traces and a reviewed manifest into `release-evidence/` for the manual release workflow. Do not commit device serial numbers or user health data.
- Only if target fails, profile SVG tessellation/overdraw and compare native SVG against static prerender or optional Skia renderer. No Skia dependency is included by default.

See `docs/DEVICE_TESTING.md` for existing scripts and `release-evidence/README.md` for the manifest.
