#!/usr/bin/env python3
"""Offline SVG storyboard regression; NOT a native animation frame test."""
import json
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
manifest = json.loads((source / 'manifest.json').read_text())
samples = manifest.get('samples', [])
if manifest.get('version') != 1 or not isinstance(samples, list) or not samples:
    raise SystemExit('Invalid motion sample manifest; run npm run export:motion')
if any(not isinstance(name, str) or Path(name).name != name or not name.endswith('.svg') for name in samples):
    raise SystemExit('Unsafe motion sample name')
if len(samples) != len(set(samples)) or {file.name for file in files} != set(samples):
    raise SystemExit(f'Expected exactly the {len(samples)} SVG samples from the export manifest, got {len(files)}')
if mode == 'verify':
    expected_baselines = {f'{Path(name).stem}.png' for name in samples}
    actual_baselines = {file.name for file in baseline.glob('*.png')}
    if expected_baselines != actual_baselines:
        raise SystemExit(f'Motion baseline set differs: missing={sorted(expected_baselines - actual_baselines)}, obsolete={sorted(actual_baselines - expected_baselines)}')
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
