#!/usr/bin/env python3
"""Off-device golden raster tests of procedural scenes; not mobile screenshots.

Canonical baselines require deliberate 'approve'; CI runs 'verify' only.
"""
from __future__ import annotations
import argparse
import io
import json
import sys
from pathlib import Path

import cairosvg
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / "exports/procedural"
BASELINES = ROOT / "tests/procedural-visual/baselines"
ACTUAL = ROOT / "tests/procedural-visual/actual"


def render(svg_path: Path) -> Image.Image:
    src = svg_path.read_bytes()
    # Rasterize to 50% to keep golden artifacts compact but preserve geometry.
    import xml.etree.ElementTree as ET
    root = ET.fromstring(src)
    width = max(1, round(float(root.attrib["width"]) * .5))
    height = max(1, round(float(root.attrib["height"]) * .5))
    png = cairosvg.svg2png(bytestring=src, output_width=width, output_height=height)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def compare(actual: Image.Image, expected: Image.Image) -> tuple[bool, float]:
    if actual.size != expected.size:
        return False, 100.0
    diff = ImageChops.difference(actual, expected)
    pixels = diff.get_flattened_data()
    changed = sum(1 for p in pixels if max(p) > 8) / (actual.width * actual.height) * 100
    mean = sum(ImageStat.Stat(diff).mean) / 4
    return changed <= .40 and mean <= 1.0, changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('verify', 'approve'))
    args = parser.parse_args()
    BASELINES.mkdir(parents=True, exist_ok=True)
    ACTUAL.mkdir(parents=True, exist_ok=True)
    fixture_names = {'smallPhone', 'referencePhone', 'largePhone', 'portraitTablet', 'landscapeTablet', 'narrowLandscape'}
    files = sorted(p for p in EXPORTS.glob('*.svg') if p.stem.rsplit('__', 1)[-1] in fixture_names)
    if len(files) != 30:
        print(f"Expected 30 SVG fixtures; got {len(files)}", file=sys.stderr)
        return 1
    results = []
    for src in files:
        target = src.stem + '.png'
        current = render(src)
        current.save(ACTUAL / target, optimize=True)
        baseline = BASELINES / target
        if args.action == 'approve':
            current.save(baseline, optimize=True)
            success, changed = True, 0.0
        elif not baseline.exists():
            success, changed = False, 100.0
        else:
            with Image.open(baseline) as existing:
                success, changed = compare(current, existing.convert('RGBA'))
        results.append({'name': target, 'passed': success, 'changed_percent': round(changed, 3)})
        if not success:
            print(f"FAIL {target}: changed {changed:.3f}%", file=sys.stderr)
    count = sum(r['passed'] for r in results)
    (ACTUAL / 'report.json').write_text(json.dumps({'action': args.action, 'passed': count,
        'total': len(results), 'results': results}, indent=2), encoding='utf-8')
    print(f'Procedural snapshots: {count}/{len(results)} verified')
    return 0 if count == len(results) else 1


if __name__ == '__main__':
    sys.exit(main())
