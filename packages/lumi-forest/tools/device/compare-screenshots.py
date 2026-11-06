#!/usr/bin/env python3
"""Physical-device visual regression. Requires real screenshots from Maestro.

Approve is explicit and scoped per platform/device profile. Fail closed if
screenshots or device-specific references are missing.
"""
import argparse
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[2]
SCENES = ('home', 'growth', 'sleep', 'feeding', 'milestones')
BASE = ROOT / 'tests' / 'native' / 'baselines'


def compare(a: Image.Image, b: Image.Image) -> tuple[bool, float]:
    if a.size != b.size:
        return False, 100.0
    diff = ImageChops.difference(a.convert('RGB'), b.convert('RGB'))
    pixels = diff.get_flattened_data()
    changed = sum(1 for r, g, bl in pixels if max(r, g, bl) > 24) / (a.width * a.height) * 100
    return changed <= 1.0 and max(ImageStat.Stat(diff).mean) < 2.0, changed


def main() -> int:
    parser = argparse.ArgumentParser(description='Compare device screenshots against explicitly approved captures')
    parser.add_argument('--platform', required=True, choices=['android', 'ios'])
    parser.add_argument('--profile', required=True, help='e.g. pixel7-1080x2400-3x')
    parser.add_argument('--capture-dir', default=str(ROOT / '.maestro' / 'captures'))
    parser.add_argument('--approve', action='store_true', help='Replace baselines; review diffs before committing')
    args = parser.parse_args()
    if not all(c.isalnum() or c in '-_' for c in args.profile):
        parser.error('profile may only contain alphanumerics, hyphens and underscores')
    capture_dir = Path(args.capture_dir)
    baseline_dir = BASE / args.platform / args.profile
    if args.approve:
        baseline_dir.mkdir(parents=True, exist_ok=True)
    failed = []
    for scene in SCENES:
        source = capture_dir / f'{scene}.png'
        ref = baseline_dir / f'{scene}.png'
        if not source.is_file():
            print('MISSING CAPTURE', source)
            failed.append(scene)
            continue
        if args.approve:
            with Image.open(source) as picture:
                picture.save(ref)
            print('APPROVED', ref)
            continue
        if not ref.is_file():
            print('MISSING BASELINE', ref)
            failed.append(scene)
            continue
        with Image.open(source) as image, Image.open(ref) as baseline:
            passed, changed = compare(image, baseline)
        print(f'{scene}: {"PASS" if passed else "FAIL"} ({changed:.3f}% changed pixels)')
        if not passed:
            failed.append(scene)
    print(f'Device screenshots: {len(SCENES) - len(failed)}/{len(SCENES)} PASS')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
