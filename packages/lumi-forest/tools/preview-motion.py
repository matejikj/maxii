#!/usr/bin/env python3
"""Design-only static frames: intentionally NOT React Native animated screenshots."""
from pathlib import Path
from io import BytesIO
import cairosvg
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parents[1]
source = root / 'previews/motion-frames'
labels = ['Idle', 'Blink', 'Ear sway', 'Celebrate']
animals = ['rabbit', 'bear', 'fox', 'otter', 'hedgehog']
W, H, pad = 245, 294, 12
im = Image.new('RGB', (W * 4, H * 5 + 58), '#FAF7F1')
d = ImageDraw.Draw(im)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
except OSError: font = ImageFont.load_default()
for r, animal in enumerate(animals):
  for c, label in enumerate(labels):
    tile=(c * W + 4,r * H + 52)
    d.rounded_rectangle((tile[0]+4,tile[1]+4,tile[0]+W-5,tile[1]+H-5),radius=17,fill='#FFFFFF')
    png = cairosvg.svg2png(url=str(source / f'{animal}-{labels[c].lower().replace(" ", "-")}.svg'),
                            output_width=226,output_height=230)
    item = Image.open(BytesIO(png)).convert('RGBA')
    im.paste(item,(tile[0]+10,tile[1]+8),item)
    d.text((tile[0]+13,tile[1]+248),f'{animal.title()} · {label}',fill='#384C4A',font=font)
d.text((22,18),'LUMI v0.6  •  motion storyboard (offline illustrations, not native frames)',fill='#384C4A',font=font)
dest=root/'previews/lumi-v0.6-motion-storyboard.png';im.save(dest,optimize=True)
print(dest)
