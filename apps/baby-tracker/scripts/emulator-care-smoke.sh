#!/usr/bin/env bash
# Headless Pixel_6 care smoke: welcome → wet diaper → force-stop → history.
# Requires ANDROID_HOME/emulator, adb, and a personally signed release APK.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="${LUMI_RELEASE_APK:-$ROOT/android/app/build/outputs/apk/release/app-release.apk}"
AVD="${LUMI_AVD:-Pixel_6}"
EMU_BIN="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}/emulator/emulator"
LOG="${LUMI_EMU_LOG:-/tmp/lumi-emulator-care.log}"
RESULT_DIR="${LUMI_CARE_RESULT_DIR:-/tmp/lumi-care-smoke}"
mkdir -p "$RESULT_DIR"

if [[ ! -f "$APK" ]]; then
  echo "missing APK: $APK" >&2
  exit 1
fi

pkill -f "qemu-system-aarch64" >/dev/null 2>&1 || true
pkill -f "emulator -avd ${AVD}" >/dev/null 2>&1 || true
sleep 2
rm -f "$HOME/.android/avd/${AVD}.avd/"*.lock 2>/dev/null || true

nohup "$EMU_BIN" -avd "$AVD" -no-window -no-audio -no-snapshot-load \
  -gpu swiftshader_indirect -memory 2048 -cores 2 -ports 5554,5555 \
  >"$LOG" 2>&1 &
EMU_PID=$!
echo "EMU_PID=$EMU_PID"

ok=0
for i in $(seq 1 90); do
  if ! kill -0 "$EMU_PID" 2>/dev/null; then
    echo "emulator exited during boot" >&2
    tail -40 "$LOG" >&2
    exit 1
  fi
  boot="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
  if [[ "$boot" == "1" ]]; then
    echo "BOOTED i=$i"
    ok=1
    break
  fi
  sleep 3
done
[[ "$ok" == "1" ]] || { echo "boot timeout" >&2; exit 1; }

adb shell settings put global window_animation_scale 0 >/dev/null
adb shell settings put global transition_animation_scale 0 >/dev/null
adb shell settings put global animator_duration_scale 0 >/dev/null

adb uninstall com.matejikj >/dev/null 2>&1 || true
adb install -r -t "$APK"
adb logcat -c
adb shell am start -W -n com.matejikj/.MainActivity >/dev/null
sleep 16
# Best-effort dismiss of System UI ANR "Wait"
adb shell input tap 850 1180 >/dev/null 2>&1 || true

dump_ui() {
  local remote="$1"
  local localf="$2"
  local attempt
  for attempt in $(seq 1 10); do
    adb shell pkill uiautomator >/dev/null 2>&1 || true
    sleep 1
    if adb shell uiautomator dump "$remote" >/dev/null 2>"$RESULT_DIR/dump.err"; then
      if adb pull "$remote" "$localf" >/dev/null 2>&1; then
        return 0
      fi
    fi
    adb shell input tap 850 1180 >/dev/null 2>&1 || true
    sleep 2
  done
  echo "uiautomator dump failed for $localf" >&2
  return 1
}

tap_id() {
  python3 - "$1" "$2" <<'PY'
import re, sys, subprocess
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
rid = sys.argv[2]
for m in re.finditer(r"<node [^>]*>", xml):
    tag = m.group(0)
    if f'resource-id="{rid}"' not in tag:
        continue
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    if not b:
        continue
    x1, y1, x2, y2 = map(int, b.groups())
    x, y = (x1 + x2) // 2, (y1 + y2) // 2
    print(f"TAP_ID {rid} {x},{y}")
    subprocess.check_call(["adb", "shell", "input", "tap", str(x), str(y)])
    raise SystemExit(0)
print(f"MISSING_ID {rid}", file=sys.stderr)
raise SystemExit(1)
PY
}

tap_text() {
  python3 - "$1" "$2" <<'PY'
import re, sys, subprocess
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
label = sys.argv[2]
for m in re.finditer(r"<node [^>]*>", xml):
    tag = m.group(0)
    t = re.search(r'text="([^"]*)"', tag)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    if not (t and b and t.group(1) == label):
        continue
    x1, y1, x2, y2 = map(int, b.groups())
    x, y = (x1 + x2) // 2, (y1 + y2) // 2
    print(f"TAP_TEXT {label} {x},{y}")
    subprocess.check_call(["adb", "shell", "input", "tap", str(x), str(y)])
    raise SystemExit(0)
print(f"MISSING_TEXT {label}", file=sys.stderr)
raise SystemExit(1)
PY
}

