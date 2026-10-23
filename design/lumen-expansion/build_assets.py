"""Normalize original imagegen sheets; retain every established Lumen texture.

Run: python design/lumen-expansion/build_assets.py
One shared scale/palette per actor, bottom-center anchor, nearest sampling,
binary alpha. Source pixels are retained in sources/ for reproducibility.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
from PIL import Image

HERE = Path(__file__).parent
DEST = HERE.parents[1] / 'webapp/frontend/assets/lumen'
spec = importlib.util.spec_from_file_location('arsenal_normalizer', HERE.parent / 'lumen-arsenal/build_assets.py')
normalizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)
base = normalizer.base
NAMES = ['tinkerer', 'cantor', 'astronomer', 'heliarch']
ITEMS = ['needle', 'fan', 'bell', 'mine', 'frostnova', 'drone', 'meteor', 'gravity',
         'sunlance', 'eclipse', 'laurel', 'heart', 'carapace', 'ember', 'compass', 'hourglass']


def hard_alpha(image):
    image = image.convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda a: 255 if a >= 192 else 0))
    return image


def build():
    actors, palettes = {}, {}
    roster = Image.new('RGBA', (4 * 144, 144), '#17262e')
    animations = Image.new('RGBA', (6 * 48, 5 * 48 * 4), '#17262e')
    for index, name in enumerate(NAMES):
        raw = hard_alpha(Image.open(HERE / 'sources' / f'{name}-raw.png'))
        bounds = normalizer.rows(raw, 5)
        frames = [base.actor_content(raw.crop((round(col * raw.width / 6), bounds[row],
                  round((col + 1) * raw.width / 6), bounds[row + 1])))
                  for row in range(5) for col in range(6)]
        scale = min(44 / max(f.width for f in frames), 41 / max(f.height for f in frames))
        colors = normalizer.palette(frames, 32)
        sheet = Image.new('RGBA', (288, 240))
        for i, frame in enumerate(frames):
            frame = base.content(base.indexed(frame.resize((max(1, round(frame.width * scale)),
                    max(1, round(frame.height * scale))), Image.Resampling.NEAREST), colors))
            sheet.alpha_composite(frame, ((i % 6) * 48 + (48 - frame.width) // 2,
                                         (i // 6) * 48 + 45 - frame.height))
        sheet.save(DEST / f'{name}.png', optimize=True)
        actors[name] = {'frameSize': 48, 'anchor': [24, 45], 'columns': 6, 'rows': 5}
        palettes[name] = ['#' + bytes(c).hex() for c in colors]
        roster.alpha_composite(sheet.crop((0, 0, 48, 48)).resize((144, 144), Image.Resampling.NEAREST), (index * 144, 0))
        animations.alpha_composite(sheet, (0, index * 240))
    roster.save(HERE / 'roster-preview.png', optimize=True)
    animations.resize((576, 1920), Image.Resampling.NEAREST).save(HERE / 'animation-preview.png', optimize=True)
    raw = hard_alpha(Image.open(HERE / 'sources/items-raw.png'))
    bounds = normalizer.rows(raw, 4)
    frames = [base.actor_content(raw.crop((round(col * raw.width / 4), bounds[row],
              round((col + 1) * raw.width / 4), bounds[row + 1])))
              for row in range(4) for col in range(4)]
    colors = normalizer.palette(frames, 64)
    atlas = Image.new('RGBA', (384, 96))
    for i, frame in enumerate(frames):
        scale = min(44 / frame.width, 44 / frame.height)
        frame = base.content(base.indexed(frame.resize((max(1, round(frame.width * scale)),
                max(1, round(frame.height * scale))), Image.Resampling.NEAREST), colors))
        atlas.alpha_composite(frame, ((i % 8) * 48 + (48 - frame.width) // 2,
                                     (i // 8) * 48 + (48 - frame.height) // 2))
    atlas.save(DEST / 'expansion-items.png', optimize=True)
    atlas.resize((1152, 288), Image.Resampling.NEAREST).save(HERE / 'icons-preview.png', optimize=True)
    sources = {f'expansion/{p.name}': {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in sorted((HERE / 'sources').glob('*.png'))}
    return {'actors': actors, 'palettes': palettes, 'sources': sources}


if __name__ == '__main__':
    expansion = build()
    manifest = json.loads((DEST / 'manifest.json').read_text(encoding='utf-8'))
    for key in ['actors', 'palettes', 'sources']:
        manifest.setdefault(key, {}).update(expansion[key])
    manifest['files'].update({p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                             for p in [*(DEST / f'{name}.png' for name in NAMES), DEST / 'expansion-items.png']})
    (DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Built 4 original heroes / 120 animation frames and 16 item icons.')
