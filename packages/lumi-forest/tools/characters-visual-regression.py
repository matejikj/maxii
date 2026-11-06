#!/usr/bin/env python3
"""Offline pixel snapshots for 5 species × 2 poses × 4 expressions.

Pinned CairoSVG and Pillow are used for deterministic rasterization. These are
NOT native screenshots; Expo/Android rendering still needs device tests.
"""
import argparse
import io
import json
from pathlib import Path
import sys

import cairosvg
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / 'exports/characters'
BASELINES = ROOT / 'tests/characters-visual/baselines'
ACTUAL = ROOT / 'tests/characters-visual/actual'
ANIMALS = ('rabbit', 'bear', 'fox', 'otter', 'hedgehog')
POSES = ('sitting', 'standing')
EXPRESSIONS = ('neutral', 'happy', 'curious', 'sleepy')
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


def render_grid() -> None:
    from PIL import ImageDraw, ImageFont
    margin, cell_w, cell_h = 22, 198, 244
    canvas = Image.new('RGB', (margin * 2 + 8 * cell_w, 78 + 5 * cell_h), '#FAF7F1')
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
        small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
        title = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    except OSError:
        font = small = title = ImageFont.load_default()
    draw.text((margin, 22), 'LUMI FOREST | CHARACTER ENGINE v0.3', fill='#384C4A', font=title)
    for row, animal in enumerate(ANIMALS):
        for col, (pose, expression) in enumerate((p, e) for p in POSES for e in EXPRESSIONS):
            x, y = margin + col * cell_w, 75 + row * cell_h
            draw.rounded_rectangle([x + 2, y + 2, x + cell_w - 5, y + cell_h - 9],
                                   radius=18, fill='#FFFFFF', outline='#E8E9E2', width=1)
            filename = f'{animal}__{pose}__{expression}.svg'
            img = rasterize(EXPORTS / filename)
            canvas.paste(img, (x + 3, y + 8))
            draw.text((x + 12, y + 203), animal.capitalize(), font=font, fill='#384C4A')
            draw.text((x + 12, y + 222), f'{pose} / {expression}', font=small, fill='#82958A')
    target = ROOT / 'previews/lumi-v0.3-character-matrix.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, optimize=True)
    print('Preview:', target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=('verify', 'approve'))
    args = parser.parse_args()
    ACTUAL.mkdir(parents=True, exist_ok=True)
    if args.mode == 'approve':
        BASELINES.mkdir(parents=True, exist_ok=True)
    failures = []
    count = 0
    for animal in ANIMALS:
        for pose in POSES:
            for expression in EXPRESSIONS:
                name = f'{animal}__{pose}__{expression}.png'
                image = rasterize(EXPORTS / name.replace('.png', '.svg'))
                image.save(ACTUAL / name, optimize=True)
                count += 1
                if args.mode == 'approve':
                    image.save(BASELINES / name, optimize=True)
                else:
                    reference = BASELINES / name
                    if not reference.exists():
                        failures.append((name, 'missing'))
                    else:
                        with Image.open(reference) as img:
                            passed, changed = compare(image, img.convert('RGB'))
                        if not passed:
                            failures.append((name, f'{changed:.3f}% changed'))
    render_grid()
    (ACTUAL / 'report.json').write_text(json.dumps({
        'mode': args.mode, 'passed': count - len(failures), 'total': count, 'failures': failures,
    }, indent=2), encoding='utf-8')
    print(f'{args.mode}: {count - len(failures)}/{count} character pixel snapshots')
    for name, failure in failures:
        print(f'FAIL {name}: {failure}', file=sys.stderr)
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
