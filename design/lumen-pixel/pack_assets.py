"""Pack lossless artwork into bounded transfers without reducing texture detail.

Small WebP images retain their original single-range entry. Larger images use
ordered byte chunks; the browser joins them before decoding the complete WebP.
The source PNGs are never resized or rewritten here.
"""

from pathlib import Path
from io import BytesIO
import hashlib
import json
import sys
from PIL import Image


def build_pack(art_dir: Path, manifest: dict, *, content_addressed: bool = False) -> None:
    limit = 220_000
    packs = []
    payload = bytearray()
    aliases = {}

    def pending_name():
        return f'sprites-{len(packs):02d}.pack'

    def flush() -> None:
        if not payload:
            return
        data = bytes(payload)
        sha = hashlib.sha256(data).hexdigest()
        pack_name = f'sprites-garden-{sha}.pack' if content_addressed else pending_name()
        aliases[pending_name()] = pack_name
        (art_dir / pack_name).write_bytes(data)
        packs.append({'file': pack_name, 'bytes': len(data), 'sha256': sha})
        payload.clear()

    for name, entry in manifest['files'].items():
        data = (art_dir / name).read_bytes()
        if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise ValueError(f'Artwork changed after manifest generation: {name}')
        encoded = BytesIO()
        with Image.open(BytesIO(data)) as image:
            image.save(encoded, format='WEBP', lossless=True, method=6, exact=True)
        transfer = encoded.getvalue()
        if payload and len(payload) + len(transfer) > limit:
            flush()
        if len(transfer) <= limit:
            entry.pop('chunks', None)
            entry['pack'] = pending_name()
            entry['offset'] = len(payload)
            entry['packBytes'] = len(transfer)
            payload.extend(transfer)
            continue

        # A PNG atlas stays whole. Only its encoded transport bytes cross pack
        # boundaries, so animation anchors and every decoded RGBA pixel survive.
        for key in ('pack', 'offset', 'packBytes'):
            entry.pop(key, None)
        entry['chunks'] = []
        cursor = 0
        while cursor < len(transfer):
            size = min(limit - len(payload), len(transfer) - cursor)
            entry['chunks'].append({'pack': pending_name(),
                                    'offset': len(payload), 'bytes': size})
            payload.extend(transfer[cursor:cursor + size])
            cursor += size
            if len(payload) == limit:
                flush()
    flush()
    if content_addressed:
        for entry in manifest['files'].values():
            for chunk in entry.get('chunks', [entry]):
                chunk['pack'] = aliases[chunk['pack']]
    manifest.pop('pack', None)
    manifest['packs'] = packs
    manifest['packFormat'] = 'image/webp'


def build_garden_pilot(art_dir: Path, manifest: dict) -> None:
    # Separate the starter set, boss art and each hero. Sharing a pack across
    # these boundaries would make loading one group transfer the other groups.
    opening = ('tiles garden mote beetle wasp crawler spitter wisp arsenal combat fx ui '
               'expedition expansion-items arena-fx arena-tick enemy-projectiles mega-chest').split()
    bosses = 'boss-briar boss-queen boss-ash boss-rootwarden'.split()
    heroes = 'scout keeper alchemist ranger duelist stormcaller artificer sentinel tinkerer cantor astronomer heliarch'.split()
    groups = {'opening': opening, 'bosses': bosses, **{hero: [hero] for hero in heroes}}
    result = {key: manifest[key] for key in ('version', 'frameSize', 'animations', 'actors', 'packFormat')}
    result.update(files={}, packs=[], groups={})
    for label, names in groups.items():
        files = {name + '.png': dict(manifest['files'][name + '.png']) for name in names}
        group = {'files': files}
        build_pack(art_dir, group, content_addressed=True)
        result['files'].update(files)
        result['packs'].extend(group['packs'])
        result['groups'][label] = list(files)
    result['actors'] = {name: info for name, info in result['actors'].items() if name + '.png' in result['files']}
    (art_dir / 'garden-pilot.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    art_dir = root / 'webapp/frontend/assets/lumen'
    manifest_path = art_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if '--garden-only' not in sys.argv:
        build_pack(art_dir, manifest)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(manifest['packs']))
    build_garden_pilot(art_dir, manifest)
