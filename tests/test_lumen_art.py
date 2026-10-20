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
        palette = {tuple(bytes.fromhex(color[1:])) for color in manifest['palette']}
        for actor in ['scout', 'mote', 'beetle', 'wasp']:
            image = Image.open(ART / (actor + '.png')).convert('RGBA')
            self.assertEqual(image.size, (288, 240))
            self.assertEqual(set(image.getchannel('A').get_flattened_data()), {0, 255})
            colors = {pixel[:3] for pixel in image.get_flattened_data() if pixel[3]}
            self.assertTrue(colors.issubset(palette))
            for row in range(5):
                frames = []
                for col in range(6):
                    frame = image.crop((col * 48, row * 48, col * 48 + 48, row * 48 + 48))
                    bbox = frame.getbbox()
                    self.assertIsNotNone(bbox, f'{actor} row={row} col={col}')
                    self.assertLessEqual(bbox[2] - bbox[0], 44)
                    self.assertEqual(bbox[3], 45, f'{actor} baseline row={row} col={col}')
                    frames.append(frame.tobytes())
                self.assertGreater(len(set(frames)), 1, f'{actor} animation row={row} is static')

    @unittest.skipIf(Image is None, 'Offline pixel checks: install design/lumen-pixel/requirements.txt')
    def test_tile_prop_and_ui_cells(self):
        for name, size in [('tiles.png', (128, 32)), ('garden.png', (256, 64)), ('ui.png', (256, 16))]:
            with Image.open(ART / name) as image:
                self.assertEqual(image.size, size)
        manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
        self.assertIn('SIL OPEN FONT LICENSE', (ART / manifest['font']['license']).read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
