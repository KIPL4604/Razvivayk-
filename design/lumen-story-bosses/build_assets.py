"""Normalize four ImageGen sheets; preserve old PNGs and package lossless atlases.

Only grid extraction, shared scale/palette, hard alpha and bottom-center anchoring.
Generation prompts/provenance are adjacent. No drawing of replacement sprites.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import sys
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ART = ROOT / 'webapp/frontend/assets/lumen'
sys.path.insert(0, str(HERE.parent / 'lumen-pixel'))
from pack_assets import build_pack

spec = importlib.util.spec_from_file_location('story_normalizer', HERE.parent / 'lumen-arsenal/build_assets.py')
normalizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)
base = normalizer.base


def descriptor(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def main():
    manifest_path = ART / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    for name in ['rootwarden', 'overseer', 'drillguard', 'resonator']:
        raw = Image.open(HERE / 'sources' / f'boss-{name}-raw.png').convert('RGBA')
        raw.putalpha(raw.getchannel('A').point(lambda a: 255 if a >= 192 else 0))
        cuts = normalizer.rows(raw, 5)
        frames = [base.actor_content(raw.crop((round(col*raw.width/6), cuts[row],
                    round((col+1)*raw.width/6), cuts[row+1])))
                  for row in range(5) for col in range(6)]
        size = 160 if name in ['rootwarden', 'overseer'] else 96
        baseline = size - 6
        colors = normalizer.palette(frames, 64)
        ratio = min((size-12)/max(frame.width for frame in frames),
                    (baseline-6)/max(frame.height for frame in frames))
        sheet = Image.new('RGBA', (size*6, size*5))
        for index, frame in enumerate(frames):
            resized = frame.resize((max(1, round(frame.width*ratio)), max(1, round(frame.height*ratio))), Image.Resampling.NEAREST)
            resized = base.content(base.indexed(resized, colors))
            sheet.alpha_composite(resized, ((index%6)*size+(size-resized.width)//2,
                                          (index//6)*size+baseline-resized.height))
        file = f'boss-{name}.png'
        sheet.save(ART / file, optimize=True)
        manifest['files'][file] = descriptor(ART / file)
        manifest['actors'][f'boss-{name}'] = {'frameSize': size, 'anchor': [size//2, baseline], 'columns': 6, 'rows': 5}
        manifest.setdefault('palettes', {})[f'boss-{name}'] = ['#'+bytes(c).hex() for c in colors]
        source = HERE / 'sources' / f'boss-{name}-raw.png'
        manifest.setdefault('sources', {})['story-bosses/'+source.name] = descriptor(source)

    portraits = {}
    for name in ['boss-rootwarden','boss-overseer','boss-drillguard','boss-resonator',
                 'boss-briar','boss-queen','boss-ash','boss-conductor','boss-gatekeeper','boss-monarch','boss-matriarch']:
        actor = manifest['actors'][name]
        size = actor['frameSize']
        with Image.open(ART / (name+'.png')) as sheet:
            frame = base.content(sheet.convert('RGBA').crop((0, 0, size, size)))
        scale = min(352/frame.width, 352/frame.height)
        frame = frame.resize((round(frame.width*scale), round(frame.height*scale)), Image.Resampling.NEAREST)
        portrait = Image.new('RGBA', (384,384))
        portrait.alpha_composite(frame, ((384-frame.width)//2, 368-frame.height))
        file = 'story-'+name+'.png'
        portrait.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(ART / file, optimize=True)
        portraits[name] = {'file': file, **descriptor(ART / file)}
    manifest['storyPortraits'] = portraits
    build_pack(ART, manifest)
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'sheets':len(manifest['files']),'portraits':len(portraits),
                      'packs':len(manifest['packs']),'bytes':sum(p['bytes'] for p in manifest['packs'])}))


if __name__ == '__main__':
    main()
