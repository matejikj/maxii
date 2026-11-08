#!/usr/bin/env bash
# Headless personal portable-backup roundtrip on a signed release APK:
# care → sealed export sidecar → uninstall → install → push sidecar → restore.
# Requires ANDROID_HOME, adb, and a personally signed release APK.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="${LUMI_RELEASE_APK:-$ROOT/android/app/build/outputs/apk/release/app-release.apk}"
AVD="${LUMI_AVD:-Pixel_6}"
EMU_BIN="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}/emulator/emulator"
LOG="${LUMI_EMU_LOG:-/tmp/lumi-emulator-portable-backup.log}"
RESULT_DIR="${LUMI_PORTABLE_RESULT_DIR:-/tmp/lumi-portable-backup}"
PACKAGE=com.matejikj
# Expo documentDirectory maps to the app filesDir; release APKs need adb root to pull/push.
SIDECAR_REMOTE="/data/data/${PACKAGE}/files/portable-backups/lumi-last-portable-backup.json"
SIDECAR_DIR="/data/data/${PACKAGE}/files/portable-backups"
PASSWORD="${LUMI_PORTABLE_PASSWORD:-RestoreSmoke1}"
mkdir -p "$RESULT_DIR"

ensure_adb_root() {
  adb root >/dev/null
  sleep 2
  adb wait-for-device
  # Root restart can drop the connection briefly on emulators.
  sleep 2
}

app_uid() {
  adb shell stat -c %u "/data/data/${PACKAGE}" | tr -d '\r'
}

pull_sidecar() {
  ensure_adb_root
  local attempt
  for attempt in $(seq 1 30); do
    if adb shell "test -f '$SIDECAR_REMOTE'" >/dev/null 2>&1; then
      if adb pull "$SIDECAR_REMOTE" "$RESULT_DIR/lumi-last-portable-backup.json" >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep 2
  done
  echo "FAIL sidecar not pullable at $SIDECAR_REMOTE" >&2
  adb shell ls -la "/data/data/${PACKAGE}/files/" 2>&1 | tee "$RESULT_DIR/ls-files.txt" || true
  adb shell ls -la "$SIDECAR_DIR" 2>&1 | tee -a "$RESULT_DIR/ls-files.txt" || true
  return 1
}

push_sidecar() {
  local local_file="$1"
  ensure_adb_root
  local uid
  uid="$(app_uid)"
  adb shell mkdir -p "$SIDECAR_DIR"
  adb push "$local_file" "$SIDECAR_REMOTE" >/dev/null
  adb shell chown -R "${uid}:${uid}" "$SIDECAR_DIR"
  adb shell chmod 700 "$SIDECAR_DIR"
  adb shell chmod 600 "$SIDECAR_REMOTE"
  adb shell ls -la "$SIDECAR_DIR" | tee "$RESULT_DIR/ls-sidecar-after-push.txt"
}


if [[ ! -f "$APK" ]]; then
  echo "missing APK: $APK" >&2
  exit 1
fi

pkill -f "qemu-system-aarch64" >/dev/null 2>&1 || true
pkill -f "emulator -avd ${AVD}" >/dev/null 2>&1 || true
sleep 2
rm -f "$HOME/.android/avd/${AVD}.avd/"*.lock 2>/dev/null || true

# Keep guest RAM modest so the AVD can still boot on constrained host free disk.
nohup "$EMU_BIN" -avd "$AVD" -no-window -no-audio -no-snapshot-load \
  -gpu swiftshader_indirect -memory 2048 -cores 2 -ports 5554,5555 \
  >"$LOG" 2>&1 &
EMU_PID=$!
echo "EMU_PID=$EMU_PID"
adb wait-for-device >/dev/null 2>&1 || true

ok=0
for i in $(seq 1 120); do
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
[[ "$ok" == "1" ]] || { echo "boot timeout" >&2; tail -40 "$LOG" >&2; exit 1; }

adb shell settings put global window_animation_scale 0 >/dev/null
adb shell settings put global transition_animation_scale 0 >/dev/null
adb shell settings put global animator_duration_scale 0 >/dev/null
adb shell settings put global airplane_mode_on 1 >/dev/null
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true >/dev/null 2>&1 || true

adb uninstall "$PACKAGE" >/dev/null 2>&1 || true
adb install -r -t "$APK"
adb logcat -c
adb shell am start -W -n "${PACKAGE}/.MainActivity" >/dev/null
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

