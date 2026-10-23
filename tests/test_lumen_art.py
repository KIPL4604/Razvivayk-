"""Production-asset integrity gates. Run: python tests/test_lumen_art.py."""
import hashlib
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

    @unittest.skipIf(Image is None, 'Offline pixel checks: install design/lumen-pixel/requirements.txt')
    def test_actor_frames_have_hard_alpha_shared_palette_and_baseline(self):
        manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(manifest['actors']), 24)
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


if __name__ == '__main__':
    unittest.main()
