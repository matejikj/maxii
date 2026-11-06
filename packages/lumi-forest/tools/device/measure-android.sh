#!/usr/bin/env bash
set -euo pipefail
PACKAGE="${1:-com.example.lumiforestlab}"
HZ="${2:-60}"
if ! command -v adb >/dev/null 2>&1; then
  echo 'adb missing (Android platform-tools required)' >&2
  exit 1
fi
adb get-state >/dev/null
DIR="${3:-$(mktemp -d)}"
mkdir -p "$DIR"
{
  echo "UTC $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "MODEL $(adb shell getprop ro.product.model | tr -d '\r')"
  echo "SDK $(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "PACKAGE $PACKAGE"
  echo "REFRESH_HZ_ASSUMED $HZ"
} > "$DIR/device.txt"
adb shell dumpsys gfxinfo "$PACKAGE" reset >/dev/null
printf 'Scroll and switch scenes 15-30 times in the RUNNING RELEASE BUILD on the physical device.\nPress Enter when finished...\n'
read -r
adb shell dumpsys gfxinfo "$PACKAGE" framestats > "$DIR/framestats.txt"
python3 "$(dirname "$0")/parse-gfxinfo.py" "$DIR/framestats.txt" --hz "$HZ" --output "$DIR/summary.json"
echo "Raw and summary saved under $DIR"