texts_of() {
  python3 - "$1" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
print("\n".join(t for t in re.findall(r'text="([^"]*)"', xml) if t))
PY
}

dump_ui /sdcard/lumi-care-a.xml "$RESULT_DIR/a.xml"
adb shell screencap -p /sdcard/lumi-care-welcome.png >/dev/null
adb pull /sdcard/lumi-care-welcome.png "$RESULT_DIR/welcome.png" >/dev/null
echo "WELCOME_TEXTS:"
texts_of "$RESULT_DIR/a.xml" | tee "$RESULT_DIR/welcome-texts.txt"

if grep -q 'resource-id="welcome-skip"' "$RESULT_DIR/a.xml"; then
  tap_id "$RESULT_DIR/a.xml" welcome-skip || tap_text "$RESULT_DIR/a.xml" "Přeskočit úvod"
  sleep 3
fi

dump_ui /sdcard/lumi-care-b.xml "$RESULT_DIR/b.xml"
echo "TODAY_TEXTS:"
texts_of "$RESULT_DIR/b.xml" | tee "$RESULT_DIR/today-texts.txt"
tap_id "$RESULT_DIR/b.xml" quick-diaper || tap_text "$RESULT_DIR/b.xml" "Plenka"
sleep 3

dump_ui /sdcard/lumi-care-c.xml "$RESULT_DIR/c.xml"
echo "SHEET_TEXTS:"
texts_of "$RESULT_DIR/c.xml" | tee "$RESULT_DIR/sheet-texts.txt"
tap_id "$RESULT_DIR/c.xml" direct-wet || tap_text "$RESULT_DIR/c.xml" "Zapsat mokrou"
sleep 3

dump_ui /sdcard/lumi-care-d.xml "$RESULT_DIR/d.xml"
echo "SAVED_TEXTS:"
texts_of "$RESULT_DIR/d.xml" | tee "$RESULT_DIR/saved-texts.txt"
if texts_of "$RESULT_DIR/d.xml" | grep -qi 'uloženo'; then
  echo PASS_SAVED=1 | tee "$RESULT_DIR/pass-saved.txt"
else
  echo PASS_SAVED=0 | tee "$RESULT_DIR/pass-saved.txt"
fi

adb shell am force-stop com.matejikj
sleep 2
adb shell am start -W -n com.matejikj/.MainActivity >/dev/null
sleep 12
adb shell input tap 850 1180 >/dev/null 2>&1 || true
dump_ui /sdcard/lumi-care-e.xml "$RESULT_DIR/e.xml"
if grep -q 'resource-id="welcome-skip"' "$RESULT_DIR/e.xml"; then
  tap_id "$RESULT_DIR/e.xml" welcome-skip || true
  sleep 3
  dump_ui /sdcard/lumi-care-e.xml "$RESULT_DIR/e.xml"
fi
tap_text "$RESULT_DIR/e.xml" "Historie" || true
sleep 3
dump_ui /sdcard/lumi-care-f.xml "$RESULT_DIR/f.xml"
echo "HISTORY_TEXTS:"
texts_of "$RESULT_DIR/f.xml" | tee "$RESULT_DIR/history-texts.txt"
if texts_of "$RESULT_DIR/f.xml" | grep -Eiq 'Plenka|Mokrá|mokrou'; then
  echo PASS_HISTORY=1 | tee "$RESULT_DIR/pass-history.txt"
else
  echo PASS_HISTORY=0 | tee "$RESULT_DIR/pass-history.txt"
fi

adb logcat -d | grep -E "LUMI_BOOTSTRAP_STEP|LUMI_BOOTSTRAP_FAIL" | tee "$RESULT_DIR/bootstrap.log" | tail -40

saved="$(cut -d= -f2 "$RESULT_DIR/pass-saved.txt")"
history="$(cut -d= -f2 "$RESULT_DIR/pass-history.txt")"
echo "RESULT saved=$saved history=$history"
if [[ "$saved" == "1" && "$history" == "1" ]]; then
  echo CARE_SMOKE=PASS
  exit 0
fi
echo CARE_SMOKE=FAIL
exit 2
