# LUMI Forest 1.0.0 — validation report (2026-11-06)

| Check | Result | Limitations |
| --- | --- | --- |
| Core TypeScript `tsc -p tsconfig.core.json` | PASS | TypeScript from container toolchain |
| Pure Node tests | 129/129 PASS | includes 15 schema/validation tests, 2 synthetic evidence-validator tests and 2 package-gate tests |
| Public API export snapshot | PASS, 170 root / 119 core / 51 native names | Symbols only; TypeScript signature ABI not frozen |
| RN/Storybook TSX syntax checks | 45 files PASS | Not full TypeScript semantic checking |
| 5 scenes × 6 screen dimensions | 30/30 raster snapshots PASS | CairoSVG, not real Android/iOS |
| 5 animals × 2 poses × 4 expressions | 40/40 raster snapshots PASS | Offline static exports |
| 5 procedural scenes × 6 dimensions | 30/30 raster snapshots PASS | No native layout measurement |
| 5 animals × 4 motion still frames | 20/20 PASS | Not time-based animations |
| Android framestats parser | 2/2 PASS | Synthetic input only |
| Node compilation benchmark | PASS | Reports CPU timing and IR complexity, no FPS |
| Full RN semantic typecheck / bob package build / Metro iOS & Android | NOT VERIFIED | npm registry DNS unavailable (`EAI_AGAIN`) |
| Physical Android/iPhone FPS, battery, memory, transitions | NOT MEASURED | No physical devices in environment |
| `package-lock.json`, npm publishing, GitHub Actions execution | NOT COMPLETED | Registry/repository credentials unavailable |

No CI or device certification is claimed. The release workflow intentionally refuses to publish until lockfile, full checks and reviewed device evidence exist.
