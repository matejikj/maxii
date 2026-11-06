# Physical-device and viewport validation

## Coverage and current status

Pure-scene six-viewport validation is **executed**. Native screenshots, layout accessibility and actual device FPS are **prepared, not executed**. There is no device attached to the artifact-generation environment. This is not a claim of tested Android/iOS production performance.

| Profile | Dimensions (dp target) | Pure layout | SVG image snapshots | Physical device |
|---|---:|:---:|:---:|:---:|
| Small phone | 320×568 | PASS | PASS | Pending |
| Reference phone | 390×844 | PASS | PASS | Pending |
| Large phone | 430×932 | PASS | PASS | Pending |
| Portrait tablet | 768×1024 | PASS | PASS | Pending |
| Landscape tablet | 1024×768 | PASS | PASS | Pending |
| Landscape phone | 844×390 | PASS | PASS | Pending |

OS coverage still needed: low- and mid-range Android hardware (including 60/120Hz), recent Pixel/Samsung, iPhone small/large, iPad, notches/safe areas, Dynamic Type, Android font scaling, VoiceOver/TalkBack, Reduce Motion, dark mode (currently light-only), rotation and low-memory behavior. Test both cold and warm scene transitions.

## Build & capture real screenshots

```bash
npm install
npm run typecheck:all
cd apps/lumi-showcase
npx expo run:android --variant release  # USB connected, adb recognized
# On macOS with a configured iOS real device:
# npx expo run:ios --configuration Release --device
cd ../..

# Maestro CLI installed and device attached; from repository root:
maestro test apps/lumi-showcase/.maestro/capture.yaml
# Screenshots saved under apps/lumi-showcase/.maestro/captures/*.png by the flow.
python3 packages/lumi-forest/tools/device/compare-screenshots.py \
  --platform android --profile pixel7-1080x2400-3x --approve
# Inspect and commit the newly approved baselines to packages/lumi-forest/tests/native/baselines/.
# Then later RUN WITHOUT --approve to verify real device regression:
python3 packages/lumi-forest/tools/device/compare-screenshots.py \
  --platform android --profile pixel7-1080x2400-3x
```

For iOS choose `--platform ios` and an exact device/OS/render-scale profile. Do not reuse baseline captures across devices of different pixel sizes or OS versions. Always clear status-bar/system clock variations or mask dynamic content before treating whole-screen comparisons as strict; this showcase uses fixed mock data but the status bar is still owned by the OS. The image checker fails closed if captures/references are missing or images differ beyond tolerance. CI only runs the independent 30 offline SVG snapshots by default; a dedicated device runner is needed to gate native screenshots automatically.

## Android native frame measurements (physical hardware)

```bash
# On physical device, install RELEASE build first. Start app, then:
bash packages/lumi-forest/tools/device/measure-android.sh com.example.lumiforestlab 60 ./device-perf-output
# Reset gfxinfo, then manually switch LUMI scenes many times as instructed.
# Results: device-perf-output/device.txt, framestats.txt, summary.json
```

`FrameCompleted - IntendedVsync` is a rough native completion latency from Android gfxinfo, not a GPU frame trace or exact missed-vsync classifier. Explicit refresh rate supplied by tester. Compare with release build and a blank baseline screen on the same device. `npm run bench` is an algorithm microbenchmark on Node and is NOT device FPS. Prefer Android Studio System Trace / Perfetto for precise draw, Choreographer and GPU profiling, and profile in release mode without dev tools enabled.

## iOS on real hardware

Use Xcode Instruments (Animation Hitches, Time Profiler, Allocations) on a **Release configuration** installed on a connected iPhone. Record at least 30 seconds of scene switching and a separate idle-screen capture. Save model, iOS version, refresh rate, CPU/memory graphs, frame hitch stats, screenshots and changeset SHA in a test report. The framework provides no fabricated iOS metrics.

## Device JS sampling

In Expo Showcase open `perf` tab → `Změřit na zařízení`. 300 `composeScene` calls measure p50/p95 JS algorithmic time; 180 `requestAnimationFrame` intervals measure JS scheduling. On Android native frame completion must be checked separately. Results appear in the UI and `LUMI_PERF_RESULT` log. Never treat these JS numbers as true UI-thread/GPU FPS.

## v0.3 Character Engine native screenshot additions

```bash
# After installing a release build and Maestro CLI on an actual device:
maestro test apps/lumi-showcase/.maestro/characters.yaml
# Captures are made for rabbit/bear/fox/otter/hedgehog and one accessory variant.
```

The Expo Character Lab keeps eight pose/expression cards mounted per selected animal; switch species and accessories repeatedly while profiling. Test 320–430dp phone widths, portrait tablet, landscape rotation, font scaling, screen reader and accessibility focus. Offline `tests/characters-visual/baselines/` are CairoSVG references and **are not native baseline screenshots**.
