"""Pack Lumen's existing PNG sheets into bounded deterministic transfers."""

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
        entry['pack'] = f'sprites-{len(packs):02d}.pack'
        entry['offset'] = len(payload)
        entry['packBytes'] = len(transfer)
        payload.extend(transfer)
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
