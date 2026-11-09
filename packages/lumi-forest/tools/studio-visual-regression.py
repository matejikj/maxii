#!/usr/bin/env python3
"""Offline pixel snapshots for workshop styles and studio action static poses.

CairoSVG/Pillow rasterization — not a native device screenshot. Physical frame
timing still belongs with device evidence.
"""
import argparse
import io
from pathlib import Path

import cairosvg
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / 'exports/studio-characters'
BASELINES = ROOT / 'tests/studio-visual/baselines'
ACTUAL = ROOT / 'tests/studio-visual/actual'
ANIMALS = ('rabbit', 'bear', 'fox', 'otter', 'hedgehog', 'owl', 'squirrel', 'fawn')
STYLES = ('forest', 'workshop', 'restrained')
STUDIO = (
    ('rabbit', 'planPath'),
    ('rabbit', 'tryAlternatePath'),
    ('bear', 'bridgeSpan'),
    ('bear', 'testBridge'),
    ('owl', 'sketchPlan'),
    ('owl', 'compareNotes'),
    ('squirrel', 'arrangePattern'),
    ('squirrel', 'presentCreation'),
)
SIZE = (192, 198)


def rasterize(file: Path) -> Image.Image:
    raw = cairosvg.svg2png(bytestring=file.read_bytes(), output_width=SIZE[0], output_height=SIZE[1])
    original = Image.open(io.BytesIO(raw)).convert('RGBA')
    bg = Image.new('RGBA', SIZE, '#FAF7F1')
    return Image.alpha_composite(bg, original).convert('RGB')


def compare(image: Image.Image, baseline: Image.Image) -> tuple[bool, float]:
    if image.size != baseline.size:
        return False, 100.0
    diff = ImageChops.difference(image, baseline)
    changed = sum(1 for rgb in diff.get_flattened_data() if max(rgb) > 8) / (SIZE[0] * SIZE[1]) * 100
    avg = sum(ImageStat.Stat(diff).mean) / 3
    return changed <= 0.4 and avg <= 1.0, changed


def iter_files():
    for animal in ANIMALS:
        for style in STYLES:
            yield f'{animal}__style-{style}__sitting__happy.svg'
    for species, action in STUDIO:
        yield f'{species}__studio-{action}__workshop.svg'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=('verify', 'approve'))
    args = parser.parse_args()
    ACTUAL.mkdir(parents=True, exist_ok=True)
    if args.mode == 'approve':
        BASELINES.mkdir(parents=True, exist_ok=True)
    failures = []
    count = 0
    for name in iter_files():
        src = EXPORTS / name
        if not src.exists():
            failures.append(f'missing export {name}')
            continue
        img = rasterize(src)
        actual = ACTUAL / name.replace('.svg', '.png')
        img.save(actual)
        baseline = BASELINES / name.replace('.svg', '.png')
        if args.mode == 'approve':
            img.save(baseline)
        elif not baseline.exists():
            failures.append(f'missing baseline {name}')
        else:
            ok, changed = compare(img, Image.open(baseline).convert('RGB'))
            if not ok:
                failures.append(f'{name} changed={changed:.2f}%')
        count += 1
    if failures:
        print('FAIL', len(failures))
        for row in failures:
            print(' ', row)
        raise SystemExit(1)
    print(f'OK studio visual {args.mode}: {count} snapshots')


if __name__ == '__main__':
    main()
