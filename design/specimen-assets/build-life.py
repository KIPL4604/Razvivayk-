"""Original pixel artwork for Specimen. Drawn from primitives, no external images."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json, math, random

OUT = Path(__file__).resolve().parents[2] / "webapp/frontend/assets/specimen"
OUT.mkdir(parents=True, exist_ok=True)
kit = Image.new("RGBA", (256, 192))
sizes = [(64,36),(22,36),(28,26),(30,16),(32,32),(56,32),(28,64),(64,64),(64,12),(24,28),(32,58),(64,64)]
for slot,(w,h) in enumerate(sizes):
    im=Image.new("RGBA",(w,h)); d=ImageDraw.Draw(im)
    if slot==0:
        d.rectangle((0,0,w-1,5),fill="#4d6163");d.line((0,0,w-1,0),fill="#b5c2b8")
        d.rectangle((3,6,7,h-1),fill="#5a6461");d.rectangle((w-8,6,w-4,h-1),fill="#5a6461")
        d.rectangle((10,7,w-11,15),fill="#293d42");d.line((12,8,w-13,8),fill="#84938a")
        for x in (14,38):d.line((x,11,x+8,11),fill="#b4aa80")
    elif slot==1:
        d.rectangle((2,0,18,16),fill="#283e43");d.rectangle((3,1,16,14),fill="#5a7776")
        d.line((4,3,15,3),fill="#8d9f92");d.rectangle((0,19,21,23),fill="#496061")
        d.rectangle((9,24,12,31),fill="#9c9e85");d.line((3,35,19,35),fill="#829086",width=2)
        d.line((10,30,3,35),fill="#829086");d.line((10,30,19,35),fill="#829086")
    elif slot==2:
        d.rectangle((0,0,w-1,19),fill="#a0aaa0");d.rectangle((2,2,w-3,17),fill="#111f29")
        d.line((4,13,8,10,12,12,17,6,22,8),fill="#69c1aa")
        d.rectangle((4,4,10,5),fill="#4e827f");d.point((25,18),fill="#c6c989")
        d.rectangle((12,20,15,23),fill="#71817d");d.rectangle((7,24,21,25),fill="#909c8c")
    elif slot==3:
        for i,x in enumerate((2,8,14,20,26)):
            d.rectangle((x,1,x+3,12),fill="#6d9898");d.line((x,2,x,10),fill="#b7d5c5")
            d.rectangle((x+1,7+i%3,x+2,11),fill=("#b1aa56","#6ba380","#977cb4")[i%3])
            d.line((x,0,x+3,0),fill="#c5d1b4")
        d.rectangle((0,12,w-1,15),fill="#485e60");d.line((0,12,w-1,12),fill="#b0ae88")
    elif slot in (4,5):
        d.rectangle((0,0,w-1,h-1),fill="#332c27");d.rectangle((2,2,w-3,h-3),fill="#94764c")
        for y in range(4,h-2,7):
            d.line((3,y,w-4,y),fill="#53432f");d.line((4,y+1,w-5,y+1),fill="#b29963")
        for x in range(6,w-4,11):
            d.line((x,5,x+5,5),fill="#6c5438");d.line((x+2,24,x+7,24),fill="#665036")
        d.line((3,3,w-4,h-4),fill="#c0a773",width=4);d.line((w-4,3,3,h-4),fill="#a88b59",width=4)
        for x in (3,w-5):
            for y in (3,h-5):d.rectangle((x,y,x+1,y+1),fill="#c5c0a1")
    elif slot==6:
        d.rectangle((1,0,4,h-1),fill="#a69668");d.rectangle((w-5,0,w-2,h-1),fill="#a69668")
        for y in range(0,h,12):
            d.rectangle((4,y,w-5,y+2),fill="#b4b19c");d.line((5,y+2,w-6,y+2),fill="#435355")
    elif slot==8:
        d.rectangle((0,0,w-1,6),fill="#4b5b5e");d.line((0,0,w-1,0),fill="#a5ada0")
        for x in range(0,w,6):d.line((x,2,x+2,2),fill="#788782")
        d.rectangle((0,7,w-1,h-1),fill="#263638")
    elif slot==9:
        d.rectangle((2,24,23,27),fill="#a8b3a8");d.rectangle((5,19,19,23),fill="#718a83")
        d.line((16,20,16,9,7,5),fill="#b3bdb1",width=4);d.line((5,4,12,8),fill="#243c44",width=5)
        d.rectangle((2,0,7,3),fill="#829c95");d.rectangle((1,16,14,18),fill="#527b78")
        d.rectangle((5,13,8,15),fill="#d1d4b1")
    elif slot==10:
        d.rectangle((0,0,w-1,h-1),fill="#8c9a90");d.rectangle((2,2,w-3,h-3),fill="#263e43")
        for y in (5,23,41):
            for x in (6,14,22):
                d.rectangle((x,y+4,x+4,y+13),fill="#78978c");d.rectangle((x+1,y+7,x+3,y+11),fill="#939f60")
            d.line((3,y+16,w-4,y+16),fill="#b0b5a0")
        d.line((w//2,3,w//2,h-3),fill="#82958c")
    else:
        for i in range(4):
            x=i*16;y=h-(i+1)*16;d.rectangle((x,y,x+15,y+5),fill="#6d7771");d.line((x,y,x+15,y),fill="#b9b59b")
    kit.alpha_composite(im,((slot%4)*64+(64-w)//2,(slot//4)*64+(64-h)//2))
kit.save(OUT/"lab-life.png",optimize=True)

staff=Image.new("RGBA",(512,704))
for row in range(11):
    for frame in range(8):
        im=Image.new("RGBA",(64,64));d=ImageDraw.Draw(im);a=frame/8*math.tau
        guard=row>=7;coat="#aebbb5" if not guard else "#687467";shade="#586d70" if not guard else "#334b44"
        skin="#b8aa8b";dark="#1a2930";walk=row in (1,2,7,9);run=row in (2,9);climb=row in (5,10)
        lean=4 if run else 0;bob=round(abs(math.sin(a))*2) if walk else round(math.sin(a)*.7)
        hx=32+lean;hy=12+bob;chest=(32+lean,29+bob);hip=(31,41+bob)
        def limb(points,color,width):
            d.line(points,fill=dark,width=width+2);d.line(points,fill=color,width=width)
        if row==3:
            hip=(30,43);left=[hip,(42,45),(43,57)];right=[hip,(24,48),(24,57)]
        else:
            swing=math.sin(a)*(11 if run else 7) if walk or climb else 2
            left=[hip,(25-round(swing*.3),48),(27-round(swing),57)]
            right=[hip,(36+round(swing*.3),48),(36+round(swing),57)]
        if climb:
            left=[hip,(24,45-round(math.sin(a)*6)),(25,54-round(math.sin(a)*6))]
            right=[hip,(38,45+round(math.sin(a)*6)),(39,54+round(math.sin(a)*6))]
        limb(left,"#304952",5);limb(right,"#40575b",5)
        for foot in (left[-1],right[-1]):d.rectangle((foot[0]-2,foot[1]-1,foot[0]+5,foot[1]+2),fill=dark)
        d.polygon([(chest[0]-8,chest[1]-6),(chest[0]+7,chest[1]-6),(hip[0]+9,hip[1]+4),(hip[0]-9,hip[1]+4)],fill=dark)
        d.polygon([(chest[0]-6,chest[1]-5),(chest[0]+6,chest[1]-5),(hip[0]+7,hip[1]+3),(hip[0]-7,hip[1]+3)],fill=coat)
        d.line((chest[0],chest[1]-3,hip[0],hip[1]+2),fill=shade)
        d.rectangle((chest[0]+3,chest[1],chest[0]+5,chest[1]+3),fill="#78a79a" if not guard else "#c1ad77")
        if climb:
            hands=[(24,16-round(math.sin(a)*5)),(42,16+round(math.sin(a)*5))]
        elif row==3:hands=[(48,36+frame%2),(43,36-frame%2)]
        elif row==4:hands=[(44,26+round(math.sin(a)*2)),(38,31)]
        elif row==8:hands=[(49,29),(41,31)]
        elif row==6:hands=[(27,17),(40,19)]
        elif run:hands=[(43,20+round(math.sin(a)*5)),(23,39-round(math.sin(a)*5))]
        else:hands=[(24+round(math.sin(a)*3) if walk else 23,40),(41-round(math.sin(a)*3) if walk else 41,39)]
        for i,hand in enumerate(hands):
            shoulder=(chest[0]+(-5 if i==0 else 5),chest[1]-1)
            elbow=((shoulder[0]+hand[0])//2+(-3 if i==0 else 3),(shoulder[1]+hand[1])//2+3)
            limb([shoulder,elbow,hand],coat,4);d.rectangle((hand[0]-1,hand[1]-1,hand[0]+2,hand[1]+2),fill=skin)
        if row==4:
            d.rectangle((43,16,46,27),fill="#80acaa");d.rectangle((44,21,45,26),fill="#b9b260");d.line((43,16,46,16),fill="#c4d2c2")
        if row==8:
            d.rectangle((40,28,57,31),fill="#212d30");d.line((53,27,59,27),fill="#70847d",width=2)
            if frame in (2,3):d.polygon([(59,25),(63,29),(59,32)],fill="#e3b671")
        d.rectangle((hx-4,hy,hx+4,hy+10),fill=dark);d.rectangle((hx-3,hy+1,hx+3,hy+9),fill=skin)
        d.rectangle((hx-4,hy-1,hx+3,hy+2),fill="#72807b" if guard else "#7f8b87")
        if guard:d.line((hx-5,hy+2,hx+5,hy+2),fill="#8e9c88",width=2)
        d.point((hx+3,hy+5),fill="#293f43")
        if not guard:
            d.line((hx-1,hy+4,hx+4,hy+4),fill="#677f80");d.point((hx+5,hy+6),fill=skin)
        staff.alpha_composite(im,(frame*64,row*64))
staff.save(OUT/"staff-life.png",optimize=True)

rng=random.Random(72);im=Image.new("RGBA",(256,256),"#101e22");d=ImageDraw.Draw(im)
for i in range(160):
    x=rng.randrange(256);y=rng.randrange(256);w=rng.randrange(5,32);h=rng.randrange(3,20)
    d.rectangle((x,y,x+w,y+h),fill=rng.choice(["#172a2d","#1b3031","#14262c","#203533"]))
for i in range(16):
    x=rng.randrange(256);pts=[(x,0)]
    for y in range(0,280,24):x+=rng.randrange(-12,13);pts.append((x,y))
    d.line(pts,fill="#293f35",width=7);d.line([(x+1,y) for x,y in pts],fill="#43604b",width=2)
for i in range(70):
    x=rng.randrange(256);y=rng.randrange(256);d.rectangle((x,y,x+1,y+1),fill=rng.choice(["#56605c","#58776a","#596683","#2e4c49"]))
im.save(OUT/"wetlands.png",optimize=True)
manifest=json.loads((OUT/"manifest.json").read_text(encoding="utf-8"))
manifest["version"]=5
manifest["life"]={"origin":"Original hand-authored pixel primitives; build-life.py","staffFrames":8,"staffRows":11,"frameSize":64,"propSlots":12}
for name in ("lab-life.png","staff-life.png","wetlands.png"):
    raw=(OUT/name).read_bytes()
    with Image.open(OUT/name) as image:
        manifest["files"][name]={"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"size":list(image.size)}
(OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Original life art: 12 props, 88 staff frames, wetland roots")
