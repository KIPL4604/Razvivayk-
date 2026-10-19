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
    boundaries = [0, 264, 480, 700, 916, raw.height] if name == 'scout' else [0, 257, 475, 695, 915, raw.height]
    frames = [actor_content(raw.crop((round(col * raw.width / 6), boundaries[row],
                                     round((col + 1) * raw.width / 6), boundaries[row + 1])))
              for row in range(5) for col in range(6)]
    # One global scale: death frames never grow to fill the available cell.
    scale = min(44 / max(f.width for f in frames), height / max(f.height for f in frames))
    atlas = Image.new('RGBA', (48 * 6, 48 * 5))
    for index, frame in enumerate(frames):
        frame = indexed(frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.NEAREST))
        atlas.alpha_composite(frame, ((index % 6) * 48 + (48 - frame.width) // 2,
                                      (index // 6) * 48 + 45 - frame.height))
    atlas.save(DEST / f'{name}.png', optimize=True)
    return atlas


def environment():
    raw = Image.open(SOURCE / 'garden-raw.png').convert('RGBA')
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


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    # Static Latin/Cyrillic subset: fonttools 4.x, no brotli/network required.
    from fontTools.ttLib import TTFont
    from fontTools import subset
    from fontTools.varLib.instancer import instantiateVariableFont
    font = TTFont(SOURCE / 'Tiny5.ttf', recalcTimestamp=False)
    font = instantiateVariableFont(font, {axis.axisTag: axis.defaultValue for axis in font['fvar'].axes}, inplace=True)
    subsetter = subset.Subsetter()
    subsetter.populate(unicodes=list(range(32, 127)) + list(range(0x400, 0x500)) + [0x2014, 0x2013, 0x2192, 0x221e])
    subsetter.subset(font)
    font.save(DEST / 'fonts/Tiny5-game.ttf')
    scout = actor('scout', 42)
    mote = actor('mote', 34)
    environment(); ui()
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
    manifest = {
        'version': 1, 'frameSize': 48, 'columns': 6, 'anchor': [24, 45],
        'animations': {name: {'row': i, 'frames': 6, 'fps': [6, 10, 16, 16, 10][i], 'loop': i < 2} for i, name in enumerate(STATES)},
        'palette': ['#' + color for color in PALETTE],
        'sources': {path.name: {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                    for path in sorted(SOURCE.iterdir()) if path.suffix in {'.png', '.ttf'}},
        'font': {'file': 'fonts/Tiny5-game.ttf', 'license': 'fonts/OFL.txt',
                 'sha256': hashlib.sha256((DEST / 'fonts/Tiny5-game.ttf').read_bytes()).hexdigest()},
        'cover': {'file': 'cover.png', 'sha256': hashlib.sha256((DEST / 'cover.png').read_bytes()).hexdigest()},
        'files': {path.name: {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                  for path in sorted(DEST.glob('*.png')) if path.name != 'cover.png'},
    }
    (DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({name: item['bytes'] for name, item in manifest['files'].items()}))


if __name__ == '__main__':
    main()
