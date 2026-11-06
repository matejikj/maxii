"""One-time migration: preserve source character geometry without SVG XML parsing at runtime."""
from pathlib import Path
import re, ast, xml.etree.ElementTree as ET, json
root = Path(__file__).resolve().parents[1]
source=(root / 'tools/legacy/LumiBackground.v0.1.tsx').read_text()
block=source.split('const ANIMAL_SVG: Record<LumiAnimal, string> = {',1)[1].split('\n};',1)[0]
parts=re.findall(r'^\s*(rabbit|bear|fox|otter|hedgehog):\s*("(?:\\.|[^"\\])*")\s*,?',block,re.M)
assert len(parts)==5, [x[0] for x in parts]
attr_map={'stroke-width':'strokeWidth','stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin','fill-rule':'fillRule','clip-rule':'clipRule'}
def convert(el):
    attrs={attr_map.get(k,k):v for k,v in el.attrib.items()}
    numeric={'cx','cy','r','rx','ry','x','y','width','height','strokeWidth','opacity'}
    for k in numeric:
        if k in attrs: attrs[k]=float(attrs[k])
    name='group' if el.tag=='g' else el.tag
    assert name in {'group','path','circle','ellipse','rect'},name
    val={'kind':name,'props':attrs}
    if len(el): val['children']=[convert(child) for child in el]
    return val
out=root / 'src/core/characters/artwork.ts'
lines=['/** Migrated 1:1 from the original LUMI v0.1 character geometry.',' * Source of truth: declarative nodes; no runtime SVG string parsing.',' * This file is generated, edit character definitions in a future authoring tool. */','import type { VectorNode } from \'../vector/types\';','import type { LumiAnimal } from \'../types\';','', 'export const CHARACTER_ARTWORK: Readonly<Record<LumiAnimal, VectorNode>> = {']
for name, js in parts:
    raw=json.loads(js)
    root=ET.fromstring(raw)
    converted=convert(root)
    txt=json.dumps(converted,ensure_ascii=False,indent=2)
    lines.append('  '+name+': '+txt.replace('\n','\n  ')+',')
lines+=['} as const;','']
out.write_text('\n'.join(lines))
print('migrated',len(parts),'characters',out.stat().st_size,'bytes')
