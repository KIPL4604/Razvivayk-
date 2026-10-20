"""Normalize the original Moon Quarry atlas into 32px tiles and 64px props."""
from pathlib import Path
import hashlib
import importlib.util
from PIL import Image

HERE=Path(__file__).parent
DEST=HERE.parents[1]/'webapp/frontend/assets/lumen'
spec=importlib.util.spec_from_file_location('lumen_base',HERE.parent/'lumen-pixel/build_assets.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)

def build():
    source=HERE/'sources/quarry-raw.png'
    raw=Image.open(source).convert('RGBA')
    raw.putalpha(raw.getchannel('A').point(lambda a:255 if a>=192 else 0))
    frames=[base.actor_content(raw.crop((round(c*raw.width/4),round(r*raw.height/2),round((c+1)*raw.width/4),round((r+1)*raw.height/2)))) for r in range(2) for c in range(4)]
    strip=Image.new('RGB',(sum(f.width for f in frames),max(f.height for f in frames)),(48,40,55));x=0
    for f in frames:strip.paste(f,(x,0),f);x+=f.width
    palette=strip.quantize(colors=48,method=Image.Quantize.MEDIANCUT).getpalette()
    colors=[tuple(palette[i:i+3]) for i in range(0,144,3)]
    tiles=Image.new('RGBA',(128,32));props=Image.new('RGBA',(256,64))
    for i,f in enumerate(frames):
        if i<4:
            f=f.resize((32,32),Image.Resampling.NEAREST)
            opaque=Image.new('RGBA',(32,32),(48,40,55,255));opaque.alpha_composite(f)
            tiles.alpha_composite(base.indexed(opaque,colors),(i*32,0))
        else:
            scale=min(60/f.width,57/f.height)
            f=base.content(base.indexed(f.resize((max(1,round(f.width*scale)),max(1,round(f.height*scale))),Image.Resampling.NEAREST),colors))
            props.alpha_composite(f,((i-4)*64+(64-f.width)//2,60-f.height))
    tiles.save(DEST/'quarry-tiles.png',optimize=True);props.save(DEST/'quarry-props.png',optimize=True)
    preview=Image.new('RGBA',(256,112),'#302837');preview.alpha_composite(tiles,(0,0));preview.alpha_composite(props,(0,40))
    preview.resize((1024,448),Image.Resampling.NEAREST).save(HERE/'quarry-preview.png',optimize=True)
    return {'sources':{f'campaign/{p.name}':{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((HERE/'sources').glob('*.png'))}}
