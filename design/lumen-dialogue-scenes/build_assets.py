"""Prepare independently loaded story art; never repack simulation sprites.

Run from the project root: python design/lumen-dialogue-scenes/build_assets.py
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ART = HERE.parents[1] / 'webapp/frontend/assets/lumen'


def descriptor(path):
    data = path.read_bytes()
    with Image.open(path) as image:
        size = list(image.size)
    return {'file': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'size': size}


def main():
    manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
    result = {'sources': {}, 'worlds': {}, 'heroes': {}}
    for world in ['garden', 'quarry', 'castle', 'crater']:
        source = HERE / 'sources' / f'{world}.png'
        result['sources'][world] = descriptor(source)
        with Image.open(source) as raw:
            raw = raw.convert('RGB')
            for width, suffix, quality in [(1536, '', 84), (768, '-small', 80)]:
                image = raw.resize((width, round(raw.height * width / raw.width)), Image.Resampling.LANCZOS)
                target = ART / f'story-world-{world}{suffix}.webp'
                image.save(target, 'WEBP', quality=quality, method=6)
                result['worlds'][world + suffix] = descriptor(target)
    for hero in ['scout', 'keeper', 'alchemist', 'ranger', 'duelist', 'stormcaller',
                 'artificer', 'sentinel', 'tinkerer', 'cantor', 'astronomer', 'heliarch']:
        size = manifest['actors'][hero]['frameSize']
        with Image.open(ART / f'{hero}.png') as sheet:
            frame = sheet.convert('RGBA').crop((0, 0, size, size))
            frame = frame.crop(frame.getchannel('A').getbbox())
        scale = min(168 / frame.width, 232 / frame.height)
        frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.NEAREST)
        portrait = Image.new('RGBA', (192, 256))
        portrait.alpha_composite(frame, ((192 - frame.width) // 2, 248 - frame.height))
        target = ART / f'story-hero-{hero}.png'
        portrait.save(target, optimize=True)
        result['heroes'][hero] = descriptor(target)
    (HERE / 'assets.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({group: {key: entry['bytes'] for key, entry in entries.items()}
                      for group, entries in result.items() if group != 'sources'}))


if __name__ == '__main__':
    main()