type_password() {
  # Alphanumeric only so adb text injection stays reliable on controlled inputs.
  # Avoid KEYCODE_BACK (dismisses the profile sheet) and KEYCODE_TAB (can leave
  # an extra character in secure fields so password/confirm no longer match).
  adb shell input text "$PASSWORD"
}

password_bullet_counts() {
  python3 - "$1" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
for rid in ("backup-export-password", "backup-export-password-confirm", "backup-import-password"):
    m = re.search(rf'resource-id="{rid}"[^>]*text="([^"]*)"', xml)
    if not m:
        m = re.search(rf'text="([^"]*)"[^>]*resource-id="{rid}"', xml)
    if m:
        print(f"{rid} bullets={len(m.group(1))} value={m.group(1)}")
PY
}

scroll_profile_to_backup() {
  local attempt midy
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    dump_ui /sdcard/lumi-pb.xml "$RESULT_DIR/profile.xml" || true
    midy="$(python3 - "$RESULT_DIR/profile.xml" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
for m in re.finditer(r"<node [^>]*>", xml):
    tag = m.group(0)
    if 'resource-id="backup-export-create"' not in tag:
        continue
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    if not b:
        continue
    x1, y1, x2, y2 = map(int, b.groups())
    print((y1 + y2) // 2)
    break
PY
)"
    if [[ -n "$midy" && "$midy" -ge 500 && "$midy" -le 2100 ]]; then
      echo "EXPORT_CREATE_VISIBLE midy=$midy"
      return 0
    fi
    if [[ -n "$midy" && "$midy" -gt 2100 ]]; then
      # Create is below the fold — nudge upward.
      adb shell input swipe 540 1900 540 1100 280
    elif texts_of "$RESULT_DIR/profile.xml" | grep -Fq "Obnovit z přenosné zálohy"; then
      # Overshot into import — scroll back up toward export.
      adb shell input swipe 540 700 540 1900 300
    else
      adb shell input swipe 540 1900 540 700 300
    fi
    sleep 1
  done
  echo "FAIL could not find portable backup export controls in viewport" >&2
  texts_of "$RESULT_DIR/profile.xml" | head -60 >&2
  exit 2
}

scroll_profile_to_import() {
  local attempt midy
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    dump_ui /sdcard/lumi-pb.xml "$RESULT_DIR/profile-import.xml" || true
    midy="$(python3 - "$RESULT_DIR/profile-import.xml" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
for rid in ("backup-import-stage", "backup-import-load-sidecar"):
    for m in re.finditer(r"<node [^>]*>", xml):
        tag = m.group(0)
        if f'resource-id="{rid}"' not in tag:
            continue
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        print(f"{rid}:{(y1 + y2) // 2}")
        raise SystemExit
PY
)"
    local rid="${midy%%:*}"
    local y="${midy##*:}"
    if [[ "$rid" == "backup-import-stage" && -n "$y" && "$y" -ge 500 && "$y" -le 2100 ]]; then
      echo "IMPORT_STAGE_VISIBLE midy=$y"
      return 0
    fi
    if [[ "$rid" == "backup-import-load-sidecar" && -n "$y" && "$y" -ge 400 && "$y" -le 2000 ]]; then
      # Load control visible; stage may appear after file selection — good enough to start.
      if grep -q 'resource-id="backup-import-stage"' "$RESULT_DIR/profile-import.xml" 2>/dev/null; then
        adb shell input swipe 540 1900 540 1400 250
        sleep 1
        continue
      fi
      echo "IMPORT_LOAD_VISIBLE midy=$y"
      return 0
    fi
    if [[ -n "$y" && "$y" -gt 2100 ]]; then
      adb shell input swipe 540 1900 540 1100 280
    elif texts_of "$RESULT_DIR/profile-import.xml" | grep -Fq "CSV pro čtení"; then
      adb shell input swipe 540 700 540 1900 300
    else
      adb shell input swipe 540 1900 540 700 300
    fi
    sleep 1
  done
  echo "FAIL could not find portable backup import controls in viewport" >&2
  texts_of "$RESULT_DIR/profile-import.xml" | head -60 >&2
  exit 2
}

