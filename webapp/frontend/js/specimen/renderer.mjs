import {TILE,COLS,ROWS,WIDTH,HEIGHT,ROOMS,formFor} from './world.mjs';
import {currentRoom,blocked,targetFor,flameClear} from './engine.mjs';
import {SCENES,VISUAL_LIMITS} from './presentation.mjs';
import {drawOrganism} from './organism.mjs?v=4';

const path='/static/assets/specimen/';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
async function load(name){
  for(let attempt=0;attempt<3;attempt++){
    try{
      return await new Promise((resolve,reject)=>{
        const img=new Image();let done=false;
        const finish=(error)=>{if(done)return;done=true;clearTimeout(timeout);img.onload=img.onerror=null;if(error)reject(error);else resolve(img);};
        const timeout=setTimeout(()=>{finish(Error('Превышено время загрузки графики сектора.'));img.src='';},20_000);
        img.onload=()=>finish();img.onerror=()=>finish(Error('Не удалось загрузить графику сектора.'));
        img.src=`${path}${name}.png?v=6&attempt=${attempt}`;
      });
    }catch(error){if(attempt===2)throw error;}
  }
}
function surfaceCanvas(w,h){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;return[canvas,c];}

export async function createRenderer(canvas){
  const sheets=[];
  for(const name of ['atlas','people','fixtures','sector','tissue','nest','flamer'])sheets.push(await load(name));
  const [atlas,people,fixtures,sector,tissue,nestArt,flamerArt]=sheets;
  const ctx=canvas.getContext('2d',{alpha:false});
  const [rear,bg]=surfaceCanvas(WIDTH,HEIGHT),[front,fg]=surfaceCanvas(WIDTH,HEIGHT);
  const [lightmap,lc]=surfaceCanvas(WIDTH/2,HEIGHT/2),[vignette,vc]=surfaceCanvas(1,1);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let roomId=-1,camX=384,camY=216,viewW=768,viewH=432,previous=0,visibilityKey='',contacts=[];
  function cell(c,img,size,index,x,y,w,h=w){c.drawImage(img,(index%4)*size,Math.floor(index/4)*size,size,size,Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  const sprite=(c,i,x,y,w,h=w)=>cell(c,atlas,64,i,x,y,w,h);
  const fixture=(c,i,x,y,w,h=w)=>cell(c,fixtures,64,i,x,y,w,h);
  const steel=(c,i,x,y,w,h=w)=>cell(c,sector,128,i,x,y,w,h);
  const flesh=(c,i,x,y,w,h=w)=>cell(c,tissue,96,i,x,y,w,h);
  const [glow,gc]=surfaceCanvas(256,256),gradient=gc.createRadialGradient(128,128,1,128,128,128);
  gradient.addColorStop(0,'#eaf3ed70');gradient.addColorStop(.26,'#d2dfd338');gradient.addColorStop(1,'#96b9ae00');gc.fillStyle=gradient;gc.fillRect(0,0,256,256);

  function resize(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    const scale=r.height>r.width?r.width/(r.width<600?360:540):Math.min(r.width/768,r.height/432);
    viewW=Math.round(r.width/scale);viewH=Math.round(r.height/scale);canvas.width=viewW;canvas.height=viewH;ctx.imageSmoothingEnabled=false;
    vignette.width=viewW;vignette.height=viewH;const v=vc.createRadialGradient(viewW/2,viewH*.47,Math.min(viewW,viewH)*.27,viewW/2,viewH/2,Math.max(viewW,viewH)*.65);
    v.addColorStop(0,'#08061000');v.addColorStop(1,'#06040d99');vc.fillStyle=v;vc.fillRect(0,0,viewW,viewH);roomId=-1;
  }
  function wire(c,x,y,ex,ey,sag,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo((x+ex)/2,Math.max(y,ey)+sag,ex,ey);c.stroke();}
  function industrial(r){
    // All pipe ends meet a tank, manifold, floor riser or electrical cabinet.
    const pipe=(points,color='#626b6b',width=8)=>{
      for(const [stroke,w]of [['#080e12',width+4],[color,width],['#9a9f94',1]]){
        bg.strokeStyle=stroke;bg.lineWidth=w;bg.lineJoin='miter';bg.beginPath();points.forEach(([x,y],i)=>i?bg.lineTo(x,y):bg.moveTo(x,y));bg.stroke();
      }
      for(const [x,y]of points){bg.fillStyle='#232d31';bg.fillRect(x-6,y-6,12,12);bg.fillStyle='#90968b';bg.fillRect(x-6,y-6,12,2);bg.fillStyle='#131c21';bg.fillRect(x-6,y+4,12,2);}
      for(let i=1;i<points.length;i++){
        const [x,y]=points[i-1],[ex,ey]=points[i],d=Math.hypot(ex-x,ey-y),vertical=x===ex;
        for(let t=26;t<d-12;t+=38){const px=Math.round(x+(ex-x)*t/d),py=Math.round(y+(ey-y)*t/d);bg.fillStyle='#29383d';bg.fillRect(px-(vertical?width/2+2:1),py-(vertical?1:width/2+2),vertical?width+4:3,vertical?3:width+4);bg.fillStyle='#8e9b92';bg.fillRect(px-(vertical?width/2+1:0),py-(vertical?1:width/2+1),vertical?width+2:1,vertical?1:width+2);}
      }
    };
    pipe([[64,672],[64,76],[710,76],[710,672]],'#4c585c',6);
    if(r.id===0){pipe([[184,672],[184,694],[438,694],[438,546]],'#6a6a61');pipe([[554,430],[610,430],[610,280]],'#736349',4);}
    if(r.id===1){pipe([[152,672],[152,520],[84,520],[84,266]],'#555e61',10);pipe([[642,672],[642,482],[690,482],[690,266]],'#786651',8);}
    if(r.id===2){
      for(const [x,y]of [[82,168],[410,372],[90,586]]){
        bg.fillStyle='#090f16';bg.fillRect(x,y,112,55);bg.strokeStyle='#5b6e72';bg.lineWidth=3;bg.strokeRect(x,y,112,55);
        bg.fillStyle='#446068';bg.fillRect(x+3,y+3,106,3);bg.fillRect(x+55,y+2,2,50);bg.fillStyle='#72909344';bg.fillRect(x+8,y+9,18,39);
      }
      pipe([[350,214],[350,260],[170,260],[170,294]],'#715b46',3);
    }
    if(r.id===3){
      // Loading gantry hangs from the ceiling, directly above the cargo shaft.
      bg.fillStyle='#5b605b';bg.fillRect(264,55,5,473);bg.fillRect(427,55,5,473);
      bg.fillStyle='#141d23';bg.fillRect(269,56,2,472);bg.fillRect(432,56,2,472);
      for(let y=78;y<516;y+=24){bg.fillStyle='#a6a38a';bg.fillRect(264,y,5,2);bg.fillRect(427,y,5,2);}
      pipe([[218,646],[218,688],[108,688],[108,542]],'#6d6d5c',6);
    }
    if(r.id===4){
      pipe([[260,522],[260,494],[458,494],[458,542]],'#718079',12);
      pipe([[260,650],[260,688],[664,688],[664,520]],'#545f5f',12);
      pipe([[382,430],[382,474],[490,474],[490,688]],'#81745e',6);
      for(const x of [104,322,590]){bg.fillStyle='#57787544';bg.fillRect(x,668,82,3);bg.fillStyle='#a1b8a638';bg.fillRect(x+12,665,40,1);}
    }
    if(r.id===5){
      pipe([[610,214],[610,150],[552,150],[552,168]],'#a58552',5);
      bg.fillStyle='#1d272c';bg.fillRect(650,70,16,160);bg.fillRect(650,265,16,176);bg.fillRect(650,480,16,192);
      bg.fillStyle='#8a8877';for(let y=76;y<670;y+=36){if(y>160&&y<248)continue;bg.fillRect(652,y,12,2);}
    }
    const names=['OBSERVATION / 01','MAINTENANCE / 02','PERSONNEL / 03','FREIGHT / 04','PUMP CONTROL / 05','EMERGENCY / 06'];
    for(const [floor,name]of [[240,'L2'],[456,'L1'],[672,'L0']]){
      bg.fillStyle='#8b968c';bg.font='8px monospace';bg.fillText(name,58,floor-36);
      bg.fillStyle='#c39653';bg.fillRect(58,floor-29,13,2);
    }
    bg.fillStyle='#87948a';bg.font='9px monospace';bg.fillText(names[r.id],86,88);
    for(const [x,y]of [[700,270],[70,480]]){
      bg.fillStyle='#2c111b';bg.fillRect(x-4,y-4,16,10);bg.fillStyle='#db5050';bg.fillRect(x,y,8,2);
    }
  }
  function buildBackground(id){
    roomId=id;visibilityKey='';const r=ROOMS[id],scene=SCENES[id];
    bg.clearRect(0,0,WIDTH,HEIGHT);fg.clearRect(0,0,WIDTH,HEIGHT);bg.fillStyle='#10191e';bg.fillRect(0,0,WIDTH,HEIGHT);
    bg.globalAlpha=.78;for(let y=0;y<HEIGHT;y+=96)for(let x=0;x<WIDTH;x+=96)steel(bg,1,x,y,96);bg.globalAlpha=1;
    bg.fillStyle='#08081066';bg.fillRect(49,49,670,HEIGHT-97);
    for(let x=78;x<WIDTH-45;x+=96){bg.fillStyle='#302936';bg.fillRect(x,50,5,HEIGHT-98);bg.fillStyle='#090911';bg.fillRect(x+5,50,6,HEIGHT-98);bg.fillStyle='#65505b';bg.fillRect(x,50,1,HEIGHT-98);}
    for(let y=82;y<HEIGHT-48;y+=72){bg.fillStyle='#382d35';bg.fillRect(48,y,672,4);bg.fillStyle='#09080e';bg.fillRect(48,y+4,672,5);}
    bg.globalAlpha=.78;for(const [i,x,bottom,w,h]of scene.props)steel(bg,i,x-w/2,bottom-h,w,h);bg.globalAlpha=1;
    for(const [x,y,size]of scene.fans){
      const g=bg.createRadialGradient(x,y,5,x,y,size*.8);g.addColorStop(0,'#ffe4c966');g.addColorStop(1,'#b796a000');bg.fillStyle=g;bg.fillRect(x-size,y-size,size*2,size*2);
      bg.fillStyle='#f2dfca';bg.beginPath();bg.arc(x,y,size*.43,0,Math.PI*2);bg.fill();steel(bg,4,x-size/2,y-size/2,size);
    }
    // Workbenches and shelves stay on their human-accessible platforms.
    bg.globalAlpha=.62;
    for(const [i,x,bottom,w,h]of r.decor){if([2,3,6,8,11].includes(i))continue;if(i===0)steel(bg,7,x-w/2,bottom-h,w,h);else fixture(bg,i,x-w/2,bottom-h,w,h);}
    bg.globalAlpha=1;
    for(const [x,y,w,h]of r.walls){
      // Air ducts have sheet-metal casings, not walkable-gallery railings or support furniture.
      if(h!==1||(r.vent&&x*TILE===r.vent.x&&(y*TILE===r.vent.y-TILE||y*TILE===r.vent.y+r.vent.h)))continue;
      const left=x*TILE,top=y*TILE;
      for(let sx=left+15;sx<left+w*TILE;sx+=96){bg.strokeStyle='#473943';bg.lineWidth=5;bg.beginPath();bg.moveTo(sx,top+24);bg.lineTo(sx,Math.min(HEIGHT-48,top+216));bg.stroke();bg.strokeStyle='#17131e';bg.lineWidth=3;bg.beginPath();bg.moveTo(sx+2,top+24);bg.lineTo(sx+2,Math.min(HEIGHT-48,top+216));bg.stroke();wire(bg,sx,top+25,sx+37,top+57,0,'#67505a',2);}
      for(let rx=left;rx<left+w*TILE;rx+=48){if(r.ladders.some(([lx,ly])=>ly===top&&Math.abs(lx-rx-24)<50))continue;steel(bg,8,rx,top-23,48,24);}
      steel(bg,10,left,top+30,Math.min(144,w*TILE),42);
    }
    for(const [x,top,bottom]of r.ladders){
      bg.fillStyle='#151019';bg.fillRect(x-12,top,25,bottom-top);
      for(let y=top+5;y<bottom;y+=48)fixture(bg,4,x-8,y,16,Math.min(48,bottom-y));
      bg.fillStyle='#9f8588';bg.fillRect(x-12,top-5,2,13);bg.fillRect(x+11,top-5,2,13);
    }
    industrial(r);
    wire(bg,58,58,705,58,48,'#3b2a30',3);wire(bg,58,62,705,62,39,'#6a4d48',1);
    wire(bg,68,204,280,209,38,'#594248',2);wire(bg,438,204,695,192,40,'#3d2935',2);
    if(scene.moss)for(const x of [70,198,360,462,618])steel(bg,13,x,364,64,21);
    for(const v of r.vines){bg.globalAlpha=.6;flesh(bg,2,v.x,v.y,v.w,v.h);flesh(bg,7,v.x+8,v.y-45,v.w*.7,v.h*.8);}bg.globalAlpha=1;
    const at=(x,y)=>x<0||x>=COLS||y<0||y>=ROWS?1:r.cells[y*COLS+x];
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(at(x,y)){
      const px=x*TILE,py=y*TILE,top=!at(x,y-1),bottom=!at(x,y+1),left=!at(x-1,y),right=!at(x+1,y),edge=top||bottom||left||right;
      fg.fillStyle='#09080f';fg.fillRect(px,py,TILE,TILE);
      fg.globalAlpha=edge?.91:.18;steel(fg,edge?0:2,px,py,TILE);fg.globalAlpha=1;
      if(top){fg.fillStyle='#93828b';fg.fillRect(px,py,TILE,2);fg.fillStyle='#d0b7b1';for(let j=0;j<6;j++)if(hash(x*37+y*19+j)>.5)fg.fillRect(px+j*4,py,2,1);fg.fillStyle='#211923';fg.fillRect(px,py+8,TILE,3);}
      if(bottom){fg.fillStyle='#211723';fg.fillRect(px,py,TILE,13);fg.fillStyle='#65505e';fg.fillRect(px,py+TILE-2,TILE,1);steel(fg,14,px,py+5,TILE,19);}
      if(left){fg.fillStyle='#ab9295';fg.fillRect(px,py,1,TILE);fg.fillStyle='#3e2e3d';fg.fillRect(px+2,py,2,TILE);}
      if(right){fg.fillStyle='#816b7c';fg.fillRect(px+TILE-2,py,2,TILE);}
    }
    if(r.vent){const v=r.vent;fg.strokeStyle='#9b8997';fg.lineWidth=2;fg.strokeRect(v.x-2,v.y-2,v.w+4,v.h+4);for(const x of [v.x-5,v.x+v.w-4]){fg.fillStyle='#6f6572';fg.fillRect(x,v.y-7,9,5);fg.fillRect(x,v.y+v.h+2,9,5);}fg.fillStyle='#c6bd9c';fg.font='8px monospace';fg.fillText('ВЕНТИЛЯЦИЯ / Ø 24',v.x,v.y-12);}
    for(const p of Object.values(r.portals).filter(Boolean)){
      const x=p.x===0?19:733;fg.strokeStyle='#8b7b80';fg.lineWidth=3;fg.strokeRect(x,p.y-3,16,99);steel(fg,14,x-7,p.y-8,30,13);
      bg.fillStyle='#b6c2ac';bg.font='8px monospace';bg.fillText(p.x===0?'←':'→',p.x===0?54:702,p.floor-65);
    }
  }

  function rayPolygon(s,x,y){
    const points=[];
    for(let i=0;i<VISUAL_LIMITS.rays;i++){
      const a=i/VISUAL_LIMITS.rays*Math.PI*2,dx=Math.cos(a),dy=Math.sin(a);let d=4;
      for(;d<VISUAL_LIMITS.lightRadius;d+=VISUAL_LIMITS.lightStep)if(blocked(s,x+dx*d,y+dy*d))break;
      points.push([x+dx*d,y+dy*d]);
    }return points;
  }
  function illuminate(s){
    const room=currentRoom(s),key=s.room+':'+room.gateOpen+':'+formFor(s.mass)+':'+room.objects.filter(o=>['lamp','glass','panel'].includes(o.kind)).map(o=>o.broken?'0':'1').join('');
    if(key===visibilityKey){ctx.save();ctx.globalCompositeOperation='multiply';ctx.drawImage(lightmap,0,0,WIDTH,HEIGHT);ctx.restore();return;}
    const sources=[...room.objects.filter(o=>o.kind==='lamp'&&!o.broken).map(o=>({x:o.x,y:o.y,color:'#fff3da'})),...room.objects.filter(o=>o.kind==='nest').map(o=>({x:o.x+10,y:o.y,color:'#b8edb1'})),...SCENES[s.room].fans.map(([x,y])=>({x,y,color:'#fff0dd'}))];
    contacts=sources.map(o=>({...o,points:rayPolygon(s,o.x,o.y)}));visibilityKey=key;
    lc.setTransform(1,0,0,1,0,0);lc.globalCompositeOperation='source-over';lc.fillStyle=SCENES[s.room].ambient;lc.fillRect(0,0,WIDTH/2,HEIGHT/2);lc.scale(.5,.5);
    lc.globalCompositeOperation='lighten';
    for(const o of contacts){
      lc.save();lc.beginPath();o.points.forEach(([x,y],i)=>i?lc.lineTo(x,y):lc.moveTo(x,y));lc.closePath();lc.clip();
      const g=lc.createRadialGradient(o.x,o.y,2,o.x,o.y,VISUAL_LIMITS.lightRadius);g.addColorStop(0,o.color);g.addColorStop(.25,'#ddcabb');g.addColorStop(1,SCENES[s.room].ambient);lc.fillStyle=g;lc.fillRect(o.x-170,o.y-170,340,340);lc.restore();
    }
    ctx.save();ctx.globalCompositeOperation='multiply';ctx.drawImage(lightmap,0,0,WIDTH,HEIGHT);ctx.restore();
  }
  function fans(s){
    for(const [x,y,size]of SCENES[s.room].fans){ctx.save();ctx.beginPath();ctx.arc(x,y,size*.37,0,Math.PI*2);ctx.clip();ctx.fillStyle='#f6e4cf';ctx.fillRect(x-size/2,y-size/2,size,size);ctx.translate(x,y);ctx.rotate(reduced.matches?0:s.time*.42);steel(ctx,4,-size/2,-size/2,size);ctx.restore();}
  }
  function creature(s){drawOrganism(ctx,s,flesh,currentRoom(s),reduced.matches);}
  function props(s){
    for(const o of currentRoom(s).objects){
      if(o.kind==='nest')continue;
      if(o.kind==='crate'){
        // Axis-aligned collision matches the visible 32px steel crate exactly.
        sprite(ctx,13,o.x-16,o.y-16,32);ctx.strokeStyle='#819087';ctx.lineWidth=1;ctx.strokeRect(Math.round(o.x)-15.5,Math.round(o.y)-15.5,31,31);continue;
      }
      if(o.kind==='glass'||o.kind==='panel'){
        const x=Math.round(o.x-o.w/2),y=Math.round(o.y-o.h/2);ctx.strokeStyle=o.kind==='glass'?'#a3c2bc':'#8e8c74';ctx.lineWidth=1;
        if(!o.broken){
          ctx.fillStyle=o.kind==='glass'?'#8ec7cf40':'#3f4a4c';ctx.fillRect(x,y,o.w,o.h);ctx.strokeRect(x+.5,y+.5,o.w-1,o.h-1);
          if(o.kind==='glass'){ctx.fillStyle='#a6d3d580';ctx.fillRect(x+3,y+4,2,o.h-8);ctx.fillRect(x+6,y+9,2,8);}
          else{for(let dy=8;dy<o.h-6;dy+=7){ctx.fillStyle='#172329';ctx.fillRect(x+4,y+dy,o.w-8,2);}ctx.fillStyle=o.relay?'#e9b654':'#b19565';ctx.fillRect(x+4,y+3,o.w-8,2);}
          if(o.hp<3&&o.kind==='panel'){ctx.strokeStyle='#100e14';ctx.beginPath();ctx.moveTo(x,y+12);ctx.lineTo(x+o.w/2,y+o.h/2);ctx.lineTo(x+o.w,y+o.h-8);ctx.stroke();}
        }else{ctx.strokeStyle='#525b59';ctx.strokeRect(x-.5,y-1,o.w+1,o.h+2);for(let dy=0;dy<o.h;dy+=14){ctx.fillStyle='#6e7e7c';ctx.fillRect(x,y+dy,3,4);}}
        if(o.relay){ctx.fillStyle=o.broken?'#a8c8a0':'#e0ad63';ctx.font='8px monospace';ctx.fillText(o.broken?'ЦЕПЬ СНЯТА':'АВАРИЙНАЯ ПАНЕЛЬ',x-52,y-12);}continue;
      }
      if(o.kind==='supply'){
        ctx.fillStyle='#26343a';ctx.fillRect(o.x-11,o.y-13,22,26);ctx.strokeStyle='#9a8b65';ctx.strokeRect(o.x-10.5,o.y-12.5,21,25);ctx.fillStyle='#e0b16c';ctx.fillRect(o.x-6,o.y-7,12,3);ctx.font='7px monospace';ctx.fillText('ЯЩИК / E',o.x-20,o.y-19);continue;
      }
      if(o.kind==='lamp'){if(!o.broken){ctx.strokeStyle='#7c6068';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(o.x,o.mountY);ctx.lineTo(o.x,o.y-12);ctx.stroke();steel(ctx,11,o.x-9,o.y-16,18,31);}else fixture(ctx,7,o.x-13,o.y-9,26,20);continue;}
      const index={capsule:4,tank:6,feed:6,lever:7,desk:12,terminal:12}[o.kind],sizes={capsule:[59,99],tank:[57,59],feed:[57,59],lever:[25,43],desk:[61,52],terminal:[56,55]}[o.kind];
      sprite(ctx,index,o.x-sizes[0]/2,o.y+26-sizes[1],...sizes);
      if(o.kind==='tank'||o.kind==='feed'){ctx.fillStyle='#b3c1a4';ctx.font='8px monospace';ctx.fillText(o.kind==='feed'?'ПИТАНИЕ':o.bank?'+ МАССА':'РЕЗЕРВ',o.x-21,o.y-40);}
    }
  }
  function peopleIn(s){
    const target=targetFor(s);
    for(const e of currentRoom(s).enemies){if(e.eaten)continue;const moving=e.kind==='tech'&&e.alert>0,frame=e.dead||e.knock>0?5:e.hurt>0?4:e.windup>.1||e.fireTime>0?3:moving?1+Math.floor(s.time*9)%2:0;
      if(e.pose){
        const [head,torso,hip,feet]=e.pose,sheet=e.kind==='flamer'?flamerArt:people,row=e.kind==='guard'?64:0;
        // Segments use the original pixel uniform, each aligned to its physical link.
        const part=(a,b,sy,sh,anchor)=>{ctx.save();ctx.translate(Math.round(a.x),Math.round(a.y));ctx.rotate(-Math.atan2(b.x-a.x,b.y-a.y));ctx.scale(e.dir<0?-1:1,1);ctx.drawImage(sheet,0,row+sy,64,sh,-32,anchor,64,sh);ctx.restore();};
        part(head,torso,0,23,-12);part(torso,hip,23,20,-10);part(hip,feet,43,21,-4);continue;
      }
      ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y+26));ctx.scale(e.dir<0?-1:1,1);ctx.drawImage(e.kind==='flamer'?flamerArt:people,frame*64,(e.kind==='guard'?1:0)*64,64,64,-32,-58,64,64);ctx.restore();
      if(e.hurt>0&&!e.dead){ctx.fillStyle='#271821';ctx.fillRect(e.x-14,e.y-38,28,3);ctx.fillStyle='#e9b58a';ctx.fillRect(e.x-14,e.y-38,28*e.hp/(e.kind==='tech'?3:e.kind==='flamer'?6:5),3);}
      if(!e.dead&&e.alert>0){ctx.fillStyle='#e8ad78';ctx.fillRect(e.x-1,e.y-42,2,6);ctx.fillRect(e.x-1,e.y-34,2,2);}
      if(e.windup>0){ctx.strokeStyle='#ed9d6866';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(e.x,e.y-5);ctx.lineTo(s.x,s.y);ctx.stroke();}
      if(target?.id===e.id){ctx.strokeStyle='#efd2b2';ctx.lineWidth=1;ctx.strokeRect(Math.round(e.x)-17,Math.round(e.y)-28,34,51);}
    }
    if(target?.type==='object'){const o=currentRoom(s).objects.find(o=>o.id===target.id);if(o?.kind==='lamp'){ctx.strokeStyle='#efd2b2';ctx.lineWidth=1;ctx.strokeRect(Math.round(o.x)-13,Math.round(o.y)-18,26,36);}}
  }
  function nests(s){
    for(const o of currentRoom(s).objects.filter(o=>o.kind==='nest')){
      const phase=reduced.matches?1:Math.floor(s.time*2.6)%4;
      ctx.drawImage(nestArt,(phase%2)*128,Math.floor(phase/2)*128,128,128,Math.round(o.x)-60,Math.round(o.y)-64,120,128);
    }
  }
  function fire(s){
    const time=reduced.matches?0:s.time;
    for(const e of currentRoom(s).enemies){if(e.eaten||e.dead||e.fireTime<=0)continue;
      const x=e.x+e.dir*18,y=e.y-6,angle=Math.atan2(e.fireY,e.fireX),points=[];
      for(let i=0;i<=8;i++){const a=angle-.49+i*.98/8,dx=Math.cos(a),dy=Math.sin(a);let d=5;for(;d<160;d+=4)if(!flameClear(s,x,y,x+dx*d,y+dy*d))break;points.push([x+dx*d,y+dy*d]);}
      ctx.save();ctx.beginPath();ctx.moveTo(x,y);points.forEach(([px,py])=>ctx.lineTo(px,py));ctx.closePath();ctx.clip();ctx.globalCompositeOperation='screen';
      for(let i=0;i<15;i++){
        const a=angle-.4+(i%7)*.8/6,dx=Math.cos(a),dy=Math.sin(a),length=100+38*Math.sin(time*17+i*2.3),phase=time*21+i*1.8;
        let px=x,py=y;
        for(let j=1;j<=9;j++){const t=j/9,wave=Math.sin(phase+t*8)*t*9,nx=x+dx*length*t-dy*wave,ny=y+dy*length*t+dx*wave;
          ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(nx,ny);ctx.lineCap='round';ctx.strokeStyle=j<5?'#ffb448b0':'#ef612c70';ctx.lineWidth=(1-t)*9+1;ctx.stroke();
          if(j<6){ctx.strokeStyle='#ffe7a0aa';ctx.lineWidth=(1-t)*3;ctx.stroke();}px=nx;py=ny;
        }
      }ctx.restore();
    }
  }
  function atmosphere(s){
    const time=reduced.matches?0:s.time;ctx.fillStyle=SCENES[s.room].mist;ctx.globalAlpha=.11;
    for(let i=0;i<VISUAL_LIMITS.dust;i++){const x=58+((hash(i+9)*650+time*(1+i%3))%650),y=62+((hash(i+91)*310+Math.sin(time*.16+i)*8)%310);ctx.fillRect(Math.round(x),Math.round(y),i%7?1:2,1);}
    ctx.globalAlpha=.07;for(const [x,y,size]of SCENES[s.room].fans){const contact=contacts.find(o=>o.x===x&&o.y===y);ctx.save();if(contact){ctx.beginPath();contact.points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.clip();}ctx.fillStyle='#f4e6d8';ctx.beginPath();ctx.moveTo(x-size*.3,y);ctx.lineTo(x-size*.8,384);ctx.lineTo(x+size*.45,384);ctx.lineTo(x+size*.3,y);ctx.closePath();ctx.fill();ctx.restore();}ctx.globalAlpha=1;
    for(const o of currentRoom(s).objects)if(o.kind==='lamp'&&!o.broken){ctx.globalAlpha=.26;ctx.drawImage(glow,Math.round(o.x)-84,Math.round(o.y)-80,168,168);ctx.globalAlpha=1;ctx.fillStyle='#ffe9c5';ctx.fillRect(Math.round(o.x)-1,Math.round(o.y)-8,2,12);}
  }
  function draw(s,now=performance.now()){
    if(!canvas.width)resize();if(roomId!==s.room)buildBackground(s.room);
    const dt=Math.min(.08,Math.max(0,(now-previous)/1000));previous=now;
    const tx=viewW>=WIDTH?WIDTH/2:clamp(s.x,viewW/2,WIDTH-viewW/2),ty=viewH>=HEIGHT?HEIGHT/2:clamp(s.y,viewH/2,HEIGHT-viewH/2),ease=reduced.matches?1:1-Math.exp(-dt*9);
    camX+=(tx-camX)*ease;camY+=(ty-camY)*ease;
    ctx.fillStyle='#09070e';ctx.fillRect(0,0,viewW,viewH);ctx.save();ctx.translate(Math.round(viewW/2-camX),Math.round(viewH/2-camY));ctx.drawImage(rear,0,0);fans(s);
    for(const d of s.decals)if(d.room===s.room){ctx.save();ctx.translate(Math.round(d.x),Math.round(d.y));ctx.rotate(Math.atan2(d.ny??-1,d.nx??0)+Math.PI/2);ctx.globalAlpha=.78;flesh(ctx,6,-d.size*1.5,-4,d.size*3,8);ctx.restore();}
    props(s);peopleIn(s);fire(s);creature(s);
    for(const b of s.bullets){ctx.strokeStyle='#ffdf9d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*.018,b.y-b.vy*.018);ctx.stroke();}
    for(const p of s.particles){ctx.fillStyle=p.color;ctx.globalAlpha=(p.life/p.max)*(p.kind==='smoke'?.28:1);const size=p.kind==='smoke'||p.kind==='steam'?5:2;ctx.fillRect(Math.round(p.x),Math.round(p.y),size,size);}ctx.globalAlpha=1;
    for(const f of s.fragments){ctx.save();ctx.translate(Math.round(f.x),Math.round(f.y));ctx.rotate(f.angle);ctx.globalAlpha=Math.min(1,f.life);ctx.fillStyle=f.color;ctx.fillRect(-f.r,-1,f.r*2,2);ctx.restore();}
    ctx.drawImage(front,0,0);nests(s);
    const room=currentRoom(s),gate=ROOMS[s.room].gate;
    if(gate){if(!room.gateOpen){steel(ctx,7,gate.x-7,gate.y,38,gate.h);ctx.fillStyle='#e74347';ctx.fillRect(gate.x+10,gate.y+12,2,gate.h-24);}else{steel(ctx,14,gate.x-8,gate.y-6,40,12);ctx.fillStyle='#aecab0';ctx.fillRect(gate.x+8,gate.y-3,8,2);}}
    illuminate(s);atmosphere(s);
    if(!reduced.matches)for(const f of s.flashes){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=f.life/f.max*.24;ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(f.x,f.y,f.radius,0,Math.PI*2);ctx.fill();ctx.restore();}
    ctx.restore();ctx.drawImage(vignette,0,0);
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  return{draw,resize,worldPoint:(x,y)=>{const r=canvas.getBoundingClientRect();return{x:(x-r.left)/r.width*viewW+camX-viewW/2,y:(y-r.top)/r.height*viewH+camY-viewH/2};},destroy:()=>observer.disconnect(),metrics:()=>({width:viewW,height:viewH,cameraX:camX,cameraY:camY,visualStyle:'industrial-crimson',lightRays:VISUAL_LIMITS.rays,dust:VISUAL_LIMITS.dust})};
}
