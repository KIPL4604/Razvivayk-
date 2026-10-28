"""Normalize only the new authored enemy VFX / door sprite sheets."""
from pathlib import Path
import hashlib, importlib.util, json, sys
from PIL import Image

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
ART=ROOT/'webapp/frontend/assets/lumen'
sys.path.insert(0,str(HERE.parent/'lumen-pixel'))
spec=importlib.util.spec_from_file_location('polish_normalizer',HERE.parent/'lumen-arsenal/build_assets.py')
norm=importlib.util.module_from_spec(spec);spec.loader.exec_module(norm)
base=norm.base


def raw(name):
    im=Image.open(HERE/'sources'/f'{name}-raw.png').convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a:255 if a>=192 else 0))
    return im


def main():
    im=raw('enemy-projectiles')
    cuts=norm.rows(im,4)
    frames=[base.actor_content(im.crop((round(c*im.width/6),cuts[r],round((c+1)*im.width/6),cuts[r+1])))
            for r in range(4) for c in range(6)]
    colors=norm.palette(frames,80)
    fx=Image.new('RGBA',(192,128))
    for row in range(4):
        group=frames[row*6:(row+1)*6]
        scale=min(30/max(f.width for f in group),26/max(f.height for f in group))
        for col,frame in enumerate(group):
            f=base.indexed(frame.resize((max(1,round(frame.width*scale)),max(1,round(frame.height*scale))),
                           Image.Resampling.NEAREST),colors)
            fx.alpha_composite(f,(col*32+(32-f.width)//2,row*32+(32-f.height)//2))
    fx.save(ART/'enemy-projectiles.png',optimize=True)
    fx.resize((1152,768),Image.Resampling.NEAREST).save(HERE/'projectiles-preview.png',optimize=True)

    im=raw('castle-door')
    cuts=norm.rows(im,2)
    frames=[base.actor_content(im.crop((round(c*im.width/3),cuts[r],round((c+1)*im.width/3),cuts[r+1])))
            for r in range(2) for c in range(3)]
    colors=norm.palette(frames,96)
    scale=min(248/max(f.width for f in frames),238/max(f.height for f in frames))
    doors=Image.new('RGBA',(1536,256))
    for col,frame in enumerate(frames):
        f=base.content(base.indexed(frame.resize((max(1,round(frame.width*scale)),max(1,round(frame.height*scale))),
                       Image.Resampling.NEAREST),colors))
        doors.alpha_composite(f,(col*256+(256-f.width)//2,244-f.height))
    doors.save(ART/'castle-door.png',optimize=True)
    doors.resize((1536,256),Image.Resampling.NEAREST).save(HERE/'door-preview.png',optimize=True)
    manifest_path=ART/'manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['enemyProjectiles']={'file':'enemy-projectiles.png','frameSize':32,'columns':6,'rows':4,
        'anchor':[25,16],'families':['ruby','amber','wax','paper']}
    manifest['castleDoor']={'file':'castle-door.png','frameSize':256,'columns':6,'rows':1,'anchor':[128,244]}
    for name in ['enemy-projectiles.png','castle-door.png']:
        data=(ART/name).read_bytes()
        manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    for file in (HERE/'sources').glob('*.png'):
        data=file.read_bytes()
        manifest['sources']['castle-polish/'+file.name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Built 24 enemy projectile frames and 6 door states.')


if __name__=='__main__':
    main()