ensure_import_stage_visible() {
  local attempt midy
  for attempt in 1 2 3 4 5 6; do
    dump_ui /sdcard/lumi-pb-stage.xml "$RESULT_DIR/import-stage.xml" || true
    midy="$(python3 - "$RESULT_DIR/import-stage.xml" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
for m in re.finditer(r"<node [^>]*>", xml):
    tag = m.group(0)
    if 'resource-id="backup-import-stage"' not in tag:
        continue
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    if not b:
        continue
    x1, y1, x2, y2 = map(int, b.groups())
    print((y1 + y2) // 2)
    break
PY
)"
    if [[ -n "$midy" && "$midy" -ge 500 && "$midy" -le 2100 ]]; then
      echo "IMPORT_STAGE_VISIBLE midy=$midy"
      return 0
    fi
    adb shell input swipe 540 1900 540 1200 250
    sleep 1
  done
  echo "FAIL Zkontrolovat soubor not in viewport" >&2
  texts_of "$RESULT_DIR/import-stage.xml" | head -40 >&2
  exit 2
}

open_profile() {
  dump_ui /sdcard/lumi-pb.xml "$RESULT_DIR/today.xml"
  if grep -q 'resource-id="welcome-skip"' "$RESULT_DIR/today.xml"; then
    tap_id "$RESULT_DIR/today.xml" welcome-skip || tap_text "$RESULT_DIR/today.xml" "Přeskočit úvod"
    sleep 3
    dump_ui /sdcard/lumi-pb.xml "$RESULT_DIR/today.xml"
  fi
  tap_desc "$RESULT_DIR/today.xml" "Otevřít profil a nastavení" \
    || tap_text "$RESULT_DIR/today.xml" "Profil" \
    || true
  sleep 3
}

# --- Welcome + wet diaper marker ---
dump_ui /sdcard/lumi-pb0.xml "$RESULT_DIR/0-welcome.xml"
assert_text "$RESULT_DIR/0-welcome.xml" "Přeskočit úvod"
tap_id "$RESULT_DIR/0-welcome.xml" welcome-skip || tap_text "$RESULT_DIR/0-welcome.xml" "Přeskočit úvod"
sleep 3

dump_ui /sdcard/lumi-pb1.xml "$RESULT_DIR/1-today.xml"
tap_id "$RESULT_DIR/1-today.xml" quick-diaper || tap_text "$RESULT_DIR/1-today.xml" "Plenka"
sleep 3
dump_ui /sdcard/lumi-pb2.xml "$RESULT_DIR/2-diaper.xml"
tap_id "$RESULT_DIR/2-diaper.xml" direct-wet || tap_text "$RESULT_DIR/2-diaper.xml" "Zapsat mokrou"
sleep 3
dump_ui /sdcard/lumi-pb3.xml "$RESULT_DIR/3-diaper-saved.xml"
assert_text "$RESULT_DIR/3-diaper-saved.xml" "Přebalení uloženo."
# Dismiss care sheet without leaving the app.
for _ in 1 2 3; do
  dump_ui /sdcard/lumi-pb-close.xml "$RESULT_DIR/close.xml" || true
  if ! grep -q 'text="×"' "$RESULT_DIR/close.xml" 2>/dev/null; then
    break
  fi
  tap_text "$RESULT_DIR/close.xml" "×" || true
  sleep 2
done

# --- Export sealed portable backup + write adb-visible sidecar ---
open_profile
scroll_profile_to_backup
dump_ui /sdcard/lumi-pb4.xml "$RESULT_DIR/4-export.xml"
tap_id "$RESULT_DIR/4-export.xml" backup-export-password \
  || tap_desc "$RESULT_DIR/4-export.xml" "Heslo obnovy" \
  || tap_text "$RESULT_DIR/4-export.xml" "Heslo obnovy"
sleep 1
type_password
sleep 1
dump_ui /sdcard/lumi-pb4b.xml "$RESULT_DIR/4b-export.xml"
tap_id "$RESULT_DIR/4b-export.xml" backup-export-password-confirm \
  || tap_desc "$RESULT_DIR/4b-export.xml" "Potvrzení hesla" \
  || tap_text "$RESULT_DIR/4b-export.xml" "Potvrzení hesla"
