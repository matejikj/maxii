#!/usr/bin/env python3
"""Optional convenience preview; derived from exported vector IR only."""
import io
from pathlib import Path
import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
NAMES = ('rabbit', 'bear', 'fox', 'otter', 'hedgehog', 'owl', 'squirrel', 'fawn')
W, H = 210, 274
out = Image.new('RGB', (W * 5 + 40, H + 76), '#FAF7F1')
draw = ImageDraw.Draw(out)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    title = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except OSError:
    font = title = ImageFont.load_default()
draw.text((24, 19), 'LUMI | accessory combinations', font=title, fill='#384C4A')
for idx, species in enumerate(NAMES):
    x, y = idx * W + 20, 64
    draw.rounded_rectangle((x, y, x + W - 12, y + H - 12), radius=18, fill='white', outline='#ECEAE4')
    svg = (ROOT / 'exports/characters' / f'{species}__accessories.svg').read_bytes()
    png = cairosvg.svg2png(bytestring=svg, output_width=190, output_height=211)
    img = Image.open(io.BytesIO(png)).convert('RGBA')
    out.paste(img, (x + 4, y + 12), img)
    draw.text((x + 17, y + 230), species.capitalize(), font=font, fill='#384C4A')
path = ROOT / 'previews/lumi-v0.3-accessories.png'
out.save(path, optimize=True)
print(path)
