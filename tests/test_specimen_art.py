"""Integrity of original prototype assets; image checks are optional without Pillow."""
import hashlib
import json
from pathlib import Path
import struct
import unittest
try:
    from PIL import Image
except ImportError:
    Image=None

ART=Path(__file__).resolve().parents[1]/'webapp/frontend/assets/specimen'

class SpecimenArtTests(unittest.TestCase):
    def test_manifest_and_png_dimensions(self):
        m=json.loads((ART/'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(m['environmentSlots'],16)
        self.assertEqual(m['fixtureSlots'],12)
        self.assertEqual(m['sectorSlots'],16)
        self.assertEqual(m['tissueSlots'],8)
        self.assertEqual(m['people']['frames']*m['people']['rows'],12)
        for name,f in m['files'].items():
            data=(ART/name).read_bytes()
            self.assertEqual(data[:8],b'\x89PNG\r\n\x1a\n')
            self.assertEqual(list(struct.unpack('>II',data[16:24])),f['size'])
            self.assertEqual(len(data),f['bytes'])
            self.assertEqual(hashlib.sha256(data).hexdigest(),f['sha256'])
        self.assertLess(sum(f['bytes'] for f in m['files'].values()),800_000)

    @unittest.skipIf(Image is None,'Install Pillow for pixel frame checks')
    def test_every_actor_frame_and_organic_slot_has_visible_alpha(self):
        people=Image.open(ART/'people.png').convert('RGBA')
        for row in range(2):
            for col in range(6):
                alpha=people.crop((col*64,row*64,(col+1)*64,(row+1)*64)).getchannel('A')
                box=alpha.getbbox()
                self.assertIsNotNone(box)
                self.assertLessEqual(box[3],58)
                self.assertEqual(alpha.getpixel((0,0)),0)
        atlas=Image.open(ART/'atlas.png').convert('RGBA')
        for index in range(4,16):
            x,y=index%4*64,index//4*64
            alpha=atlas.crop((x,y,x+64,y+64)).getchannel('A')
            self.assertIsNotNone(alpha.getbbox())
            self.assertEqual(alpha.getpixel((0,0)),0)

    @unittest.skipIf(Image is None,'Install Pillow for fixture checks')
    def test_all_laboratory_fixtures_have_visible_alpha(self):
        sheet=Image.open(ART/'fixtures.png').convert('RGBA')
        for i in range(12):
            x,y=(i%4)*64,(i//4)*64
            self.assertIsNotNone(sheet.crop((x,y,x+64,y+64)).getchannel('A').getbbox())

    @unittest.skipIf(Image is None,'Install Pillow for reference atlas checks')
    def test_reference_atlases_have_visible_slots_and_crimson_tissue(self):
        for name,size,count in [('sector.png',128,16),('tissue.png',96,8)]:
            sheet=Image.open(ART/name).convert('RGBA')
            for i in range(count):
                x,y=i%4*size,i//4*size
                self.assertIsNotNone(sheet.crop((x,y,x+size,y+size)).getchannel('A').getbbox())
        raw=Image.open(ART/'tissue.png').convert('RGBA').tobytes()
        pixels=[raw[i:i+3] for i in range(0,len(raw),4) if raw[i+3]>128]
        self.assertGreater(sum(r for r,g,b in pixels),3*sum(g for r,g,b in pixels))

if __name__=='__main__':
    unittest.main()