sleep 1
type_password
sleep 1
dump_ui /sdcard/lumi-pb4c.xml "$RESULT_DIR/4c-export.xml"
password_bullet_counts "$RESULT_DIR/4c-export.xml" | tee "$RESULT_DIR/export-password-bullets.txt"
# Hide IME by tapping the section title, not BACK.
tap_text "$RESULT_DIR/4c-export.xml" "Přenosná záloha" || true
sleep 1
dump_ui /sdcard/lumi-pb4d.xml "$RESULT_DIR/4d-export.xml"
tap_id "$RESULT_DIR/4d-export.xml" backup-export-create \
  || tap_text "$RESULT_DIR/4d-export.xml" "Vytvořit a uložit přenosnou zálohu"

# Do not send BACK while Argon2 runs — it closes the profile sheet and aborts work.
# Sidecar is written under filesDir before the share sheet returns; poll with adb root.
echo "Waiting for sealed sidecar (Argon2 on emulator can take several minutes)..."
ensure_adb_root
sidecar_ready=0
for attempt in $(seq 1 90); do
  if adb shell "test -f '$SIDECAR_REMOTE'" >/dev/null 2>&1; then
    echo "SIDECAR_READY attempt=$attempt"
    sidecar_ready=1
    break
  fi
  sleep 5
done
if [[ "$sidecar_ready" != "1" ]]; then
  echo "FAIL sidecar not created under $SIDECAR_REMOTE" >&2
  adb shell ls -la "/data/data/${PACKAGE}/files/" 2>&1 | tee "$RESULT_DIR/ls-files.txt" || true
  dump_ui /sdcard/lumi-pb-export-wait.xml "$RESULT_DIR/export-wait.xml" || true
  texts_of "$RESULT_DIR/export-wait.xml" | head -60 >&2
  exit 2
fi

pull_sidecar || exit 2
python3 - "$RESULT_DIR/lumi-last-portable-backup.json" <<'PY'
import json, sys
path = sys.argv[1]
raw = open(path, encoding="utf-8").read()
assert len(raw) > 32, "sidecar too small"
json.loads(raw)
print(f"SIDECAR_BYTES={len(raw.encode('utf-8'))}")
PY

# Dismiss share and wait until export leaves the busy/loading state. While busy,
# the sidecar reload button ignores presses.
export_idle=0
for attempt in $(seq 1 30); do
  adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
  sleep 1
  adb shell am start -W -n "${PACKAGE}/.MainActivity" >/dev/null 2>&1 || true
  sleep 2
  dump_ui /sdcard/lumi-pb-export-idle.xml "$RESULT_DIR/export-idle.xml" || true
  if texts_of "$RESULT_DIR/export-idle.xml" | grep -Eqi 'Nouzová textová kopie|složce aplikace|Systémové sdílení|Poslední export v aplikaci'; then
    # Prefer idle when the create button is enabled again (not loading).
    if python3 - "$RESULT_DIR/export-idle.xml" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
for m in re.finditer(r"<node [^>]*>", xml):
    tag = m.group(0)
    if 'resource-id="backup-export-create"' not in tag:
        continue
    disabled = 'enabled="false"' in tag
    raise SystemExit(1 if disabled else 0)
raise SystemExit(0)
PY
    then
      echo "EXPORT_IDLE attempt=$attempt"
      export_idle=1
      break
    fi
  fi
done
if [[ "$export_idle" != "1" ]]; then
  echo "WARN export UI never fully idled; continuing with sidecar file proof only" >&2
fi

# Same-install proof: reload sidecar once the panel is interactive again.
dump_ui /sdcard/lumi-pb-same0.xml "$RESULT_DIR/same-install-nav.xml" || true
if ! grep -q 'resource-id="backup-import-load-sidecar"' "$RESULT_DIR/same-install-nav.xml" 2>/dev/null \
  && ! texts_of "$RESULT_DIR/same-install-nav.xml" | grep -Fq "Načíst poslední export ze složky aplikace"; then
  open_profile
fi
scroll_profile_to_import
dump_ui /sdcard/lumi-pb-same.xml "$RESULT_DIR/same-install-import.xml"
tap_id "$RESULT_DIR/same-install-import.xml" backup-import-load-sidecar \
  || tap_text "$RESULT_DIR/same-install-import.xml" "Načíst poslední export ze složky aplikace"
sleep 4
dump_ui /sdcard/lumi-pb-same2.xml "$RESULT_DIR/same-install-loaded.xml"
# Success copy may sit above the fold and be omitted as "invisible"; the selected
# file label is next to the import controls and stays in the dump.
if texts_of "$RESULT_DIR/same-install-loaded.xml" | grep -Fq "Vybraný soubor: lumi-last-portable-backup.json" \
  || texts_of "$RESULT_DIR/same-install-loaded.xml" | grep -Fq "Načten poslední export ze složky aplikace"; then
  echo PASS_SAME_INSTALL_SIDECAR=1
