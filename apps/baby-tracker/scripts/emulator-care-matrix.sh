#!/usr/bin/env bash
# Headless personal care matrix: airplane install → diaper/bottle/note/growth →
# Rozvoj → force-stop → Historie. Requires ANDROID_HOME, adb, signed release APK.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="${LUMI_RELEASE_APK:-$ROOT/android/app/build/outputs/apk/release/app-release.apk}"
AVD="${LUMI_AVD:-Pixel_6}"
EMU_BIN="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}/emulator/emulator"
LOG="${LUMI_EMU_LOG:-/tmp/lumi-emulator-matrix.log}"
RESULT_DIR="${LUMI_CARE_RESULT_DIR:-/tmp/lumi-care-matrix}"
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
# Airplane mode: personal care must not need a network or backend URL.
adb shell settings put global airplane_mode_on 1 >/dev/null
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true >/dev/null 2>&1 || true

adb uninstall com.matejikj >/dev/null 2>&1 || true
adb install -r -t "$APK"
adb logcat -c
adb shell am start -W -n com.matejikj/.MainActivity >/dev/null
sleep 16
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
    print(f"TAP_ID {rid} {(x1+x2)//2},{(y1+y2)//2}")
    subprocess.check_call(["adb", "shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2)])
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
    print(f"TAP_TEXT {label} {(x1+x2)//2},{(y1+y2)//2}")
    subprocess.check_call(["adb", "shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2)])
    raise SystemExit(0)
print(f"MISSING_TEXT {label}", file=sys.stderr)
raise SystemExit(1)
PY
}

tap_desc() {
  python3 - "$1" "$2" <<'PY'
import re, sys, subprocess
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
label = sys.argv[2]
for m in re.finditer(r"<node [^>]*>", xml):
    tag = m.group(0)
    t = re.search(r'content-desc="([^"]*)"', tag)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    if not (t and b and label in t.group(1)):
        continue
    x1, y1, x2, y2 = map(int, b.groups())
    print(f"TAP_DESC {label} {(x1+x2)//2},{(y1+y2)//2}")
    subprocess.check_call(["adb", "shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2)])
    raise SystemExit(0)
print(f"MISSING_DESC {label}", file=sys.stderr)
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

assert_text() {
  local file="$1"
  local needle="$2"
  if texts_of "$file" | grep -F "$needle" >/dev/null; then
    echo "PASS_TEXT $needle"
    return 0
  fi
  echo "FAIL_TEXT $needle" >&2
  texts_of "$file" | head -40 >&2
  exit 2
}

tap_save() {
  local file="$1"
  local attempt
  for attempt in 1 2 3 4 5; do
    if tap_id "$file" form-save 2>/dev/null; then
      return 0
    fi
    if tap_text "$file" "Uložit" 2>/dev/null; then
      return 0
    fi
    # Long care forms keep Uložit below the fold until sticky footer ships in the APK.
    adb shell input swipe 540 1900 540 500 250
    sleep 1
    dump_ui /sdcard/lumi-save.xml "$file" || true
  done
  echo "FAIL_SAVE could not tap Uložit" >&2
  texts_of "$file" | head -40 >&2
  return 1
}

close_sheet() {
  # Nested care sheets (e.g. experience play → picker) need repeated dismiss.
  local attempt
  for attempt in 1 2 3 4; do
    dump_ui /sdcard/lumi-close.xml "$RESULT_DIR/close.xml" || true
    if ! grep -q 'text="×"' "$RESULT_DIR/close.xml" 2>/dev/null; then
      return 0
    fi
    tap_text "$RESULT_DIR/close.xml" "×" || true
    sleep 2
  done
  return 0
}

ensure_foreground() {
  adb shell am start -W -n com.matejikj/.MainActivity >/dev/null 2>&1 || true
  sleep 2
}

go_today() {
  close_sheet
  ensure_foreground
  dump_ui /sdcard/lumi-m.xml "$RESULT_DIR/nav.xml"
  if grep -q 'resource-id="welcome-skip"' "$RESULT_DIR/nav.xml"; then
    tap_id "$RESULT_DIR/nav.xml" welcome-skip || tap_text "$RESULT_DIR/nav.xml" "Přeskočit úvod"
    sleep 3
    dump_ui /sdcard/lumi-m.xml "$RESULT_DIR/nav.xml"
  fi
  if ! tap_text "$RESULT_DIR/nav.xml" "Dnes"; then
    ensure_foreground
    dump_ui /sdcard/lumi-m.xml "$RESULT_DIR/nav.xml"
    tap_text "$RESULT_DIR/nav.xml" "Dnes" || true
  fi
  sleep 2
}

# --- Welcome ---
dump_ui /sdcard/lumi-m0.xml "$RESULT_DIR/0-welcome.xml"
assert_text "$RESULT_DIR/0-welcome.xml" "Přeskočit úvod"
tap_id "$RESULT_DIR/0-welcome.xml" welcome-skip || tap_text "$RESULT_DIR/0-welcome.xml" "Přeskočit úvod"
sleep 3

# --- Wet diaper ---
dump_ui /sdcard/lumi-m1.xml "$RESULT_DIR/1-today.xml"
tap_id "$RESULT_DIR/1-today.xml" quick-diaper || tap_text "$RESULT_DIR/1-today.xml" "Plenka"
sleep 3
dump_ui /sdcard/lumi-m2.xml "$RESULT_DIR/2-diaper.xml"
tap_id "$RESULT_DIR/2-diaper.xml" direct-wet || tap_text "$RESULT_DIR/2-diaper.xml" "Zapsat mokrou"
sleep 3
dump_ui /sdcard/lumi-m3.xml "$RESULT_DIR/3-diaper-saved.xml"
assert_text "$RESULT_DIR/3-diaper-saved.xml" "Přebalení uloženo."
close_sheet

# --- Bottle (amount optional) ---
go_today
dump_ui /sdcard/lumi-m4.xml "$RESULT_DIR/4-today.xml"
tap_id "$RESULT_DIR/4-today.xml" quick-feeding || tap_text "$RESULT_DIR/4-today.xml" "Krmení"
sleep 3
dump_ui /sdcard/lumi-m5.xml "$RESULT_DIR/5-feeding.xml"
tap_id "$RESULT_DIR/5-feeding.xml" feeding-kind-bottle || tap_text "$RESULT_DIR/5-feeding.xml" "Lahvička"
sleep 2
dump_ui /sdcard/lumi-m5b.xml "$RESULT_DIR/5b-feeding.xml"
tap_id "$RESULT_DIR/5b-feeding.xml" feeding-open-bottle || tap_text "$RESULT_DIR/5b-feeding.xml" "Zapsat lahvičku"
sleep 3
dump_ui /sdcard/lumi-m6.xml "$RESULT_DIR/6-bottle.xml"
tap_save "$RESULT_DIR/6-bottle.xml"
sleep 3
dump_ui /sdcard/lumi-m7.xml "$RESULT_DIR/7-bottle-saved.xml"
if texts_of "$RESULT_DIR/7-bottle-saved.xml" | grep -Eqi 'Lahvička uložena'; then
  echo PASS_BOTTLE=1
else
  echo PASS_BOTTLE=0
  texts_of "$RESULT_DIR/7-bottle-saved.xml" | tee "$RESULT_DIR/7-bottle-saved.txt"
  exit 2
fi
close_sheet

# --- Experience (area chip — avoids IME/controlled-text flakiness) ---
go_today
dump_ui /sdcard/lumi-m8.xml "$RESULT_DIR/8-today.xml"
tap_id "$RESULT_DIR/8-today.xml" quick-experience || tap_text "$RESULT_DIR/8-today.xml" "Zážitek"
sleep 3
dump_ui /sdcard/lumi-m9.xml "$RESULT_DIR/9-experience.xml"
tap_id "$RESULT_DIR/9-experience.xml" experience-play || tap_text "$RESULT_DIR/9-experience.xml" "Hráli jsme si"
sleep 3
dump_ui /sdcard/lumi-m10.xml "$RESULT_DIR/10-play.xml"
tap_text "$RESULT_DIR/10-play.xml" "Pohyb"
sleep 1
dump_ui /sdcard/lumi-m10b.xml "$RESULT_DIR/10-play.xml"
tap_save "$RESULT_DIR/10-play.xml"
sleep 3
dump_ui /sdcard/lumi-m11.xml "$RESULT_DIR/11-play-saved.xml"
assert_text "$RESULT_DIR/11-play-saved.xml" "Zážitek uložen."
close_sheet

# --- Growth via Péče ---
ensure_foreground
dump_ui /sdcard/lumi-m12.xml "$RESULT_DIR/12-nav.xml"
tap_text "$RESULT_DIR/12-nav.xml" "Péče"
sleep 3
dump_ui /sdcard/lumi-m13.xml "$RESULT_DIR/13-care.xml"
tap_id "$RESULT_DIR/13-care.xml" care-record-growth || tap_text "$RESULT_DIR/13-care.xml" "Zapsat růst"
sleep 3
dump_ui /sdcard/lumi-m14.xml "$RESULT_DIR/14-growth.xml"
tap_id "$RESULT_DIR/14-growth.xml" growth-weight-input || tap_desc "$RESULT_DIR/14-growth.xml" "Hmotnost" || tap_text "$RESULT_DIR/14-growth.xml" "Hmotnost"
sleep 1
# Prefer keyevents so React controlled inputs receive digits; avoid '.' for adb text.
adb shell input keyevent KEYCODE_4
sleep 1
# Dismiss IME so the sticky Uložit footer receives the tap (BACK closes keyboard first).
adb shell input keyevent KEYCODE_BACK
sleep 1
dump_ui /sdcard/lumi-m14b.xml "$RESULT_DIR/14-growth.xml"
tap_save "$RESULT_DIR/14-growth.xml" || exit 2
sleep 3
dump_ui /sdcard/lumi-m15.xml "$RESULT_DIR/15-growth-saved.xml"
assert_text "$RESULT_DIR/15-growth-saved.xml" "Měření růstu uloženo."
close_sheet

# --- Rozvoj hub available offline ---
dump_ui /sdcard/lumi-m16.xml "$RESULT_DIR/16-nav.xml"
tap_text "$RESULT_DIR/16-nav.xml" "Rozvoj"
sleep 4
dump_ui /sdcard/lumi-m17.xml "$RESULT_DIR/17-dev.xml"
if grep -q 'resource-id="development-screen"' "$RESULT_DIR/17-dev.xml" || texts_of "$RESULT_DIR/17-dev.xml" | grep -Eqi 'Rozvoj|Dnešní nabídka|Knihovna'; then
  echo PASS_DEVELOPMENT=1
else
  echo PASS_DEVELOPMENT=0
  texts_of "$RESULT_DIR/17-dev.xml"
  exit 2
fi

# --- Restart persistence ---
adb shell am force-stop com.matejikj
sleep 2
adb shell am start -W -n com.matejikj/.MainActivity >/dev/null
sleep 12
adb shell input tap 850 1180 >/dev/null 2>&1 || true
dump_ui /sdcard/lumi-m18.xml "$RESULT_DIR/18-restart.xml"
if grep -q 'resource-id="welcome-skip"' "$RESULT_DIR/18-restart.xml"; then
  tap_id "$RESULT_DIR/18-restart.xml" welcome-skip || true
  sleep 3
  dump_ui /sdcard/lumi-m18.xml "$RESULT_DIR/18-restart.xml"
fi
tap_text "$RESULT_DIR/18-restart.xml" "Historie"
sleep 3
dump_ui /sdcard/lumi-m19.xml "$RESULT_DIR/19-history.xml"
adb shell input swipe 540 1700 540 600 350
sleep 1
dump_ui /sdcard/lumi-m19b.xml "$RESULT_DIR/19b-history.xml"
{
  texts_of "$RESULT_DIR/19-history.xml"
  echo '---'
  texts_of "$RESULT_DIR/19b-history.xml"
} | tee "$RESULT_DIR/history-texts.txt"
pass_hist=1
for needle in "Mokrá" "Lahvička" "Zážitek" "Růst"; do
  if ! grep -Fi "$needle" "$RESULT_DIR/history-texts.txt" >/dev/null; then
    echo "FAIL_HISTORY missing $needle" >&2
    pass_hist=0
  fi
done
echo "PASS_HISTORY=$pass_hist"

adb logcat -d | grep -E "LUMI_BOOTSTRAP_STEP|LUMI_BOOTSTRAP_FAIL|EXPO_PUBLIC_LUMI_API|auth/v1|sync/v1" \
  | tee "$RESULT_DIR/bootstrap.log" | tail -50
if grep -q "LUMI_BOOTSTRAP_FAIL" "$RESULT_DIR/bootstrap.log"; then
  echo "FAIL bootstrap" >&2
  exit 2
fi
if grep -Eqi "EXPO_PUBLIC_LUMI_API|auth/v1|sync/v1" "$RESULT_DIR/bootstrap.log"; then
  echo "FAIL unexpected remote markers in logcat" >&2
  exit 2
fi

# Leave airplane mode off for the host again.
adb shell settings put global airplane_mode_on 0 >/dev/null
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false >/dev/null 2>&1 || true

if [[ "$pass_hist" == "1" ]]; then
  echo CARE_MATRIX=PASS
  exit 0
fi
echo CARE_MATRIX=FAIL
exit 2
