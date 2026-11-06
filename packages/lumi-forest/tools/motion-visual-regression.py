#!/usr/bin/env python3
"""Offline SVG storyboard regression; NOT a native animation frame test."""
import sys
from pathlib import Path
from io import BytesIO
import cairosvg
from PIL import Image, ImageChops
root = Path(__file__).resolve().parents[1]
source = root / 'previews/motion-frames'
baseline = root / 'tests/motion-visual/baselines'
baseline.mkdir(parents=True, exist_ok=True)
mode = sys.argv[1] if len(sys.argv) > 1 else 'verify'
if mode not in ('verify','approve'):
    raise SystemExit('Usage: motion-visual-regression.py verify|approve')
files = sorted(source.glob('*.svg'))
if len(files) != 20: raise SystemExit(f'Expected exactly 20 SVG samples, got {len(files)}')
for file in files:
    png = cairosvg.svg2png(url=str(file), output_width=240, output_height=250)
    name = baseline / f'{file.stem}.png'
    if mode == 'approve':
        name.write_bytes(png)
        continue
    if not name.exists(): raise SystemExit(f'Missing baseline: {name}')
    actual = Image.open(BytesIO(png)).convert('RGBA')
    previous = Image.open(name).convert('RGBA')
    if previous.size != actual.size or ImageChops.difference(previous, actual).getbbox() is not None:
        raise SystemExit(f'Failed offline still frame regression: {file.name}')
print(f'{mode}: {len(files)}/{len(files)} offline character motion stills')
