#!/usr/bin/env python3
"""Offline scenery regression from the same IR as native; no device FPS claim."""
import argparse
import io
from pathlib import Path

import cairosvg
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=('verify', 'approve'))
    mode = parser.parse_args().mode
    actual = ROOT / 'tests/motifs-visual/actual'
    baseline = ROOT / 'tests/motifs-visual/baselines'
    actual.mkdir(parents=True, exist_ok=True)
    if mode == 'approve':
        baseline.mkdir(parents=True, exist_ok=True)
    failures = []
    count = 0
    for motif in ('forest', 'garden', 'playground'):
        for appearance in ('light', 'dark'):
            for variant in ('day', 'dusk'):
                name = f'{motif}__{appearance}__{variant}'
                source = ROOT / f'exports/motifs/{name}.svg'
                image = Image.open(io.BytesIO(cairosvg.svg2png(url=str(source), output_width=400, output_height=200))).convert('RGB')
                image.save(actual / f'{name}.png')
                target = baseline / f'{name}.png'
                if mode == 'approve':
                    image.save(target)
                elif not target.exists():
                    failures.append(f'{name}: missing baseline')
                else:
                    previous = Image.open(target).convert('RGB')
                    if previous.size != image.size:
                        failures.append(f'{name}: size changed')
                    else:
                        diff = ImageChops.difference(image, previous)
                        changed = sum(max(pixel) > 8 for pixel in diff.get_flattened_data()) / (400 * 200)
                        if changed > 0.004 or sum(ImageStat.Stat(diff).mean) / 3 > 1:
                            failures.append(f'{name}: {changed:.2%} changed')
                count += 1
    print(f'{mode}: {count - len(failures)}/{count} motif snapshots')
    for failure in failures:
        print('FAIL', failure)
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
