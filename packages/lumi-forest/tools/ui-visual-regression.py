#!/usr/bin/env python3
"""Review-gated device screenshot comparator (same device profile, mode and font scale)."""
import argparse
from pathlib import Path
from PIL import Image, ImageChops

p = argparse.ArgumentParser()
p.add_argument('command', choices=['verify', 'approve'])
p.add_argument('--actual', type=Path, default=Path('tests/ui-native/actual'))
p.add_argument('--baseline', type=Path, default=Path('tests/ui-native/baselines'))
p.add_argument('--threshold', type=int, default=12, help='maximum per-channel antialiasing tolerance')
p.add_argument('--max-ratio', type=float, default=0.002, help='max fraction of significantly different pixels')
a = p.parse_args()
imgs = sorted(a.actual.rglob('*.png'))
if not imgs:
    raise SystemExit('No captured native screenshots. Run the Maestro test on a fixed device profile first.')
if a.command == 'approve':
    for current in imgs:
        target = a.baseline / current.relative_to(a.actual)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(current.read_bytes())
        print('Approved', target)
    raise SystemExit(0)
failed = []
for current in imgs:
    target = a.baseline / current.relative_to(a.actual)
    if not target.exists():
        failed.append(f'Missing baseline: {target}')
        continue
    with Image.open(current) as actual, Image.open(target) as expected:
        actual, expected = actual.convert('RGB'), expected.convert('RGB')
        if actual.size != expected.size:
            failed.append(f'Wrong size {current}: {actual.size} vs {expected.size}')
            continue
        difference = ImageChops.difference(actual, expected).convert('RGB')
        count = sum(1 for p in difference.getdata() if max(p) > a.threshold)
        ratio = count / (actual.width * actual.height)
        print(f'{current.name}: {ratio:.3%} changed pixels')
        if ratio > a.max_ratio:
            failed.append(f'{current.name}: {ratio:.3%} > {a.max_ratio:.3%}')
if failed:
    raise SystemExit('\n'.join(failed))
print(f'PASS: {len(imgs)} actual screenshot(s) matched reviewed baselines')
