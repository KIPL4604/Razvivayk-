"""Rebuild the first Lumen PNG art slice. Python 3 + Pillow 12; no network/API.

Sprite-pipeline workflow: full-sheet source, one scale per actor, bottom-center
anchor, nearest sampling, fixed palette, binary alpha. Sources remain untouched.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).parent / 'sources'
DEST = ROOT / 'webapp/frontend/assets/lumen'
PALETTE = [
    '111b25', '17262e', '1c3338', '25434a', '29504a', '376157', '49725c', '648269',
    '75945b', '98ac76', '83cda4', 'a4dbb1', 'c5e8ba', 'e5f3d1', 'f1dfaf', 'ddc994',
    'c3ac7c', 'a58c60', '876a4e', '6b503c', '533f3d', '392e35', '75463d', '94533f',
    'b66b45', 'cd8050', 'e39b5d', 'efbe7c', '647488', '8b96a4', 'b6b8b0', 'ca7970',
    '466d9f', '749ed0', '8dc9ee', 'd9f2ff', '6b4c94', '9b8cc4', 'c1a4eb', 'ebd5fa',
    'a54164', 'db6983', 'f4adc3', 'ffe0cb', 'c58c45', 'ffd36f', 'fff2bd', 'f27358',
]
RGB = [tuple(bytes.fromhex(color)) for color in PALETTE]
STATES = ['idle', 'walk', 'attack', 'hurt', 'death']


def indexed(image, colors=RGB):
    """Use the same explicit palette and hard alpha for every runtime bitmap."""
    image = image.convert('RGBA')
    alpha = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    swatch = Image.new('P', (1, 1))
    swatch.putpalette([c for color in colors for c in color] + list(colors[0]) * (256 - len(colors)))
    result = image.convert('RGB').quantize(palette=swatch, dither=Image.Dither.NONE).convert('RGBA')
    result.putalpha(alpha)
    return result


def content(image):
    image = image.convert('RGBA')
    bbox = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    if not bbox:
        raise ValueError('Empty source sprite')
    return image.crop(bbox)


def actor_content(image):
    """Discard detached scraps from neighboring generated slots, not body pixels."""
    image = image.convert('RGBA')
    alpha = image.getchannel('A')
    occupied = {(x, y) for y in range(image.height) for x in range(image.width) if alpha.getpixel((x, y)) >= 128}
    groups = []
    while occupied:
        first = occupied.pop(); group = {first}; pending = [first]
        while pending:
            x, y = pending.pop()
            for point in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if point in occupied:
                    occupied.remove(point); group.add(point); pending.append(point)
        groups.append(group)
    largest = max(map(len, groups))
    keep = set().union(*(group for group in groups if len(group) >= max(12, largest * .08)))
    mask = Image.new('L', image.size)
    for point in keep:
        mask.putpixel(point, 255)
    image.putalpha(mask)
    return content(image)


def slot(image, col, row, cols, rows):
    return image.crop((round(col * image.width / cols), round(row * image.height / rows),
                       round((col + 1) * image.width / cols), round((row + 1) * image.height / rows)))


def actor(name, height):
    raw = Image.open(SOURCE / f'{name}-raw.png').convert('RGBA')
    # Reviewed source gaps; generated atlases are not perfectly even in Y.
    if name == 'wasp':
        # Remove the low-alpha generated chroma fringe, retain the source unchanged.
        pixels = raw.load()
        for y in range(raw.height):
            for x in range(raw.width):
                r,g,b,a = pixels[x,y]
                if a < 192 or (r > 190 and g < 100 and b > 150) or (r < 80 and g < 100 and b > 170):
                    pixels[x,y] = (0,0,0,0)
    rows = {'scout': [264,480,700,916], 'mote': [257,475,695,915],
            'beetle': [245,470,700,920], 'wasp': [245,475,700,920]}
    boundaries = [0,*rows[name],raw.height]
    frames = [actor_content(raw.crop((round(col * raw.width / 6), boundaries[row],
                                     round((col + 1) * raw.width / 6), boundaries[row + 1])))
              for row in range(5) for col in range(6)]
    # One global scale: death frames never grow to fill the available cell.
    scale = min(44 / max(f.width for f in frames), height / max(f.height for f in frames))
    atlas = Image.new('RGBA', (48 * 6, 48 * 5))
    for index, frame in enumerate(frames):
        colors = RGB[:32] if name in ['scout','mote'] else RGB
        frame = content(indexed(frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.NEAREST),colors))
        atlas.alpha_composite(frame, ((index % 6) * 48 + (48 - frame.width) // 2,
                                      (index // 6) * 48 + 45 - frame.height))
    atlas.save(DEST / f'{name}.png', optimize=True)
    return atlas


def environment():
    raw = Image.open(SOURCE / 'garden-color-raw.png').convert('RGBA')
    floor = Image.open(SOURCE / 'floor-raw.png').convert('RGBA')
    tiles = Image.new('RGBA', (128, 32))
    props = Image.new('RGBA', (256, 64))
    for col in range(4):
        # Reviewed single-slab source: crop generated top/bottom gutters.
        tile = floor.crop((col * 512, 62, (col + 1) * 512, 574))
        tile = tile.resize((32, 32), Image.Resampling.NEAREST)
        tile = indexed(tile, [RGB[i] for i in [1, 2, 3, 4, 5]])
        tiles.alpha_composite(tile, (32 * col, 0))
        prop = content(slot(raw, col, 1, 4, 2))
        scale = min(60 / prop.width, 60 / prop.height)
        prop = indexed(prop.resize((round(prop.width * scale), round(prop.height * scale)), Image.Resampling.NEAREST))
        props.alpha_composite(prop, (64 * col + (64 - prop.width) // 2, 62 - prop.height))
    tiles.save(DEST / 'tiles.png', optimize=True)
    props.save(DEST / 'garden.png', optimize=True)


def ui():
    # Editable pixel source for original device glyphs. No icon library/emoji.
    glyphs = [
        ['...aa...', '..abba..', '.abccba.', '.abccba.', '..abba..', '...aa...', '...aa...', '..aaaa..'],
        ['..aaaa..', '.ab..ba.', 'ab.cc.ba', 'a.cddc.a', 'a.cddc.a', 'ab.cc.ba', '.ab..ba.', '..aaaa..'],
        ['...aa...', '..abba..', '.abccba.', 'abcaacba', '.abccba.', '..abba..', '...aa...', '........'],
        ['..aaaa..', '.abccba.', 'abccccba', 'abccccba', '.abccba.', '..aaaa..', '...aa...', '..aaaa..'],
        ['..a..a..', '.ab.ab..', 'abcabc..', '.ab.ab..', '..a..a..', '........', '........', '........'],
        ['..aaa...', '..abba..', '..abba..', '..aaa...', '.abba...', '.abba...', 'aaaaa...', '........'],
        ['.aa..aa.', 'abbaabba', 'abbaabba', 'ab....ba', 'ab....ba', 'ab....ba', '.abbbba.', '..aaaa..'],
        ['.aa..aa.', 'abbabbba', 'abccccba', 'abccccba', '.abccba.', '..abba..', '...aa...', '........'],
        ['...aa...', '...bb...', '...bb...', 'aabbbbaa', 'abbbbbba', '...bb...', '...bb...', '...aa...'],
        ['.aa..aa.', '.bb..bb.', '.bb..bb.', '.bb..bb.', '.bb..bb.', '.bb..bb.', '.aa..aa.', '........'],
        ['aaa..aaa', 'ab....ba', 'a......a', '........', '........', 'a......a', 'ab....ba', 'aaa..aaa'],
        ['...a....', '..ab....', '.abb.aa.', 'abbb..ba', 'abbb..ba', '.abb.aa.', '..ab....', '...a....'],
        ['...a....', '..ab....', '.abb.a.a', 'abbb..a.', 'abbb.a.a', '.abb....', '..ab....', '...a....'],
        ['...aa...', '..abba..', '.abccba.', 'abccccba', '.abccba.', '..abba..', '...aa...', '........'],
        ['........', '...aa...', '..abba..', '.abccba.', '..abba..', '...aa...', '........', '........'],
        ['...a....', '..aaa...', '...a....', '........', '.a...a..', 'aaa.aaa.', '.a...a..', '........'],
    ]
    atlas = Image.new('RGBA', (16 * len(glyphs), 16))
    colors = {'a': '#876a4e', 'b': '#83cda4', 'c': '#c5e8ba', 'd': '#f1dfaf'}
    for index, lines in enumerate(glyphs):
        for y, line in enumerate(lines):
            for x, char in enumerate(line):
                if char in colors:
                    atlas.putpixel((index * 16 + x + 4, y + 4), (*bytes.fromhex(colors[char][1:]), 255))
    atlas.save(DEST / 'ui.png', optimize=True)
    # Pixel nine-slice stone/copper frame, 3px source borders.
    panel = Image.new('RGBA', (12, 12), '#17262e')
    draw = ImageDraw.Draw(panel)
    draw.rectangle((1, 0, 10, 11), fill='#a58c60')
    draw.rectangle((0, 1, 11, 10), fill='#a58c60')
    draw.rectangle((1, 1, 10, 10), fill='#29504a')
    draw.line((2, 2, 9, 2), fill='#648269')
    draw.rectangle((3, 3, 8, 8), fill='#17262e')
    draw.point((1, 1), fill='#f1dfaf'); draw.point((10, 1), fill='#f1dfaf')
    panel.save(DEST / 'panel.png')
    # Original particle/shadow pixels used as composited textures, not actors.
    fx = Image.new('RGBA', (64, 16))
    draw = ImageDraw.Draw(fx)
    draw.ellipse((1, 6, 15, 12), fill='#111b2580')
    draw.polygon([(24, 3), (28, 8), (24, 13), (20, 8)], fill='#83cda4')
    draw.line((24, 4, 22, 8), fill='#e5f3d1')
    for x, y in [(37, 4), (42, 7), (38, 11), (44, 12)]:
        draw.rectangle((x, y, x + 1, y + 1), fill='#c5e8ba')
    draw.line((49, 8, 61, 8), fill='#83cda4', width=3)
    draw.rectangle((59, 6, 62, 9), fill='#e5f3d1')
    fx.save(DEST / 'fx.png')


def combat_art():
    """Editable native pixel source. Distinct weapon shapes and gem silhouettes."""
    sheet = Image.new('RGBA',(256,32))
    ink='#111b25'; gold='#ffd36f'; cream='#fff2bd'; blue='#8dc9ee'; ice='#d9f2ff'; purple='#c1a4eb'
    for i in range(8):
        cell=Image.new('RGBA',(32,32)); d=ImageDraw.Draw(cell)
        if i==0:  # Fast directed golden bolt, readable horizontal silhouette.
            d.polygon([(3,14),(17,14),(17,8),(29,16),(17,24),(17,18),(3,18)],fill=ink)
            d.polygon([(5,15),(19,15),(19,11),(26,16),(19,21),(19,17),(5,17)],fill=gold)
            d.line((12,16,23,16),fill=cream,width=2)
        elif i==1:  # Blue crescent blade for orbit.
            d.polygon([(7,3),(24,8),(28,18),(19,29),(23,18),(17,11),(7,8)],fill=ink)
            d.polygon([(8,5),(23,10),(25,18),(20,25),(21,17),(16,11),(8,7)],fill=blue)
            d.line([(9,5),(22,10),(24,16)],fill=ice,width=2)
            d.rectangle((13,13,17,17),fill='#466d9f')
        elif i==2:  # Violet shockwave bead, different from projectiles and blades.
            d.polygon([(16,4),(19,12),(27,16),(19,20),(16,28),(13,20),(5,16),(13,12)],fill=ink)
            d.polygon([(16,7),(18,13),(24,16),(18,19),(16,25),(14,19),(8,16),(14,13)],fill=purple)
            d.rectangle((14,14,17,17),fill='#ebd5fa')
        elif i==3:
            d.polygon([(16,4),(23,10),(28,16),(23,22),(16,28),(9,22),(4,16),(9,10)],fill=ink)
            d.polygon([(16,7),(25,16),(16,25),(7,16)],fill='#f27358')
            d.polygon([(16,11),(21,16),(16,21),(11,16)],fill='#ffe0cb')
        elif i in [4,5,6]:
            color=[blue,gold,'#f4adc3'][i-4]
            if i==4:
                points=[(16,3),(23,12),(21,23),(16,29),(11,23),(9,12)]
                d.polygon(points,fill=ink);d.polygon([(16,6),(21,13),(19,22),(16,26),(13,22),(11,13)],fill=color)
                d.line([(16,7),(13,13),(14,20)],fill=ice,width=2)
            elif i==5:
                d.polygon([(10,3),(22,3),(29,14),(22,27),(10,27),(3,14)],fill=ink)
                d.polygon([(11,6),(21,6),(26,14),(21,24),(11,24),(6,14)],fill=color)
                d.line([(11,8),(8,14),(12,22)],fill=cream,width=2)
                d.line((16,7,16,23),fill='#c58c45')
            else:
                d.polygon([(8,8),(16,2),(24,8),(30,16),(24,24),(16,30),(8,24),(2,16)],fill=ink)
                d.polygon([(9,10),(16,5),(23,10),(27,16),(22,23),(16,27),(10,22),(5,16)],fill=color)
                d.polygon([(16,8),(22,16),(16,24),(10,16)],fill='#db6983')
                d.line([(15,9),(11,16),(15,21)],fill='#ebd5fa',width=2)
        else:
            for x,y in [(8,8),(23,10),(12,23),(25,24)]:
                d.line((x-2,y,x+2,y),fill=gold);d.line((x,y-2,x,y+2),fill=cream)
        sheet.alpha_composite(cell,(i*32,0))
    sheet.save(DEST/'combat.png',optimize=True)
    weapons=Image.new('RGBA',(96,32))
    for i in range(3):
        cell=Image.new('RGBA',(32,32));d=ImageDraw.Draw(cell)
        if i==0:
            d.line([(7,27),(14,12),(15,5)],fill=ink,width=5)
            d.line([(7,26),(14,12),(15,5)],fill='#b66b45',width=3)
            d.rectangle((10,5,20,14),fill=ink);d.rectangle((12,6,18,12),fill=gold);d.point((14,7),fill=cream)
            d.polygon([(24,3),(20,11),(25,10),(21,20),(29,9),(25,10),(28,3)],fill=gold)
        elif i==1:
            d.ellipse((5,5,26,26),outline='#466d9f',width=2)
            for x,y in [(13,0),(0,19),(21,20)]:
                d.polygon([(x,y),(x+9,y+2),(x+9,y+6),(x+6,y+4),(x,y+3)],fill=ice)
            d.ellipse((12,12,19,19),fill=ink);d.ellipse((14,14,17,17),fill=blue)
        else:
            d.arc((3,3,28,28),10,150,fill=purple,width=3)
            d.arc((3,3,28,28),190,330,fill=purple,width=3)
            d.arc((8,8,23,23),10,150,fill='#ebd5fa',width=2)
            d.arc((8,8,23,23),190,330,fill='#ebd5fa',width=2)
            d.polygon([(16,9),(18,14),(23,16),(18,18),(16,23),(14,18),(9,16),(14,14)],fill=purple)
        weapons.alpha_composite(cell,(i*32,0))
    weapons.save(DEST/'weapons.png',optimize=True)


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    # Static Latin/Cyrillic subset: fonttools 4.x, no brotli/network required.
    from fontTools.ttLib import TTFont
    from fontTools import subset
    from fontTools.varLib.instancer import instantiateVariableFont
    # Higher-detail square outlines, without Tiny5's coarse five-pixel glyph grid.
    font = TTFont(SOURCE / 'Tektur.ttf', recalcTimestamp=False)
    font = instantiateVariableFont(font, {'wdth': 90, 'wght': 600}, inplace=True)
    subsetter = subset.Subsetter()
    subsetter.populate(unicodes=list(range(32, 127)) + list(range(0x400, 0x500)) + [0xb7, 0x2014, 0x2013, 0x2192, 0x221e])
    subsetter.subset(font)
    font.save(DEST / 'fonts/Tektur-game.ttf')
    scout = actor('scout', 42)
    mote = actor('mote', 34)
    beetle=actor('beetle',36);wasp=actor('wasp',32)
    environment(); ui();combat_art()
    enemies=Image.new('RGBA',(576,240),'#17262e');enemies.alpha_composite(beetle,(0,0));enemies.alpha_composite(wasp,(288,0))
    enemies.resize((1152,480),Image.Resampling.NEAREST).save(Path(__file__).parent/'new-enemies-preview.png')
    cover = Image.new('RGBA', (384, 240))
    tile = Image.open(DEST / 'tiles.png').crop((0, 0, 32, 32))
    for y in range(0, 240, 32):
        for x in range(0, 384, 32):
            cover.alpha_composite(tile, (x, y))
    garden = Image.open(DEST / 'garden.png')
    for index, x, y, size in [(1, 2, 125, 112), (3, 280, 10, 128), (0, 127, 3, 128)]:
        prop = garden.crop((index * 64, 0, (index + 1) * 64, 64)).resize((size, size), Image.Resampling.NEAREST)
        cover.alpha_composite(prop, (x, y))
    cover.alpha_composite(scout.crop((0, 0, 48, 48)).resize((96, 96), Image.Resampling.NEAREST), (143, 120))
    for x, y in [(40, 45), (282, 154)]:
        cover.alpha_composite(mote.crop((0, 0, 48, 48)).resize((72, 72), Image.Resampling.NEAREST), (x, y))
    cover.save(DEST / 'cover.png', optimize=True)
    preview = Image.new('RGBA', (288 * 2, 240), '#17262e')
    preview.alpha_composite(scout, (0, 0)); preview.alpha_composite(mote, (288, 0))
    preview.resize((1152, 480), Image.Resampling.NEAREST).save(Path(__file__).parent / 'animation-preview.png')
    # Optional expansion lives beside this historical first-slice builder.
    import importlib.util
    expansion_path=Path(__file__).parent.parent/'lumen-arsenal/build_assets.py'
    expansion={}
    if expansion_path.exists():
        spec=importlib.util.spec_from_file_location('lumen_arsenal_build',expansion_path)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);expansion=module.build()
    campaign_path=Path(__file__).parent.parent/'lumen-campaign/build_assets.py'
    campaign={}
    if campaign_path.exists():
        spec=importlib.util.spec_from_file_location('lumen_campaign_build',campaign_path)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);campaign=module.build()
    manifest = {
        'version': 1, 'frameSize': 48, 'columns': 6, 'anchor': [24, 45],
        'animations': {name: {'row': i, 'frames': 6, 'fps': [6, 10, 16, 16, 10][i], 'loop': i < 2} for i, name in enumerate(STATES)},
        'palette': ['#' + color for color in PALETTE],
        'sources': {path.name: {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                    for path in sorted(SOURCE.iterdir()) if path.suffix in {'.png', '.ttf'}},
        'font': {'file': 'fonts/Tektur-game.ttf', 'family': 'LumenSquare', 'license': 'fonts/OFL-Tektur.txt',
                 'source': 'Tektur.ttf', 'axes': {'wdth': 90, 'wght': 600},
                 'sha256': hashlib.sha256((DEST / 'fonts/Tektur-game.ttf').read_bytes()).hexdigest()},
        'cover': {'file': 'cover.png', 'sha256': hashlib.sha256((DEST / 'cover.png').read_bytes()).hexdigest()},
        'files': {path.name: {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                  for path in sorted(DEST.glob('*.png')) if path.name != 'cover.png'},
    }
    manifest['actors']={name:{'frameSize':48,'anchor':[24,45],'columns':6,'rows':5} for name in ['scout','mote','beetle','wasp']}
    manifest['actors'].update(expansion.get('actors',{}));manifest['palettes']=expansion.get('palettes',{})
    manifest['sources'].update(expansion.get('sources',{}))
    manifest['sources'].update(campaign.get('sources',{}))
    (DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({name: item['bytes'] for name, item in manifest['files'].items()}))


if __name__ == '__main__':
    main()
