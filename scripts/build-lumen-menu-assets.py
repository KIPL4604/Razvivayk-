"""Fingerprint menu assets; no campaign packs are added to initial loading."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'webapp/frontend/assets/lumen'
names = ['fonts/Tektur-game.ttf','ui.png','panel.png','weapons.png','arsenal.png','expedition.png','expansion-items.png']
# catalog entries are supplied by Node, so keep the build independent of hand-maintained hero names.
import subprocess
catalog = subprocess.check_output(['node','--input-type=module','-e',"import{CHARACTERS}from'./webapp/frontend/js/lumen/catalog.mjs';console.log(JSON.stringify(Object.keys(CHARACTERS)))"], cwd=root.parents[3], text=True)
names += [hero+'.png' for hero in json.loads(catalog)]
names += ['story-world-'+world+'-small.webp' for world in ['garden','quarry','castle']]
names += [str(path.relative_to(root)).replace('\\','/') for path in sorted((root/'weapon-icons').glob('*.webp'))]
entries = []
for name in names:
    blob = (root/name).read_bytes()
    entries.append(dict(file=name, bytes=len(blob), sha256=hashlib.sha256(blob).hexdigest()))
scenes = []
for path in sorted(root.glob('story-*')):
    if path.suffix not in ('.webp','.png') or path.name in names:
        continue
    blob = path.read_bytes()
    scenes.append(dict(file=path.name, bytes=len(blob), sha256=hashlib.sha256(blob).hexdigest()))
backgrounds=[]
for path in sorted((root/'menu-backgrounds').glob('*.webp')):
    blob=path.read_bytes()
    backgrounds.append(dict(file='menu-backgrounds/'+path.name,bytes=len(blob),sha256=hashlib.sha256(blob).hexdigest()))
(root/'menu-manifest.json').write_text(json.dumps(dict(version=1,files=entries,scenes=scenes,backgrounds=backgrounds),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(files=len(entries),bytes=sum(x['bytes'] for x in entries))))
