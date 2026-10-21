"""Normalize original imagegen laboratory sprites; no drawing or replacement artwork."""
from pathlib import Path
import hashlib,json
from PIL import Image
BASE=Path(__file__).resolve().parent
OUT=BASE.parents[1]/'webapp/frontend/assets/specimen'
nest=Image.open(BASE/'nest-source.png').convert('RGBA')
sheet=Image.new('RGBA',(256,256))
for i in range(4):
    x,y=i%2,i//2
    tile=nest.crop((x*nest.width//2,y*nest.height//2,(x+1)*nest.width//2,(y+1)*nest.height//2))
    tile.putalpha(tile.getchannel('A').point(lambda a:255 if a>=100 else 0))
    tile.thumbnail((124,124),Image.Resampling.NEAREST)
    sheet.alpha_composite(tile,(x*128+(128-tile.width)//2,y*128+(128-tile.height)//2))
sheet.quantize(colors=128,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(OUT/'nest.png',optimize=True)
raw=Image.open(BASE/'flamer-source.png').convert('RGBA')
raw.putalpha(raw.getchannel('A').point(lambda a:255 if a>=100 else 0))
# Locate the six separated figures so the wide fallen pose is not cut by a nominal grid.
alpha=raw.getchannel('A');runs=[];start=None
for x in range(raw.width+1):
    occupied=x<raw.width and alpha.crop((x,0,x+1,raw.height)).getbbox() is not None
    if occupied and start is None:start=x
    if not occupied and start is not None:
        if x-start>15:runs.append((start,x))
        start=None
assert len(runs)==6,runs
tiles=[raw.crop((x,0,end,raw.height)) for x,end in runs]
tiles=[t.crop(t.getchannel('A').getbbox()) for t in tiles]
scale=min(50/max(t.height for t in tiles),60/max(t.width for t in tiles))
sheet=Image.new('RGBA',(384,64))
for i,tile in enumerate(tiles):
    tile=tile.resize((round(tile.width*scale),round(tile.height*scale)),Image.Resampling.NEAREST)
    sheet.alpha_composite(tile,(i*64+(64-tile.width)//2,58-tile.height))
sheet.quantize(colors=128,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(OUT/'flamer.png',optimize=True)
m=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'));m.update(version=4,nestFrames=4,flamerFrames=6)
for name in ('nest.png','flamer.png'):
    data=(OUT/name).read_bytes()
    with Image.open(OUT/name) as im:m['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'size':list(im.size)}
(OUT/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Original nest 4 frames, flamer 6 frames:',runs)
