"""Offline normalization of original whole-sheet imagegen assets for Lumen."""
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
NAMES = ['artificer', 'sentinel', 'quartzling', 'shardback', 'moonmoth']


def build():
    actors, palettes = {}, {}
    preview = Image.new('RGBA', (5 * 144, 144), '#242034')
    for index, name in enumerate(NAMES):
        raw = Image.open(HERE / 'sources' / f'{name}-raw.png').convert('RGBA')
        raw.putalpha(raw.getchannel('A').point(lambda a: 255 if a >= 192 else 0))
        bounds = normalizer.rows(raw, 5)
        frames = [base.actor_content(raw.crop((round(col * raw.width / 6), bounds[row], round((col + 1) * raw.width / 6), bounds[row + 1])))
                  for row in range(5) for col in range(6)]
        scale = min(44 / max(f.width for f in frames), 41 / max(f.height for f in frames))
        colors = normalizer.palette(frames, 32)
        sheet = Image.new('RGBA', (288, 240))
        for i, frame in enumerate(frames):
            frame = base.content(base.indexed(frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.NEAREST), colors))
            sheet.alpha_composite(frame, ((i % 6) * 48 + (48 - frame.width) // 2, (i // 6) * 48 + 45 - frame.height))
        sheet.save(DEST / f'{name}.png', optimize=True)
        actors[name] = {'frameSize': 48, 'anchor': [24, 45], 'columns': 6, 'rows': 5}
        palettes[name] = ['#' + bytes(c).hex() for c in colors]
        preview.alpha_composite(sheet.crop((0, 0, 48, 48)).resize((144, 144), Image.Resampling.NEAREST), (index * 144, 0))
    preview.save(HERE / 'roster-preview.png', optimize=True)
    raw = Image.open(HERE / 'sources/expedition-raw.png').convert('RGBA')
    raw.putalpha(raw.getchannel('A').point(lambda a: 255 if a >= 192 else 0))
    bounds = normalizer.rows(raw, 2)
    frames = [base.actor_content(raw.crop((round(col * raw.width / 5), bounds[row], round((col + 1) * raw.width / 5), bounds[row + 1])))
              for row in range(2) for col in range(5)]
    colors = normalizer.palette(frames, 64)
    atlas = Image.new('RGBA', (240, 96))
    for i, frame in enumerate(frames):
        scale = min(44 / frame.width, 44 / frame.height)
        frame = base.content(base.indexed(frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.NEAREST), colors))
        atlas.alpha_composite(frame, ((i % 5) * 48 + (48 - frame.width) // 2, (i // 5) * 48 + (48 - frame.height) // 2))
    atlas.save(DEST / 'expedition.png', optimize=True)
    atlas.resize((960, 384), Image.Resampling.NEAREST).save(HERE / 'icons-preview.png', optimize=True)
    sources = {f'quarry/{p.name}': {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in sorted((HERE / 'sources').glob('*.png'))}
    return {'actors': actors, 'palettes': palettes, 'sources': sources}


if __name__ == '__main__':
    expansion = build()
    manifest = json.loads((DEST / 'manifest.json').read_text(encoding='utf-8'))
    for key in ['actors', 'palettes', 'sources']:
        manifest.setdefault(key, {}).update(expansion[key])
    manifest['files'].update({p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                              for p in [*(DEST / f'{name}.png' for name in NAMES), DEST / 'expedition.png']})
    (DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Built 5 actors / 150 frames and 10 item icons.')
