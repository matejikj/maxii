#!/usr/bin/env bash
# Measure only after you have selected Motion Lab on a PHYSICAL device running a RELEASE build.
set -euo pipefail
PACKAGE="${1:-com.example.lumiforestlab}"
HZ="${2:-60}"
DIR="${3:-./device-motion-output}"
SECONDS_TO_SAMPLE="${4:-30}"
command -v adb >/dev/null || { echo 'adb required' >&2; exit 1; }
[[ "$SECONDS_TO_SAMPLE" =~ ^[0-9]+$ ]] && [ "$SECONDS_TO_SAMPLE" -ge 10 ] && [ "$SECONDS_TO_SAMPLE" -le 120 ] || {
  echo 'Duration must be 10..120 seconds' >&2; exit 2;
}
mkdir -p "$DIR"
MODEL="$(adb shell getprop ro.product.model | tr -d '\r')"
{
  echo "UTC $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "MODEL $MODEL"
  echo "PACKAGE $PACKAGE"
  echo "REFRESH_HZ_ASSUMED $HZ"
  echo "MODE Motion Lab, continuous animation, release build; verify manually"
} > "$DIR/device.txt"
echo "Profiling Motion Lab on $MODEL for $SECONDS_TO_SAMPLE seconds."
adb shell dumpsys gfxinfo "$PACKAGE" reset >/dev/null
sleep "$SECONDS_TO_SAMPLE"
adb shell dumpsys gfxinfo "$PACKAGE" framestats > "$DIR/framestats.txt"
python3 "$(dirname "$0")/parse-gfxinfo.py" "$DIR/framestats.txt" --hz "$HZ" --output "$DIR/summary.json"
echo "Results: $DIR (device.txt, framestats.txt, summary.json)"
