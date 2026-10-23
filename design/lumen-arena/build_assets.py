"""Normalize the original crater imagegen sheets without touching old textures.

Run: python design/lumen-arena/build_assets.py
Same nearest-neighbor / binary-alpha / shared-palette pipeline as Lumen's
established atlas builders. Original imagegen PNGs remain in sources/.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
from PIL import Image

HERE = Path(__file__).parent
DEST = HERE.parents[1] / 'webapp/frontend/assets/lumen'
spec = importlib.util.spec_from_file_location('arena_normalizer', HERE.parent / 'lumen-arsenal/build_assets.py')
normalizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)
base = normalizer.base
ACTORS = ['boss-carapace', 'boss-tempest', 'boss-matriarch', 'arena-tick']
FILES = [*(name + '.png' for name in ACTORS), 'mega-chest.png', 'crater-tiles.png', 'crater-props.png', 'arena-fx.png']


def source(name):
    image = Image.open(HERE / 'sources' / (name + '-raw.png')).convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda value: 255 if value >= 192 else 0))
    return image


def scale_frame(frame, scale, colors):
    return base.content(base.indexed(frame.resize((max(1, round(frame.width * scale)),
                         max(1, round(frame.height * scale))), Image.Resampling.NEAREST), colors))


def build():
    DEST.mkdir(parents=True, exist_ok=True)
    actors, palettes = {}, {}
    roster = Image.new('RGBA', (4 * 192, 192), '#17262e')
    for index, name in enumerate(ACTORS):
        raw = source(name)
        rows = normalizer.rows(raw, 5)
        frames = [base.actor_content(raw.crop((round(col * raw.width / 6), rows[row],
                  round((col + 1) * raw.width / 6), rows[row + 1])))
                  for row in range(5) for col in range(6)]
        size = 48 if name == 'arena-tick' else 96
        baseline = size * 45 // 48
        scale = min((size - 4) / max(frame.width for frame in frames),
                    (size - 7) / max(frame.height for frame in frames))
        colors = normalizer.palette(frames, 32)
        atlas = Image.new('RGBA', (size * 6, size * 5))
        for i, frame in enumerate(frames):
            frame = scale_frame(frame, scale, colors)
            atlas.alpha_composite(frame, ((i % 6) * size + (size - frame.width) // 2,
                                         (i // 6) * size + baseline - frame.height))
        atlas.save(DEST / (name + '.png'), optimize=True)
        actors[name] = {'frameSize': size, 'anchor': [size // 2, baseline], 'columns': 6, 'rows': 5}
        palettes[name] = ['#' + bytes(color).hex() for color in colors]
        roster.alpha_composite(atlas.crop((0, 0, size, size)).resize((192, 192), Image.Resampling.NEAREST), (index * 192, 0))
        atlas.resize((size * 12, size * 10), Image.Resampling.NEAREST).save(HERE / (name + '-preview.png'), optimize=True)
    roster.save(HERE / 'roster-preview.png', optimize=True)

    # One global scale preserves the apparent chest size as its lid opens.
    raw = source('mega-chest')
    frames = [base.content(raw.crop((round(col * raw.width / 6), 0,
              round((col + 1) * raw.width / 6), raw.height))) for col in range(6)]
    colors = normalizer.palette(frames, 48)
    scale = min(92 / max(frame.width for frame in frames), 86 / max(frame.height for frame in frames))
    atlas = Image.new('RGBA', (576, 96))
    for i, frame in enumerate(frames):
        frame = scale_frame(frame, scale, colors)
        atlas.alpha_composite(frame, (i * 96 + (96 - frame.width) // 2, 90 - frame.height))
    atlas.save(DEST / 'mega-chest.png', optimize=True)
    atlas.resize((1152, 192), Image.Resampling.NEAREST).save(HERE / 'chest-preview.png', optimize=True)

    raw = source('crater-environment')
    # Reviewed boundary: the floor slabs end at y=423, above the four props.
    # Inset each slab by 5px before sampling: all 32px floor cells stay opaque.
    slabs = [(48, 52, 429, 418), (484, 51, 858, 418),
             (918, 51, 1293, 418), (1350, 51, 1728, 418)]
    tile_frames = [raw.crop(box) for box in slabs]
    colors = normalizer.palette(tile_frames, 32)
    tiles = Image.new('RGBA', (128, 32))
    for col, frame in enumerate(tile_frames):
        frame = base.indexed(frame.resize((32, 32), Image.Resampling.NEAREST), colors)
        frame.putalpha(255)
        tiles.alpha_composite(frame, (col * 32, 0))
    tiles.save(DEST / 'crater-tiles.png', optimize=True)
    props = [base.actor_content(raw.crop((round(col * raw.width / 4), 430,
             round((col + 1) * raw.width / 4), raw.height))) for col in range(4)]
    colors = normalizer.palette(props, 48)
    atlas = Image.new('RGBA', (256, 64))
    for col, frame in enumerate(props):
        frame = scale_frame(frame, min(60 / frame.width, 60 / frame.height), colors)
        atlas.alpha_composite(frame, (col * 64 + (64 - frame.width) // 2, 62 - frame.height))
    atlas.save(DEST / 'crater-props.png', optimize=True)
    atlas.resize((1024, 256), Image.Resampling.NEAREST).save(HERE / 'environment-preview.png', optimize=True)

    raw = source('arena-fx')
    rows = normalizer.rows(raw, 5)
    # Do not crop each frame to content: expanding bursts must keep their scale.
    # The same slot coordinates are sampled for all six frames in every row.
    frames = [raw.crop((round(col * raw.width / 6), rows[row],
              round((col + 1) * raw.width / 6), rows[row + 1]))
              for row in range(5) for col in range(6)]
    atlas = Image.new('RGBA', (384, 320))
    for row in range(5):
        colors = normalizer.palette(frames[row * 6:(row + 1) * 6], 48)
        for col in range(6):
            frame = base.indexed(frames[row * 6 + col].resize((64, 64), Image.Resampling.NEAREST), colors)
            atlas.alpha_composite(frame, (col * 64, row * 64))
    atlas.save(DEST / 'arena-fx.png', optimize=True)
    atlas.resize((1152, 960), Image.Resampling.NEAREST).save(HERE / 'fx-preview.png', optimize=True)
    sources = {'arena/' + path.name: {'bytes': path.stat().st_size,
               'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
               for path in sorted((HERE / 'sources').glob('*.png'))}
    return {'actors': actors, 'palettes': palettes, 'sources': sources}


if __name__ == '__main__':
    data = build()
    manifest = json.loads((DEST / 'manifest.json').read_text(encoding='utf-8'))
    for key in ['actors', 'palettes', 'sources']:
        manifest.setdefault(key, {}).update(data[key])
    manifest['files'].update({name: {'bytes': (DEST / name).stat().st_size,
        'sha256': hashlib.sha256((DEST / name).read_bytes()).hexdigest()} for name in FILES})
    (DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Built 4 actors / 120 frames, 6 chest frames, 30 FX frames and crater environment.')
