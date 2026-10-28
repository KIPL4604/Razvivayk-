"""Normalize ImageGen-authored hall layers and high-detail monarch frames.

No drawing or generated approximations: crop, shared palette, nearest scale,
bottom-center anchors, then lossless transport packaging. Originals untouched.
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

spec = importlib.util.spec_from_file_location('fidelity_normalizer', HERE.parent / 'lumen-arsenal/build_assets.py')
normalizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)
base = normalizer.base
STATES = ['idle', 'walk', 'attack', 'hurt', 'death']


def source(name, hard_alpha=True):
    image = Image.open(HERE / 'sources' / (name + '-raw.png')).convert('RGBA')
    if hard_alpha:
        image.putalpha(image.getchannel('A').point(lambda a: 255 if a >= 192 else 0))
    return image


def slots(image, columns, rows):
    cuts = normalizer.rows(image, rows)
    return [base.actor_content(image.crop((round(c * image.width / columns), cuts[r],
                                          round((c + 1) * image.width / columns), cuts[r + 1])))
            for r in range(rows) for c in range(columns)]


def descriptor(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def main():
    manifest_path = ART / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    frames = [frame for state in STATES for frame in slots(source('monarch-' + state), 3, 2)]
    colors = normalizer.palette(frames, 256)
    size, baseline = 320, 308
    # A single scale across all states preserves size during attack/recoil/death.
    scale = min((size - 16) / max(f.width for f in frames),
                (baseline - 8) / max(f.height for f in frames))
    sheet = Image.new('RGBA', (size * 6, size * 5))
    for i, frame in enumerate(frames):
        resized = frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
                               Image.Resampling.NEAREST)
        resized = base.content(base.indexed(resized, colors))
        sheet.alpha_composite(resized, ((i % 6) * size + (size - resized.width) // 2,
                                       (i // 6) * size + baseline - resized.height))
    sheet.save(ART / 'boss-monarch.png', optimize=True)
    manifest['actors']['boss-monarch'] = {'frameSize': size, 'anchor': [size // 2, baseline],
                                          'columns': 6, 'rows': 5}
    manifest.setdefault('palettes', {})['boss-monarch'] = ['#' + bytes(c).hex() for c in colors]
    sheet.crop((0, 0, size, size)).resize((960, 960), Image.Resampling.NEAREST).save(HERE / 'monarch-preview.png')

    floor = source('castle-hall-floor', False).resize((1024, 1024), Image.Resampling.NEAREST)
    # Retain texture resolution and a generous material palette while avoiding
    # transfer bytes spent on imperceptible generated subpixel color noise.
    floor = base.indexed(floor, normalizer.palette([floor], 256))
    floor.putalpha(255)
    floor.save(ART / 'castle-hall-floor.png', optimize=True)
    decor = slots(source('castle-hall-decor'), 3, 2)
    decor_sheet = Image.new('RGBA', (1536, 256))
    for i, frame in enumerate(decor):
        ratio = min(240 / frame.width, 234 / frame.height)
        frame = frame.resize((max(1, round(frame.width * ratio)), max(1, round(frame.height * ratio))), Image.Resampling.NEAREST)
        decor_sheet.alpha_composite(frame, (i * 256 + (256 - frame.width) // 2, 244 - frame.height))
    decor_sheet.save(ART / 'castle-hall-decor.png', optimize=True)
    decor_sheet.save(HERE / 'decor-preview.png', optimize=True)
    manifest['castleHall'] = {'floor': {'file': 'castle-hall-floor.png', 'width': 1024, 'height': 1024},
                             'decor': {'file': 'castle-hall-decor.png', 'frameSize': 256, 'columns': 6,
                                       'rows': 1, 'anchor': [128, 244]},
                             'reference': 'lumen-castle-concept/world-boss-creatures-v2.png'}
    for name in ['boss-monarch.png', 'castle-hall-floor.png', 'castle-hall-decor.png']:
        manifest['files'].setdefault(name, {}).update(descriptor(ART / name))
    for path in sorted((HERE / 'sources').glob('*.png')):
        manifest.setdefault('sources', {})['castle-fidelity/' + path.name] = descriptor(path)
    build_pack(ART, manifest)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'monarch': manifest['actors']['boss-monarch'],
                      'sheets': len(manifest['files']), 'packs': len(manifest['packs']),
                      'transferBytes': sum(p['bytes'] for p in manifest['packs']),
                      'largestPack': max(p['bytes'] for p in manifest['packs'])}))


if __name__ == '__main__':
    main()
