# Physical device performance evidence (intentionally absent)

There is **no** `manifest.json` in this source release because real devices have not been profiled. Never fabricate one to bypass the gate.

When measured:

1. Gather raw, anonymized native frames and memory traces under `release-evidence/traces/`.
2. Construct `manifest.json` conforming to `manifest.example.json` for the **exact release git commit**.
3. `node tools/device/verify-release-evidence.cjs release-evidence/manifest.json`.
4. A reviewer compares parsed numbers to raw traces and certifies the measurement method.

Required platforms: physical Android and physical iOS. Required scenarios: `scene-scroll`, `motion-idle`, `milestone-celebration`, `scene-transition`. Use actual measured values, ≥300 frames per scenario, release build, hardware metadata, and rawTrace paths inside the evidence folder.
