#!/usr/bin/env python3
"""Pixel snapshots of scene IR, rasterized by pinned CairoSVG + Pillow.

These are deterministic OFF-DEVICE snapshots, not screenshots of native React
Native rendering. `verify` never modifies references; `approve` is explicit.
"""
import argparse
import io
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import cairosvg
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / 'exports'
BASELINES = ROOT / 'tests' / 'visual' / 'baselines'
OUTPUT = ROOT / 'tests' / 'visual' / 'actual'
SCENES = ('home', 'growth', 'sleep', 'feeding', 'milestones')
VIEWPORTS = {
    'small-phone': (320, 568),
    'reference-phone': (390, 844),
    'large-phone': (430, 932),
    'portrait-tablet': (768, 1024),
    'landscape-tablet': (1024, 768),
    'landscape-phone': (844, 390),
}
SVG = '{http://www.w3.org/2000/svg}'


def rasterize(scene: str, width: int, height: int) -> Image.Image:
    root = ET.fromstring((EXPORTS / f'{scene}.svg').read_text())
    root.set('width', str(width))
    root.set('height', str(height))
    mode = 'meet' if width / height > 0.62 else 'slice'
    root.set('preserveAspectRatio', f'xMidYMax {mode}')
    canvas = root.find(f'{SVG}rect')
    if canvas is None or canvas.attrib.get('fill') is None:
        raise ValueError('Missing base color from scene')
    background = canvas.attrib['fill']
    raw = cairosvg.svg2png(bytestring=ET.tostring(root), output_width=width, output_height=height)
    image = Image.open(io.BytesIO(raw)).convert('RGBA')
    backdrop = Image.new('RGBA', (width, height), background)
    return Image.alpha_composite(backdrop, image).convert('RGB')


def verify(current: Image.Image, baseline: Image.Image) -> tuple[bool, float, float]:
    if current.size != baseline.size:
        return False, 100.0, 255.0
    diff = ImageChops.difference(current, baseline)
    stats = ImageStat.Stat(diff)
    avg = sum(stats.mean) / 3
    # Pixel changed if any channel differs >8; tolerate rasterizer antialias jitter.
    pixels = list(diff.get_flattened_data())
    significant = sum(1 for px in pixels if max(px) > 8) / len(pixels) * 100
    return significant <= 0.40 and avg <= 1.0, significant, avg


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['verify', 'approve'])
    args = parser.parse_args()
    if args.action == 'approve':
        BASELINES.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    results = []
    for scene in SCENES:
        for screen, (w, h) in VIEWPORTS.items():
            name = f'{scene}__{screen}.png'
            current = rasterize(scene, w, h)
            current.save(OUTPUT / name, optimize=True)
            reference = BASELINES / name
            if args.action == 'approve':
                current.save(reference, optimize=True)
                results.append((name, True, 0.0, 0.0))
            elif not reference.exists():
                results.append((name, False, 100.0, 255.0))
                print(f'MISSING: {reference}', file=sys.stderr)
            else:
                with Image.open(reference) as baseline:
                    passed, changed, mean = verify(current, baseline.convert('RGB'))
                results.append((name, passed, changed, mean))
                if not passed:
                    print(f'DIFF: {name}: significant {changed:.3f}%, mean {mean:.3f}', file=sys.stderr)
    passed = sum(int(r[1]) for r in results)
    summary = {'tool': 'offline-scene-visual-regression', 'action': args.action,
               'passed': passed, 'total': len(results), 'failures': [r[0] for r in results if not r[1]]}
    (OUTPUT / 'report.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(f'{args.action}: {passed}/{len(results)} reference visual snapshots')
    return 0 if passed == len(results) else 1


if __name__ == '__main__':
    sys.exit(main())
