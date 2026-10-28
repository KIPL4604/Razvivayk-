"""Pack lossless artwork into bounded transfers without reducing texture detail.

Small WebP images retain their original single-range entry. Larger images use
ordered byte chunks; the browser joins them before decoding the complete WebP.
The source PNGs are never resized or rewritten here.
"""

from pathlib import Path
from io import BytesIO
import hashlib
import json
from PIL import Image


def build_pack(art_dir: Path, manifest: dict) -> None:
    limit = 220_000
    packs = []
    payload = bytearray()

    def flush() -> None:
        if not payload:
            return
        pack_name = f'sprites-{len(packs):02d}.pack'
        data = bytes(payload)
        (art_dir / pack_name).write_bytes(data)
        packs.append({'file': pack_name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
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
            entry['pack'] = f'sprites-{len(packs):02d}.pack'
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
            entry['chunks'].append({'pack': f'sprites-{len(packs):02d}.pack',
                                    'offset': len(payload), 'bytes': size})
            payload.extend(transfer[cursor:cursor + size])
            cursor += size
            if len(payload) == limit:
                flush()
    flush()
    manifest.pop('pack', None)
    manifest['packs'] = packs
    manifest['packFormat'] = 'image/webp'


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    art_dir = root / 'webapp/frontend/assets/lumen'
    manifest_path = art_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    build_pack(art_dir, manifest)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(manifest['packs']))
