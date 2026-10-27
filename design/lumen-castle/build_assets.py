"""Build approved castle imagegen sheets into deterministic Lumen runtime atlases.
Only new castle files are normalized. Existing PNGs stay byte-for-byte unchanged.
Run: python design/lumen-castle/build_assets.py
"""
from pathlib import Path
from io import BytesIO
import hashlib
import importlib.util
import json
import sys
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ART = ROOT / 'webapp/frontend/assets/lumen'
sys.path.insert(0,str(HERE.parent/'lumen-pixel'))
spec = importlib.util.spec_from_file_location('castle_normalizer', HERE.parent/'lumen-arsenal/build_assets.py')
normalizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)
base = normalizer.base
ACTORS = {'castle-guard':96, 'castle-wax':96, 'castle-moth':96,
          'boss-conductor':144, 'boss-gatekeeper':144, 'boss-monarch':256}


def source(name, alpha=True):
    im = Image.open(HERE/'sources'/f'{name}-raw.png').convert('RGBA')
    if alpha:
        im.putalpha(im.getchannel('A').point(lambda a:255 if a>=192 else 0))
    return im


def cell(im, col, row, columns, rows, inset=0):
    return im.crop((round(col*im.width/columns)+inset, round(row*im.height/rows)+inset,
                    round((col+1)*im.width/columns)-inset, round((row+1)*im.height/rows)-inset))


def fit(frame, width, height, colors):
    scale = min(width/frame.width, height/frame.height)
    resized = frame.resize((max(1,round(frame.width*scale)),max(1,round(frame.height*scale))),
                           Image.Resampling.NEAREST)
    return base.content(base.indexed(resized,colors))


def actor_atlas(frames, size, colors):
    scale = min((size-8)/max(f.width for f in frames),(size-12)/max(f.height for f in frames))
    atlas = Image.new('RGBA',(size*6,size*5))
    baseline = size-6
    for i,frame in enumerate(frames):
        resized = frame.resize((max(1,round(frame.width*scale)),max(1,round(frame.height*scale))),
                               Image.Resampling.NEAREST)
        resized = base.content(base.indexed(resized,colors))
        atlas.alpha_composite(resized,((i%6)*size+(size-resized.width)//2,
                                      (i//6)*size+baseline-resized.height))
    return atlas,baseline


def main():
    manifest_path = ART/'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    actors = {}
    palettes = {}
    files = []
    preview = Image.new('RGBA',(256*6,256),'#201b1c')
    for i,(name,size) in enumerate(ACTORS.items()):
        raw = source(name)
        cuts = normalizer.rows(raw,5)
        frames = [base.actor_content(raw.crop((round(c*raw.width/6),cuts[r],
                  round((c+1)*raw.width/6),cuts[r+1]))) for r in range(5) for c in range(6)]
        colors = normalizer.palette(frames,80 if name=='boss-monarch' else 64)
        # Keep even the giant actor inside one established bounded transfer.
        for candidate in [size]+([224,192,176,160,144] if size>192 else []):
            atlas,baseline=actor_atlas(frames,candidate,colors)
            encoded=BytesIO()
            atlas.save(encoded,format='WEBP',lossless=True,method=6,exact=True)
            if len(encoded.getvalue())<=220000:
                size=candidate
                break
        else:
            raise ValueError(f'Actor exceeds bounded transfer budget: {name}')
        atlas.save(ART/f'{name}.png',optimize=True)
        actors[name]={'frameSize':size,'anchor':[size//2,baseline],'columns':6,'rows':5}
        palettes[name]=['#'+bytes(c).hex() for c in colors]
        preview.alpha_composite(atlas.crop((0,0,size,size)).resize((256,256),Image.Resampling.NEAREST),(i*256,0))
        files.append(name+'.png')
    preview.save(HERE/'roster-preview.png',optimize=True)
    raw=source('castle-environment',False)
    tiles=Image.new('RGBA',(256,32))
    for i in range(8):
        tile=cell(raw,i%4,i//4,4,2,inset=2).resize((32,32),Image.Resampling.NEAREST)
        tile.putalpha(255)
        tiles.alpha_composite(tile,(i*32,0))
    tiles.save(ART/'castle-tiles.png',optimize=True)
    # Keep floor grain and gold motifs at the approved concept's larger scale.
    floor=Image.new('RGBA',(512,128))
    for i in range(4):
        tile=cell(raw,i,0,4,2,inset=2).resize((128,128),Image.Resampling.NEAREST)
        tile.putalpha(255)
        floor.alpha_composite(tile,(i*128,0))
    floor.save(ART/'castle-floor.png',optimize=True)
    props=source('castle-furnishings')
    # Reviewed source boundaries: the broad flowerbed extends across its nominal
    # cell edge. Exact export boxes preserve it and exclude the adjacent wall.
    boxes=[(118,32,516,552),(592,40,940,536),(1184,28,1336,540),
           (156,572,312,972),(452,592,958,968),(970,596,1510,970)]
    frames=[base.actor_content(props.crop(box)) for box in boxes]
    colors=normalizer.palette(frames,96)
    sheet=Image.new('RGBA',(768,128))
    for i,frame in enumerate(frames):
        frame=fit(frame,122,120,colors)
        sheet.alpha_composite(frame,(i*128+(128-frame.width)//2,124-frame.height))
    sheet.save(ART/'castle-props.png',optimize=True)
    sheet.resize((1536,256),Image.Resampling.NEAREST).save(HERE/'environment-preview.png',optimize=True)
    tiles.resize((1024,128),Image.Resampling.NEAREST).save(HERE/'tiles-preview.png',optimize=True)
    files+=['castle-tiles.png','castle-props.png','castle-floor.png']
    manifest['actors'].update(actors)
    manifest.setdefault('palettes',{}).update(palettes)
    for name in files:
        data=(ART/name).read_bytes()
        manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    for f in sorted((HERE/'sources').glob('*.png')):
        data=f.read_bytes()
        manifest.setdefault('sources',{})['castle/'+f.name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'actors':actors,'files':files},ensure_ascii=False))


if __name__=='__main__':
    main()