else
  # Hard gate is clean-install restore below; same-install UI can miss invisible status text.
  echo "WARN_SAME_INSTALL_SIDECAR_UI=0"
  texts_of "$RESULT_DIR/same-install-loaded.xml" | head -40 | tee "$RESULT_DIR/same-install-warn.txt" >/dev/null
fi

# --- Clean install ---
adb uninstall "$PACKAGE"
sleep 2
adb install -r -t "$APK"
adb shell am start -W -n "${PACKAGE}/.MainActivity" >/dev/null
sleep 16
adb shell input tap 850 1180 >/dev/null 2>&1 || true

# Push the UI-exported sealed envelope into the fresh app filesDir (emulator root).
push_sidecar "$RESULT_DIR/lumi-last-portable-backup.json"

dump_ui /sdcard/lumi-pb5.xml "$RESULT_DIR/5-welcome.xml"
assert_text "$RESULT_DIR/5-welcome.xml" "Přeskočit úvod"
tap_id "$RESULT_DIR/5-welcome.xml" welcome-skip || tap_text "$RESULT_DIR/5-welcome.xml" "Přeskočit úvod"
sleep 3

open_profile
scroll_profile_to_import
dump_ui /sdcard/lumi-pb6.xml "$RESULT_DIR/6-import.xml"
tap_id "$RESULT_DIR/6-import.xml" backup-import-load-sidecar \
  || tap_text "$RESULT_DIR/6-import.xml" "Načíst poslední export ze složky aplikace"
sleep 3

# Correct password → stage → activate.
# Wrong-password rejection stays covered by storage unit tests; avoid IME residue here.
ensure_import_stage_visible
dump_ui /sdcard/lumi-pb8a.xml "$RESULT_DIR/8a-right-pw.xml"
tap_id "$RESULT_DIR/8a-right-pw.xml" backup-import-password \
  || tap_desc "$RESULT_DIR/8a-right-pw.xml" "Heslo obnovy" \
  || tap_text "$RESULT_DIR/8a-right-pw.xml" "Heslo obnovy"
sleep 1
type_password
sleep 1
tap_text "$RESULT_DIR/8a-right-pw.xml" "Obnovit z přenosné zálohy" || true
sleep 1
ensure_import_stage_visible
dump_ui /sdcard/lumi-pb8.xml "$RESULT_DIR/8-right-pw.xml"
tap_id "$RESULT_DIR/8-right-pw.xml" backup-import-stage \
  || tap_text "$RESULT_DIR/8-right-pw.xml" "Zkontrolovat soubor"
sleep 50
dump_ui /sdcard/lumi-pb8b.xml "$RESULT_DIR/8b-staged.xml"
# Activation control may sit below the fold after staging.
for _ in 1 2 3 4; do
  if texts_of "$RESULT_DIR/8b-staged.xml" | grep -Fq "Potvrdit nahrazení deníku"; then
    break
  fi
  adb shell input swipe 540 1900 540 1100 280
  sleep 1
  dump_ui /sdcard/lumi-pb8b.xml "$RESULT_DIR/8b-staged.xml" || true
done
assert_text "$RESULT_DIR/8b-staged.xml" "Potvrdit nahrazení deníku"
# Keep confirm in the upper-middle band — taps near ~1700+ are flaky on this AVD.
for _ in 1 2 3 4 5 6; do
  midy="$(python3 - "$RESULT_DIR/8b-staged.xml" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
for m in re.finditer(r"<node [^>]*>", xml):
    tag = m.group(0)
    if 'resource-id="backup-import-activate"' not in tag:
        continue
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    if not b:
        continue
    print((int(b.group(2)) + int(b.group(4))) // 2)
    break
PY
)"
  echo "ACTIVATE_MIDY=$midy"
  if [[ -n "$midy" && "$midy" -ge 700 && "$midy" -le 1400 ]]; then
    break
  fi
  if [[ -n "$midy" && "$midy" -gt 1400 ]]; then
    adb shell input swipe 540 1600 540 700 350
  else
    adb shell input swipe 540 900 540 1600 350
  fi
  sleep 1
  dump_ui /sdcard/lumi-pb8b.xml "$RESULT_DIR/8b-staged.xml" || true
