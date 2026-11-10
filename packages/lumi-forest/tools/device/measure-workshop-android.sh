#!/usr/bin/env bash
# Workshop appearance scenarios for physical Android gfxinfo capture.
# Does not invent timings — requires a connected release build and operator scroll.
set -euo pipefail
PACKAGE="${1:-com.matejikj.babytracker}"
HZ="${2:-60}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="${3:-$(mktemp -d)}"
SCENARIOS=(
  workshop-forest-static
  workshop-studio-static
  workshop-studio-action
  workshop-restrained-static
)

if ! command -v adb >/dev/null 2>&1; then
  echo 'adb missing (Android platform-tools required)' >&2
  exit 1
fi
if ! adb get-state >/dev/null 2>&1; then
  echo 'no Android device/emulator authorized for adb' >&2
  exit 1
fi

mkdir -p "$OUT"
{
  echo "UTC $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "MODEL $(adb shell getprop ro.product.model | tr -d '\r')"
  echo "SDK $(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "PACKAGE $PACKAGE"
  echo "REFRESH_HZ_ASSUMED $HZ"
  echo "SCENARIOS ${SCENARIOS[*]}"
} >"$OUT/device.txt"

for scenario in "${SCENARIOS[@]}"; do
  echo
  echo "=== $scenario ==="
  echo "Open the release build, set the matching workshop look, and scroll/switch 15–30 times."
  echo "Press Enter when finished..."
  read -r
  adb shell dumpsys gfxinfo "$PACKAGE" reset >/dev/null
  # Brief settle so the next capture starts clean after operator interaction.
  sleep 1
  adb shell dumpsys gfxinfo "$PACKAGE" framestats >"$OUT/${scenario}.framestats.txt"
  python3 "$ROOT/parse-gfxinfo.py" "$OUT/${scenario}.framestats.txt" \
    --hz "$HZ" --output "$OUT/${scenario}.summary.json"
done

echo "Workshop Android traces saved under $OUT"
echo "Do not invent a release-evidence/manifest.json — attach only measured summaries."
