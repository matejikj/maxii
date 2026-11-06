"""Static design-spec visual. NOT a React Native device screenshot."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, math, subprocess

root = Path(__file__).resolve().parents[2]
raw = subprocess.check_output(['node', '-e', "const {resolveLumiTheme}=require('./.test-dist/core/ui'); console.log(JSON.stringify({light:resolveLumiTheme('home','light').colors,dark:resolveLumiTheme('home','dark').colors}))"], cwd=root)
themes = json.loads(raw)
W,H=1330,920
img=Image.new('RGB',(W,H),'#F1F3EF'); d=ImageDraw.Draw(img)
font_path='/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf'
bold_path='/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf'
def ft(sz,b=False): return ImageFont.truetype(bold_path if b else font_path,sz)
def r(x0,y0,x1,y1,c,rad=16,outline=None,width=1):d.rounded_rectangle((x0,y0,x1,y1),radius=rad,fill=c,outline=outline,width=width)
def t(x,y,text,c,size=16,b=False):d.text((x,y),text,font=ft(size,b),fill=c)
def dot(x,y,R,c):d.ellipse((x-R,y-R,x+R,y+R),fill=c)
# layout
r(22,20,1308,899,'#FFFFFF',26)
t(55,38,'LUMI  /  UI DESIGN SYSTEM', '#304E42',25,True)
t(56,77,'v0.5.0  ·  Light / Dark  ·  Semantic tokens  ·  Native components', '#688073',15)
for mode,x in [('light',54),('dark',485)]:
 c=themes[mode];top=118;right=x+398;bottom=859
 r(x,top,right,bottom,c['background'],35,outline='#DDE5DA',width=2)
 # device sensor
 r(x+165,top+11,x+233,top+17,c['border'],4)
 t(x+27,top+35,'LUMI FOREST',c['text'],18,True)
 t(x+27,top+78,'TVŮJ PŘÍBĚH',c['sceneAccent'],12,True)
 t(x+27,top+104,'Ahoj, maličký!',c['text'],28,True)
 t(x+27,top+151,'Každý den nové dobrodružství.',c['textMuted'],13)
 # Card 1
 r(x+22,top+195,right-22,top+352,c['surface'],22,outline=c['border'],width=2)
 t(x+43,top+210,'DNEŠNÍ PŘEHLED',c['sceneAccent'],12,True)
 t(x+41,top+237,'6',c['text'],48,True)
 t(x+90,top+266,'měsíců',c['textMuted'],15)
 d.line((x+43,top+305,right-44,top+305),fill=c['border'],width=1)
 t(x+43,top+318,'Každý okamžik stojí za oslavu.',c['textMuted'],12)
 # card2
 r(x+22,top+367,right-22,top+530,c['surface'],22,outline=c['border'],width=2)
 t(x+43,top+386,'Vývoj hmotnosti',c['text'],18,True)
 vals=[38,47,59,55,68,79,89]
 for i,v in enumerate(vals):
  bx=x+43+i*44; by=top+501
  r(bx,by-v,bx+26,by,c['primary'] if i==6 else c['sceneAccentSoft'],8)
 t(x+43,top+507,'Roste postupně od 4,8 do 7,4 kg',c['textMuted'],11)
 # input
 t(x+28,top+553,'Poznámka',c['text'],13,True)
 r(x+22,top+580,right-22,top+629,c['surface'],12,outline=c['controlBorder'],width=2)
 t(x+39,top+591,'První úsměv...',c['textMuted'],15)
 # CTA
 r(x+22,top+654,right-22,top+705,c['primary'],16)
 t(x+129,top+668,'Přidat záznam',c['onPrimary'],15,True)
 # bottom accent
 t(x+115,top+714,f'{mode.upper()} MODE',c['textMuted'],11,True)

# right panel tokens
x=915
r(x,119,1279,860,'#F7F9F5',26)
t(x+24,140,'FOUNDATIONS', '#263B36',22,True)
t(x+24,179,'Jednotná barevná řeč', '#50635C',14)
colors=[('Background','background'),('Surface','surface'),('Primary','primary'),('Accent','sceneAccent'),('Soft','sceneAccentSoft'),('Border','controlBorder')]
for i,(label,key) in enumerate(colors):
 y=217+i*61
 r(x+25,y,x+81,y+45,themes['light'][key],12,outline='#CAD7CA',width=1)
 t(x+99,y+3,label,'#263B36',15,True)
 t(x+99,y+25,themes['light'][key], '#6F8176',12)

t(x+24,602,'ACCESSIBILITY', '#263B36',20,True)
for i,line in enumerate(['WCAG AA token kontrast', '44+ dp dotykové cíle', 'Text scaling / nativní UI', 'Light, dark & system mode']):
 dot(x+38,648+i*36,5,'#3C7057');t(x+52,636+i*36,line,'#465C50',14)

# note at bottom below render within card
img.save(root / 'previews/lumi-v0.5-ui-spec.png')
print('Preview created: previews/lumi-v0.5-ui-spec.png')
