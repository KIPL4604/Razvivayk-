"""Normalize whole imagegen sheets. Per-actor palettes; never a biome color filter."""
from pathlib import Path
import hashlib
import importlib.util
import json
from PIL import Image

HERE=Path(__file__).parent
ROOT=HERE.parents[1]
DEST=ROOT/'webapp/frontend/assets/lumen'
spec=importlib.util.spec_from_file_location('lumen_pixel_base',HERE.parent/'lumen-pixel/build_assets.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
NAMES=['keeper','alchemist','ranger','duelist','stormcaller','crawler','spitter','wisp','boss-briar','boss-queen','boss-ash']

def rows(image,count):
    alpha=image.getchannel('A')
    occupied=[alpha.crop((0,y,image.width,y+1)).point(lambda a:255 if a>=192 else 0).getbbox() is not None for y in range(image.height)]
    cuts=[0]
    for row in range(1,count):
        target=image.height*row/count
        candidates=[y for y in range(max(cuts[-1]+1,round(target-image.height/count*.28)),min(image.height,round(target+image.height/count*.28))) if not occupied[y]]
        cuts.append(min(candidates,key=lambda y:abs(y-target)) if candidates else round(target))
    return cuts+[image.height]

def palette(frames,colors=32):
    strip=Image.new('RGB',(sum(f.width for f in frames),max(f.height for f in frames)),(17,27,37));x=0
    for f in frames:strip.paste(f,(x,0),f);x+=f.width
    p=strip.quantize(colors=colors,method=Image.Quantize.MEDIANCUT).getpalette()
    return [tuple(p[i:i+3]) for i in range(0,colors*3,3)]

def build():
    actors={};palettes={};preview=Image.new('RGBA',(6*120,2*144),'#17262e')
    for index,name in enumerate(NAMES):
        raw=Image.open(HERE/'sources'/f'{name}-raw.png').convert('RGBA')
        raw.putalpha(raw.getchannel('A').point(lambda a:255 if a>=192 else 0))
        bounds=rows(raw,5)
        frames=[base.actor_content(raw.crop((round(col*raw.width/6),bounds[row],round((col+1)*raw.width/6),bounds[row+1]))) for row in range(5) for col in range(6)]
        size=96 if name.startswith('boss-') else 48;anchor=round(size*45/48)
        scale=min((size-4)/max(f.width for f in frames),(size-7)/max(f.height for f in frames))
        colors=palette(frames);sheet=Image.new('RGBA',(size*6,size*5))
        for i,frame in enumerate(frames):
            frame=base.content(base.indexed(frame.resize((max(1,round(frame.width*scale)),max(1,round(frame.height*scale))),Image.Resampling.NEAREST),colors))
            sheet.alpha_composite(frame,((i%6)*size+(size-frame.width)//2,(i//6)*size+anchor-frame.height))
        sheet.save(DEST/f'{name}.png',optimize=True)
        actors[name]={'frameSize':size,'anchor':[size//2,anchor],'columns':6,'rows':5}
        palettes[name]=['#'+bytes(c).hex() for c in colors]
        frame=sheet.crop((0,0,size,size)).resize((96,96),Image.Resampling.NEAREST)
        preview.alpha_composite(frame,((index%6)*120+12,(index//6)*144+12))
    preview.save(HERE/'roster-preview.png',optimize=True)
    raw=Image.open(HERE/'sources/arsenal-raw.png').convert('RGBA')
    raw.putalpha(raw.getchannel('A').point(lambda a:255 if a>=192 else 0))
    bounds=rows(raw,4)
    frames=[base.content(raw.crop((round(col*raw.width/8),bounds[row],round((col+1)*raw.width/8),bounds[row+1]))) for row in range(4) for col in range(8)]
    colors=palette(frames,64);atlas=Image.new('RGBA',(384,192))
    # Consistent scale within each animation group, individual readable icon size.
    for i,frame in enumerate(frames):
        group=frames[16:20] if 16<=i<20 else frames[20:24] if 20<=i<24 else frames[24:31] if 24<=i<31 else [frame]
        scale=min(44/max(f.width for f in group),43/max(f.height for f in group))
        frame=base.content(base.indexed(frame.resize((max(1,round(frame.width*scale)),max(1,round(frame.height*scale))),Image.Resampling.NEAREST),colors))
        x=(i%8)*48+(48-frame.width)//2;y=(i//8)*48+(45-frame.height if i>=16 else (48-frame.height)//2)
        atlas.alpha_composite(frame,(x,y))
    atlas.save(DEST/'arsenal.png',optimize=True);atlas.crop((0,0,384,48)).save(DEST/'weapons.png',optimize=True)
    atlas.resize((1152,576),Image.Resampling.NEAREST).save(HERE/'arsenal-preview.png',optimize=True)
    sources={f'arsenal/{p.name}':{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((HERE/'sources').glob('*.png'))}
    return {'actors':actors,'palettes':palettes,'sources':sources}

if __name__=='__main__':
    result=build()
    (HERE/'asset-data.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'actors':len(result['actors']),'files':len(result['sources'])}))
