"""Extract retained original reference-driven atlases into runtime PNG slots.

This only crops, thresholds alpha and normalizes pixel resolution. Run after
build.py when rebuilding all assets. Requires Pillow.
"""
from pathlib import Path
import hashlib,json
from PIL import Image

BASE=Path(__file__).resolve().parent
OUT=BASE.parents[1]/'webapp/frontend/assets/specimen'

def atlas(source,name,cols,rows,size,trim):
    image=Image.open(BASE/source).convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda a:255 if a>=128 else 0))
    sheet=Image.new('RGBA',(cols*size,rows*size))
    for i in range(cols*rows):
        x,y=i%cols,i//cols
        tile=image.crop((round(x*image.width/cols),round(y*image.height/rows),round((x+1)*image.width/cols),round((y+1)*image.height/rows)))
        if trim and (not name.startswith('sector') or i>=4):
            box=tile.getchannel('A').getbbox()
            if box:tile=tile.crop(box)
        sheet.paste(tile.resize((size,size),Image.Resampling.NEAREST),(x*size,y*size))
    sheet.quantize(colors=128,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(OUT/name,optimize=True)
    return sheet

sector=atlas('sector-reference-source.png','sector.png',4,4,128,True)
tissue=atlas('tissue-reference-source.png','tissue.png',4,2,96,True)
# Same production art, composed into the catalog cover without game screenshots.
cover=Image.new('RGBA',(384,240),'#0b090f')
for y in range(0,240,128):
    for x in range(0,384,128):cover.alpha_composite(sector.crop((128,0,256,128)),(x,y))
cover.alpha_composite(sector.crop((0,384,128,512)).resize((150,160),Image.Resampling.NEAREST),(20,14))
for i,x,y,w,h in [(0,174,110,115,75),(1,229,102,84,110),(2,291,122,88,90),(3,137,136,96,88)]:
    cell=tissue.crop((i*96,0,(i+1)*96,96)).resize((w,h),Image.Resampling.NEAREST);cover.alpha_composite(cell,(x,y))
cover.alpha_composite(tissue.crop((0,96,96,192)).resize((61,45),Image.Resampling.NEAREST),(284,124))
cover.convert('RGB').quantize(colors=128,dither=Image.Dither.NONE).save(OUT/'cover.png',optimize=True)
m=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
m.update(version=3,sectorSlots=16,tissueSlots=8,sectorTileSize=128,tissueTileSize=96)
for name in ('sector.png','tissue.png','cover.png'):
    data=(OUT/name).read_bytes()
    with Image.open(OUT/name) as image:m['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'size':list(image.size)}
(OUT/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Reference pass: sector 512x512, tissue 384x192, original cover 384x240')
