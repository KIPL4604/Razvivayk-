"""Production-asset integrity gates. Run: python tests/test_lumen_art.py."""
import hashlib
from io import BytesIO
import json
from pathlib import Path
import unittest
try:
    from PIL import Image
except ImportError:
    Image = None

ART = Path(__file__).resolve().parents[1] / 'webapp/frontend/assets/lumen'


class LumenArtTests(unittest.TestCase):
    def test_manifest_matches_all_production_textures(self):
        manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(set(manifest['animations']), {'idle', 'walk', 'attack', 'hurt', 'death'})
        for name, entry in manifest['files'].items():
            with self.subTest(name=name):
                data = (ART / name).read_bytes()
                self.assertEqual(len(data), entry['bytes'])
                self.assertEqual(hashlib.sha256(data).hexdigest(), entry['sha256'])
        for entry in [manifest['font'], manifest['cover']]:
            self.assertEqual(hashlib.sha256((ART / entry['file']).read_bytes()).hexdigest(), entry['sha256'])

    @unittest.skipIf(Image is None, 'Install design/lumen-pixel/requirements.txt for pixel checks')
    def test_runtime_pack_matches_every_manifest_texture(self):
        manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
        packs = {}
        for descriptor in manifest['packs']:
            pack = (ART / descriptor['file']).read_bytes()
            self.assertEqual(len(pack), descriptor['bytes'])
            self.assertLessEqual(len(pack), 220_000)
            self.assertEqual(hashlib.sha256(pack).hexdigest(), descriptor['sha256'])
            packs[descriptor['file']] = pack
        offsets = dict.fromkeys(packs, 0)
        for name, entry in manifest['files'].items():
            with self.subTest(name=name):
                self.assertEqual(entry['offset'], offsets[entry['pack']])
                encoded = packs[entry['pack']][entry['offset']:entry['offset'] + entry['packBytes']]
                with Image.open(BytesIO(encoded)) as converted, Image.open(ART / name) as original:
                    self.assertEqual(converted.convert('RGBA').tobytes(), original.convert('RGBA').tobytes())
                offsets[entry['pack']] += entry['packBytes']
        for name, pack in packs.items():
            self.assertEqual(offsets[name], len(pack))

    @unittest.skipIf(Image is None, 'Offline pixel checks: install design/lumen-pixel/requirements.txt')
    def test_actor_frames_have_hard_alpha_shared_palette_and_baseline(self):
        manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(manifest['actors']), 34)
        for actor, data in manifest['actors'].items():
            palette = {tuple(bytes.fromhex(color[1:])) for color in manifest.get('palettes', {}).get(actor, manifest['palette'])}
            size=data['frameSize']; baseline=data['anchor'][1]
            image = Image.open(ART / (actor + '.png')).convert('RGBA')
            self.assertEqual(image.size, (size*6, size*5))
            self.assertEqual(set(image.getchannel('A').get_flattened_data()), {0, 255})
            colors = {pixel[:3] for pixel in image.get_flattened_data() if pixel[3]}
            self.assertTrue(colors.issubset(palette))
            for row in range(5):
                frames = []
                for col in range(6):
                    frame = image.crop((col * size, row * size, col * size + size, row * size + size))
                    bbox = frame.getbbox()
                    self.assertIsNotNone(bbox, f'{actor} row={row} col={col}')
                    self.assertLessEqual(bbox[2] - bbox[0], size-4)
                    self.assertEqual(bbox[3], baseline, f'{actor} baseline row={row} col={col}')
                    frames.append(frame.tobytes())
                self.assertGreater(len(set(frames)), 1, f'{actor} animation row={row} is static')

    @unittest.skipIf(Image is None, 'Offline pixel checks: install design/lumen-pixel/requirements.txt')
    def test_tile_prop_and_ui_cells(self):
        for name, size in [('tiles.png', (128, 32)), ('garden.png', (256, 64)), ('quarry-tiles.png',(128,32)), ('quarry-props.png',(256,64)), ('ui.png', (256, 16)), ('weapons.png',(384,48)), ('arsenal.png',(384,192)), ('expedition.png',(240,96)), ('expansion-items.png',(384,96))]:
            with Image.open(ART / name) as image:
                self.assertEqual(image.size, size)
                if name.startswith('quarry-'):
                    pixels=list(image.convert('RGBA').get_flattened_data())
                    self.assertTrue({p[3] for p in pixels}.issubset({0,255}))
                    self.assertLessEqual(len({p[:3] for p in pixels if p[3]}),48)
                    if name=='quarry-tiles.png': self.assertEqual({p[3] for p in pixels},{255})
        manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
        self.assertIn('SIL OPEN FONT LICENSE', (ART / manifest['font']['license']).read_text(encoding='utf-8'))

    @unittest.skipIf(Image is None, 'Offline pixel checks: install design/lumen-pixel/requirements.txt')
    def test_expansion_icons_are_distinct_and_sources_are_reproducible(self):
        with Image.open(ART / 'expansion-items.png') as sheet:
            sheet = sheet.convert('RGBA')
            self.assertEqual(set(sheet.getchannel('A').get_flattened_data()), {0, 255})
            cells = [sheet.crop((col*48, row*48, (col+1)*48, (row+1)*48))
                     for row in range(2) for col in range(8)]
            self.assertEqual(len({cell.tobytes() for cell in cells}), 16)
            for cell in cells:
                bounds = cell.getbbox()
                self.assertIsNotNone(bounds)
                self.assertGreaterEqual(bounds[0], 2)
                self.assertLessEqual(bounds[2], 46)
                self.assertGreater(sum(1 for p in cell.get_flattened_data() if p[3]), 100)
        manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
        sources = ART.parents[3] / 'design/lumen-expansion/sources'
        for name in ['tinkerer', 'cantor', 'astronomer', 'heliarch', 'items']:
            file = name + '-raw.png'
            data = (sources / file).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), manifest['sources']['expansion/' + file]['sha256'])

    @unittest.skipIf(Image is None, 'Offline pixel checks: install design/lumen-pixel/requirements.txt')
    def test_xp_tiers_share_the_same_crystal_mask_and_colored_facets(self):
        with Image.open(ART / 'combat.png') as sheet:
            cells = [sheet.crop((i*32, 0, (i+1)*32, 32)).convert('RGBA') for i in [4,5,6]]
            self.assertEqual(len({c.getchannel('A').tobytes() for c in cells}), 1)
            self.assertEqual(len({c.tobytes() for c in cells}), 3)
            self.assertEqual(len({c.getbbox() for c in cells}), 1)
            for cell, color in zip(cells, [(141,201,238), (255,211,111), (244,173,195)]):
                self.assertEqual(cell.getpixel((18,18))[:3], color)

    @unittest.skipIf(Image is None, 'Offline pixel checks: install design/lumen-pixel/requirements.txt')
    def test_arena_environment_fx_and_treasure_have_runtime_frames(self):
        manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
        for name, size, columns, rows in [('mega-chest',96,6,1), ('arena-fx',64,6,5),
                                          ('crater-tiles',32,4,1), ('crater-props',64,4,1)]:
            with Image.open(ART / (name + '.png')) as raw:
                sheet = raw.convert('RGBA')
                self.assertEqual(sheet.size, (size*columns, size*rows))
                self.assertTrue(set(sheet.getchannel('A').get_flattened_data()).issubset({0,255}))
                if name == 'crater-tiles':
                    self.assertEqual(set(sheet.getchannel('A').get_flattened_data()), {255})
                for row in range(rows):
                    frames = [sheet.crop((col*size,row*size,(col+1)*size,(row+1)*size)) for col in range(columns)]
                    self.assertEqual(len({frame.tobytes() for frame in frames}), columns)
                    for frame in frames:
                        self.assertIsNotNone(frame.getbbox(), f'{name} row={row}')
                        self.assertGreater(sum(1 for p in frame.get_flattened_data() if p[3]), 3)
        for name in ['boss-carapace','boss-tempest','boss-matriarch','arena-tick',
                     'mega-chest','crater-environment','arena-fx']:
            source = ART.parents[3] / 'design/lumen-arena/sources' / (name + '-raw.png')
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),
                             manifest['sources']['arena/' + source.name]['sha256'])


    @unittest.skipIf(Image is None, 'Install Pillow for castle atlas checks')
    def test_castle_approved_cast_and_environment_are_packaged(self):
        manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
        names = ['castle-guard', 'castle-wax', 'castle-moth', 'boss-conductor',
                 'boss-gatekeeper', 'boss-monarch']
        self.assertTrue(set(names).issubset(manifest['actors']))
        for name, size in [('castle-tiles', (256, 32)), ('castle-props', (768, 128)),
                           ('castle-floor', (512, 128))]:
            with Image.open(ART / (name + '.png')) as image:
                self.assertEqual(image.size, size)
                alpha = set(image.convert('RGBA').getchannel('A').get_flattened_data())
                self.assertEqual(alpha, {0,255} if name == 'castle-props' else {255})
                width = 32 if name == 'castle-tiles' else 128
                for x in range(0, image.width, width):
                    self.assertIsNotNone(image.crop((x, 0, x + width, image.height)).getbbox())
        for name in names + ['castle-environment', 'castle-furnishings']:
            source = ART.parents[3] / 'design/lumen-castle/sources' / (name + '-raw.png')
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),
                             manifest['sources']['castle/' + source.name]['sha256'])


    @unittest.skipIf(Image is None, 'Install Pillow for authored projectile/door checks')
    def test_enemy_flight_frames_and_breakable_door_are_authored_and_transparent(self):
        manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['enemyProjectiles']['families'], ['ruby', 'amber', 'wax', 'paper'])
        with Image.open(ART / 'enemy-projectiles.png') as raw:
            image=raw.convert('RGBA')
            self.assertEqual(image.size,(192,128))
            self.assertEqual(set(image.getchannel('A').get_flattened_data()),{0,255})
            for row in range(4):
                frames=[image.crop((col*32,row*32,(col+1)*32,(row+1)*32)) for col in range(6)]
                self.assertEqual(len({f.tobytes() for f in frames}),6)
                for frame in frames:
                    self.assertIsNotNone(frame.crop((21,11,30,22)).getbbox(), 'Dangerous head must remain visible near its anchor')
        with Image.open(ART / 'castle-door.png') as raw:
            image=raw.convert('RGBA')
            self.assertEqual(image.size,(1536,256))
            self.assertEqual(set(image.getchannel('A').get_flattened_data()),{0,255})
            self.assertEqual(image.getpixel((128,140))[3],255)
            self.assertEqual(image.getpixel((5*256+128,140))[3],0,'Broken portal must have a transparent opening')
            self.assertEqual(len({image.crop((i*256,0,(i+1)*256,256)).tobytes() for i in range(6)}),6)
        for name in ['enemy-projectiles-raw.png','castle-door-raw.png']:
            source=ART.parents[3]/'design/lumen-castle-polish/sources'/name
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),manifest['sources']['castle-polish/'+name]['sha256'])


if __name__ == '__main__':
    unittest.main()
