#!/usr/bin/env python3
"""Parse Android dumpsys gfxinfo framestats: native frame timing, not JS FPS."""
import argparse
import csv
import io
import json
from pathlib import Path


def parse(raw: str, refresh: float) -> dict:
    sections = raw.split('---PROFILEDATA---')
    if len(sections) < 3:
        raise ValueError('No PROFILEDATA framestats: verify Android debug permissions and app activity')
    content = sections[1].strip()
    rows = list(csv.DictReader(io.StringIO(content)))
    intervals = []
    for row in rows:
        try:
            if int(row['Flags']) != 0:
                continue
            started = int(row['IntendedVsync'])
            finished = int(row['FrameCompleted'])
            if started <= 0 or finished <= started:
                continue
            delta = (finished - started) / 1_000_000
            if delta < 1000:
                intervals.append(delta)
        except (TypeError, ValueError, KeyError):
            continue
    if not intervals:
        raise ValueError('No usable native frame samples')
    intervals.sort()
    p95 = intervals[int((len(intervals) - 1) * 0.95)]
    budget = 1000 / refresh
    return {
        'measurement': 'android-gfxinfo-frame-completion-latency',
        'samples': len(intervals),
        'refreshHzAssumed': refresh,
        'frameBudgetMs': round(budget, 3),
        'p50Ms': round(intervals[int((len(intervals) - 1) * 0.50)], 3),
        'p95Ms': round(p95, 3),
        'framesExceedingRefreshBudgetPercent': round(100 * sum(t > budget for t in intervals) / len(intervals), 2),
        'disclaimer': 'FrameCompleted - IntendedVsync; approximate latency, not GPU trace nor exact missed-vsync accounting',
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('framestats', type=Path)
    parser.add_argument('--hz', type=float, default=60)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.hz <= 0:
        parser.error('--hz must be positive')
    result = parse(args.framestats.read_text(errors='replace'), args.hz)
    print(json.dumps(result, indent=2))
    if args.output:
        args.output.write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
