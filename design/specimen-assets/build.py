"""Normalize original imagegen atlases; no game references are used as assets.

python design/specimen-assets/build.py --environment PATH --actors PATH
Requires Pillow. Raw sources and prompt log are kept beside this script.
"""
import argparse
from pathlib import Path
import shutil
import hashlib
import json
import runpy
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'webapp/frontend/assets/specimen'

def build(environment,actors,fixtures):
    OUT.mkdir(parents=True,exist_ok=True)
    source=Path(__file__).parent
    for src,name in ((environment,'environment-source.png'),(actors,'actors-source.png'),(fixtures,'fixtures-source.png')):
        dest=source/name
        if Path(src).resolve()!=dest.resolve():
            shutil.copyfile(src,dest)
    env=Image.open(environment).convert('RGBA')
    env.putalpha(env.getchannel('A').point(lambda a:255 if a>=128 else 0))
    atlas=Image.new('RGBA',(256,256))
    for i in range(16):
        x,y=i%4,i//4
        tile=env.crop((round(x*env.width/4),round(y*env.height/4),round((x+1)*env.width/4),round((y+1)*env.height/4)))
        atlas.paste(tile.resize((64,64),Image.Resampling.NEAREST),(x*64,y*64))
    atlas.save(OUT/'atlas.png',optimize=True)
    people=Image.open(actors).convert('RGBA')
    people.putalpha(people.getchannel('A').point(lambda a:255 if a>=128 else 0))
    sheet=Image.new('RGBA',(384,128))
    for row in range(2):
        frames=[]
        for col in range(6):
            tile=people.crop((round(col*people.width/6),round(row*people.height/2),round((col+1)*people.width/6),round((row+1)*people.height/2)))
            bbox=tile.getchannel('A').getbbox()
            frames.append(tile.crop(bbox) if bbox else tile)
        scale=min(52/max(f.height for f in frames),58/max(f.width for f in frames))
        for col,frame in enumerate(frames):
            sprite=frame.resize((max(1,round(frame.width*scale)),max(1,round(frame.height*scale))),Image.Resampling.NEAREST)
            sheet.paste(sprite,(col*64+(64-sprite.width)//2,row*64+58-sprite.height))
    sheet.save(OUT/'people.png',optimize=True)
    equipment=Image.open(fixtures).convert('RGBA')
    equipment.putalpha(equipment.getchannel('A').point(lambda a:255 if a>=128 else 0))
    furniture=Image.new('RGBA',(256,192))
    # The generated objects cross nominal gutters; extract complete silhouettes.
    bounds=[(62,0,328,380),(413,35,687,380),(760,4,1058,379),(1100,4,1440,380),
            (92,399,217,738),(330,390,755,730),(762,390,1074,730),(1130,395,1440,727),
            (4,751,449,1061),(448,756,750,1068),(775,842,1140,1044),(1145,731,1440,1080)]
    for i,box in enumerate(bounds):
        tile=equipment.crop(tuple(round(v*equipment.size[j%2]/(1440 if j%2==0 else 1080)) for j,v in enumerate(box)))
        bbox=tile.getchannel('A').getbbox()
        if bbox:tile=tile.crop(bbox)
        furniture.paste(tile.resize((64,64),Image.Resampling.NEAREST),((i%4)*64,(i//4)*64))
    furniture.save(OUT/'fixtures.png',optimize=True)
    # Cover is an atlas-based original composition; the runtime uses the same art.
    cover=Image.new('RGBA',(384,240),'#101d23')
    for y in range(0,240,64):
        for x in range(0,384,64):
            cover.alpha_composite(atlas.crop((64,0,128,64)),(x,y))
    for x,y,size in [(210,96,94),(263,117,86),(186,144,78),(300,79,60)]:
        cell=atlas.crop((0,128,64,192)).resize((size,size),Image.Resampling.NEAREST)
        cover.alpha_composite(cell,(x-size//2,y-size//2))
    cover.alpha_composite(atlas.crop((128,128,192,192)).resize((60,60),Image.Resampling.NEAREST),(246,109))
    cover.convert('RGB').save(OUT/'cover.png',optimize=True)
    files={}
    for name in ('atlas.png','people.png','cover.png','fixtures.png'):
        data=(OUT/name).read_bytes()
        with Image.open(OUT/name) as image:
            files[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'size':list(image.size)}
    manifest={'version':2,'origin':'Original imagegen artwork, normalized from retained source atlases',
              'tileSize':64,'environmentSlots':16,'fixtureSlots':12,'people':{'frames':6,'rows':2,'frameSize':64,'anchor':[32,58]},'files':files}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Generated atlas, people, cover and laboratory fixtures')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--environment',default=str(Path(__file__).with_name('environment-source.png')))
    parser.add_argument('--actors',default=str(Path(__file__).with_name('actors-source.png')))
    parser.add_argument('--fixtures',default=str(Path(__file__).with_name('fixtures-source.png')))
    args=parser.parse_args()
    build(args.environment,args.actors,args.fixtures)
    reference=Path(__file__).with_name('build-reference.py')
    if reference.exists() and all(reference.with_name(name).exists() for name in ('sector-reference-source.png','tissue-reference-source.png')):
        runpy.run_path(str(reference),run_name='__main__')