done
# Prefer a short swipe-tap; plain taps near the modal edge sometimes miss Pressable.
python3 - "$RESULT_DIR/8b-staged.xml" <<'PY'
import re, sys, subprocess
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
for m in re.finditer(r"<node [^>]*>", xml):
    tag = m.group(0)
    if 'resource-id="backup-import-activate"' not in tag:
        continue
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    if not b:
        continue
    x1, y1, x2, y2 = map(int, b.groups())
    x, y = (x1 + x2) // 2, (y1 + y2) // 2
    print(f"ACTIVATE_SWIPE_TAP {x},{y}")
    subprocess.check_call(["adb", "shell", "input", "swipe", str(x), str(y), str(x), str(y), "120"])
    raise SystemExit(0)
print("MISSING activate for swipe-tap", file=sys.stderr)
raise SystemExit(1)
PY
 || tap_id "$RESULT_DIR/8b-staged.xml" backup-import-activate \
 || tap_text "$RESULT_DIR/8b-staged.xml" "Potvrdit nahrazení deníku"

# Wait until replace finishes; keep the profile sheet open until success copy appears.
activated=0
for attempt in $(seq 1 40); do
  sleep 3
  dump_ui /sdcard/lumi-pb-act.xml "$RESULT_DIR/activate-wait.xml" || true
  if texts_of "$RESULT_DIR/activate-wait.xml" | grep -Eqi 'Deník nahrazen|záznamů\)\. Můžete vrátit'; then
    echo "ACTIVATE_DONE attempt=$attempt"
    activated=1
    break
  fi
  # If the confirm control is still enabled, retry the tap once mid-wait.
  if [[ "$attempt" -eq 8 ]] && grep -q 'resource-id="backup-import-activate"' "$RESULT_DIR/activate-wait.xml"; then
    tap_id "$RESULT_DIR/activate-wait.xml" backup-import-activate \
      || tap_text "$RESULT_DIR/activate-wait.xml" "Potvrdit nahrazení deníku" || true
  fi
done
if [[ "$activated" != "1" ]]; then
  echo "FAIL activate did not finish" >&2
  texts_of "$RESULT_DIR/activate-wait.xml" | head -60 >&2
  exit 2
fi

# Profile is a stack modal — one BACK returns to MainTabs (Zavřít is often below the fold).
adb shell input keyevent KEYCODE_BACK
sleep 2
dump_ui /sdcard/lumi-pb9.xml "$RESULT_DIR/9-nav.xml" || true
if ! texts_of "$RESULT_DIR/9-nav.xml" | grep -Fq "Historie"; then
  adb shell input keyevent KEYCODE_BACK
  sleep 2
  adb shell am start -W -n "${PACKAGE}/.MainActivity" >/dev/null 2>&1 || true
  sleep 2
  dump_ui /sdcard/lumi-pb9.xml "$RESULT_DIR/9-nav.xml" || true
fi
if grep -q 'resource-id="welcome-skip"' "$RESULT_DIR/9-nav.xml"; then
  tap_id "$RESULT_DIR/9-nav.xml" welcome-skip || true
  sleep 3
  dump_ui /sdcard/lumi-pb9.xml "$RESULT_DIR/9-nav.xml"
fi
tap_text "$RESULT_DIR/9-nav.xml" "Historie"
sleep 3
dump_ui /sdcard/lumi-pb10.xml "$RESULT_DIR/10-history.xml"
adb shell input swipe 540 1700 540 600 350
sleep 1
dump_ui /sdcard/lumi-pb10b.xml "$RESULT_DIR/10b-history.xml"
{
  texts_of "$RESULT_DIR/10-history.xml"
  echo '---'
  texts_of "$RESULT_DIR/10b-history.xml"
} | tee "$RESULT_DIR/history-texts.txt"
if ! grep -Fi "Mokrá" "$RESULT_DIR/history-texts.txt" >/dev/null; then
  echo "FAIL_HISTORY missing Mokrá after restore" >&2
  exit 2
fi
echo PASS_HISTORY_RESTORED=1

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

adb shell settings put global airplane_mode_on 0 >/dev/null
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false >/dev/null 2>&1 || true

echo PORTABLE_BACKUP_ROUNDTRIP=PASS
exit 0
