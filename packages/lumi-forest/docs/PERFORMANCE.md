# LUMI Forest v0.3 — performance engineering contract

## Proposed budgets (targets, not verified native measurements)

| Metric | Target | Verification |
|---|---:|---|
| SceneDocument nodes / default scene | ≤110 | Node tests |
| Character blueprint authored parts | ≤96 | compiler validation |
| Character blueprint raw nested VectorNode count | ≤256 | compiler validation |
| Character blueprint recursion depth | ≤14 | compiler validation |
| Cached common variants / blueprint | ≤48 | bounded Map |
| Character compose p95 / midrange mobile release | ≤2 ms | **hardware pending** |
| Scene compose p95 / midrange mobile release | ≤3 ms | **hardware pending** |
| JS animation scheduling p95 at 60Hz | ≤20 ms | **hardware pending** |
| Native Android frames above 16.67ms @60Hz | ≤3% | **hardware pending** |
| Character Lab tab switch p95 | ≤350 ms | **hardware pending** |
| Relative memory growth vs empty scene | ≤8 MB | **hardware pending** |

The 60Hz frame budget is 16.67ms and the 120Hz budget is 8.33ms. Set the intended refresh rate explicitly during profiling. A compiled SVG may still be expensive to layout or rasterize on a particular GPU despite fast JS composition.

## Optimizations implemented

- Once-per-blueprint anatomy validation and painter-order sorting in a `WeakMap`.
- Original VectorNodes retained by reference, not deep-cloned or parsed from XML.
- Stable default geometry references; common low-cardinality variants cached in a bounded 48-entry Map / blueprint. Proportion-customized variants are uncached.
- `React.memo` / `useMemo` in `LumiCharacter`, `LumiBackground`; dependency stability is the consumer's responsibility.
- One SVG surface for each standalone character/background and actual SVG primitives rather than `SvgXml` parsing.
- Pure scene compiler and character compiler run on *semantic changes only*, not on animation frames or scroll events.
- Character Lab displays one species' 8 combinations at a time, not all 40 simultaneously.
- A platform-neutral VectorNode IR keeps the option of precompiled static SVG or a separate future renderer based on device benchmarks, not assumptions.

## Measurements that can be run locally

`npm run bench` reports Node.js scene compile and serialization times. `npm run bench:characters` reports Node.js uncached (proportions) and cache-hit character compilation. They do **not** measure React Native native rendering, layout, JSI, GPU, FPS or memory. Offline image baselines run under CairoSVG, not RN. Do not claim either as production rendering benchmarks.

## Physical-device release measurements (mandatory before shipping)

1. Install a release build on a low/midrange Android device and one iPhone (capture model, OS, refresh rate and RAM).
2. For each animal open Character Lab, switch between 4 expressions × 2 poses and 4 accessories; capture baseline and p95 transition latency.
3. Test 5 scene backgrounds, portrait/landscape rotation, a scrolling view and repeated tab changes. Use Android Perfetto/System Trace/gfxinfo and iOS Instruments Animation Hitches/Time Profiler/Allocations.
4. Compare against a blank UI on the same hardware and collect memory after repeated mount/unmount. Avoid dev mode and screen-recording overhead when timing.
5. Investigate native SVG element count and expensive path tessellation if frame budgets fail. Consider grouped raster layers or Skia only after a measured bottleneck.
6. Save raw captures plus hardware metadata with the release SHA. Never attach child data or use personally identifying seeds.

See [DEVICE_TESTING.md](DEVICE_TESTING.md).

## v0.4 procedural budget update

Procedural scenes generate more decorative primitives than the legacy static scenes. Separate acceptance caps now apply: **250 SVG nodes, 52 placed items, 35 attempts per object, 32 user-provided safe zones**. These are guardrails on *IR complexity*, not proven native GPU or FPS budgets. Actual acceptable caps must be calibrated by measuring p95 frame time, memory, and transition latency on a low/mid-range Android device and iPhone (release configuration). The `bench:procedural` script measures pure Node.js composition only and cannot measure native rendering.

## UI Design System v0.5 targets (not measured yet)

- Small interactions (buttons, chips, switches) should stay on the native UI path with minimal state updates and no vector recompilation.
- On a mid-range Android phone, target **60 FPS** during ordinary screen scroll and sheet presentation; investigate sustained p95 frames above **16.7 ms** on a 60 Hz display. Evaluate 120 Hz devices separately.
- Target interaction-to-visual feedback below **100 ms** for local UI state transitions. This is a planning budget, **not** a current benchmark.
- Keep tap targets >=44 dp, labels scalable, and chart summary accessible without touching the SVG renderer.
- Test mode changes and complex screens on release builds. Static `React.memo` components do not guarantee 60 FPS without measurements.
- Track `onLayout` updates and avoid feeding UI component state into the procedural scene seed; safe zones should update only when layout actually changes.


## Animation Engine v0.6 budgets — unverified native goals

| Measure | Target / hard guardrail | Tool |
|---|---:|---|
| Static character extra topology | Max 6 animated SVG groups | `tests/motion.test.cjs` |
| Simultaneously moving characters per screen | Recommend ≤ 3 | Screen review |
| Scene crossfade snapshots | Max 2 | `LumiSceneTransition` |
| Typical target refresh | 60 FPS | Release build device |
| p95 frame completion @60Hz | ≤ 16.67 ms | Android gfxinfo + Perfetto |
| Frames exceeding one refresh budget | < 2% | Perfetto, gfxinfo as approximation |
| p95 slow frame threshold | ≤ 32 ms | Device traces |
| Character geometry compile per frame | 0 | Architectural invariant |

Use `bash tools/device/measure-motion-android.sh com.example.lumiforestlab 60 ./device-motion-output 30` on a physical release-build Android device with Motion Lab already visible. Capture one 30-second *idle* baseline, one 30-second *sleep* run, and a 30-second run that includes repeated celebrations. **Node.js compilation timings are not FPS.** Compare a blank screen on the same hardware and capture heap and GPU cost separately. Native frame cadence and battery / thermal behavior remain unverified.
