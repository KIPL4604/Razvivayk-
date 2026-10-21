import {TILE,WIDTH,HEIGHT,ROOMS,formFor} from './world.mjs';
import {currentRoom,targetFor} from './engine.mjs';
const path='/static/assets/specimen/';
function load(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Не удалось загрузить графику сектора.'));img.src=src;});}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export async function createRenderer(canvas){
  const [atlas,people,fixtures]=await Promise.all([load(path+'atlas.png?v=2'),load(path+'people.png?v=2'),load(path+'fixtures.png?v=2')]);
  const ctx=canvas.getContext('2d',{alpha:false}),cache=document.createElement('canvas'),bg=cache.getContext('2d',{alpha:false});
  cache.width=WIDTH;cache.height=HEIGHT;let roomId=-1,camX=384,camY=216,viewW=640,viewH=360,previous=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function sprite(c,index,x,y,w,h=w){c.drawImage(atlas,(index%4)*64,Math.floor(index/4)*64,64,64,Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function fixture(c,index,x,y,w,h=w){c.drawImage(fixtures,(index%4)*64,Math.floor(index/4)*64,64,64,Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  const glow=document.createElement('canvas');glow.width=192;glow.height=192;const glowCtx=glow.getContext('2d'),light=glowCtx.createRadialGradient(96,96,2,96,96,96);light.addColorStop(0,'#efc47340');light.addColorStop(.35,'#d9ad5922');light.addColorStop(1,'#e2ac4300');glowCtx.fillStyle=light;glowCtx.fillRect(0,0,192,192);
  function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const scale=r.height>r.width?r.width/(r.width<600?360:540):Math.min(r.width/640,r.height/360);viewW=Math.round(r.width/scale);viewH=Math.round(r.height/scale);canvas.width=viewW;canvas.height=viewH;ctx.imageSmoothingEnabled=false;roomId=-1;}
  function background(id){
    roomId=id;bg.imageSmoothingEnabled=false;bg.fillStyle='#111e24';bg.fillRect(0,0,WIDTH,HEIGHT);
    bg.globalAlpha=.32;
    for(let y=0;y<HEIGHT;y+=96)for(let x=0;x<WIDTH;x+=96)sprite(bg,1,x,y,96);
    bg.globalAlpha=1;
    // Geometry uses the actual collision grid, including all platforms and passages.
    const r=ROOMS[id];
    // Doors, windows and equipment sit on the floor or on accessible galleries.
    bg.globalAlpha=.65;for(const [i,x,bottom,w,h]of r.decor)fixture(bg,i,x-w/2,bottom-h,w,h);bg.globalAlpha=1;
    for(const [x,y,w]of r.walls){
      const left=x*TILE,top=y*TILE;
      bg.strokeStyle='#29454a';bg.lineWidth=5;
      for(let sx=left+15;sx<left+w*TILE;sx+=96){bg.beginPath();bg.moveTo(sx,top+24);bg.lineTo(sx,384);bg.stroke();bg.lineWidth=2;bg.beginPath();bg.moveTo(sx,top+24);bg.lineTo(sx+28,top+55);bg.stroke();bg.lineWidth=5;}
      bg.globalAlpha=.65;for(let rx=left;rx<left+w*TILE;rx+=48){if(r.ladders.some(([lx,ly])=>ly===top&&Math.abs(lx-rx-24)<25))continue;fixture(bg,10,rx,top-28,48,29);}bg.globalAlpha=1;
    }
    for(const [x,top,bottom]of r.ladders){
      for(let y=top+5;y<bottom;y+=48){const h=Math.min(48,bottom-y);fixture(bg,4,x-9,y,18,h);}
      bg.fillStyle='#9d9d78';bg.fillRect(x-13,top-5,3,13);bg.fillRect(x+11,top-5,3,13);
    }
    for(let y=0;y<18;y++)for(let x=0;x<32;x++)if(r.cells[y*32+x]){
      sprite(bg,y>=16?2:0,x*TILE,y*TILE,TILE);
      if(y>0&&!r.cells[(y-1)*32+x]){bg.fillStyle='#81958a';bg.fillRect(x*TILE,y*TILE,TILE,2);bg.fillStyle='#243c43';bg.fillRect(x*TILE,y*TILE+2,TILE,2);}
      if(x>0&&!r.cells[y*32+x-1]){bg.fillStyle='#435e60';bg.fillRect(x*TILE,y*TILE,2,TILE);}
    }
    // Cables and structural rails are original pixel geometry over the PNG panels.
    bg.strokeStyle='#2d454a';bg.lineWidth=3;bg.beginPath();bg.moveTo(64,58);bg.lineTo(704,58);bg.stroke();
    bg.fillStyle='#4e716a';bg.fillRect(703,218,15,2);bg.fillRect(713,214,2,10);bg.fillRect(710,216,2,6);
    if(id>0){bg.fillRect(52,218,13,2);bg.fillRect(52,214,2,10);}
    if(r.vent){const v=r.vent;bg.strokeStyle='#93a997';bg.lineWidth=2;bg.strokeRect(v.x-2,v.y+2,v.w+4,v.h-4);bg.fillStyle='#1e3d40';bg.fillRect(v.x,v.y+6,v.w,3);bg.fillRect(v.x,v.y+v.h-9,v.w,3);bg.fillStyle='#d5b476';bg.font='8px monospace';bg.fillText('Ø 36',v.x-4,v.y-8);}
    bg.fillStyle='#87a29c';bg.font='12px monospace';bg.fillText('0'+(id+1)+' / '+['ISOLATION','MAINTENANCE','PERSONNEL','CARGO','PUMP CONTROL','EXIT AIRLOCK'][id],76,365);
  }
  function tendrils(s){
    for(let i=0;i<s.limbs.length;i++){
      const l=s.limbs[i],n=s.nodes[l.root],tip=l.anchor||l.tip,dx=tip.x-n.x,dy=tip.y-n.y,d=Math.hypot(dx,dy);if(d<5)continue;
      const slack=l.planted?Math.min(16,Math.max(2,(l.reach-d)*.09)):22;
      let px=n.x,py=n.y;
      for(let j=1;j<=12;j++){const t=j/12,bend=Math.sin(t*Math.PI)*slack*(i%2?1:-1),x=n.x+dx*t-dy/d*bend,y=n.y+dy*t+dx/d*bend;
        ctx.beginPath();ctx.moveTo(Math.round(px),Math.round(py));ctx.lineTo(Math.round(x),Math.round(y));ctx.strokeStyle='#582a2c';ctx.lineWidth=7*(1-t)+2;ctx.stroke();ctx.strokeStyle=i%3?'#b65b49':'#df8865';ctx.lineWidth=4*(1-t)+1;ctx.stroke();px=x;py=y;}
      if(l.anchor){ctx.fillStyle='#e9a17b';ctx.fillRect(Math.round(tip.x)-2,Math.round(tip.y)-2,4,4);ctx.fillStyle='#753e37';ctx.fillRect(Math.round(tip.x+l.anchor.nx*3)-2,Math.round(tip.y+l.anchor.ny*3)-2,4,4);}
    }
  }
  function creature(s){
    tendrils(s);
    for(let i=s.nodes.length-1;i>0;i--){const n=s.nodes[i],p=s.nodes[n.parent];ctx.strokeStyle='#612b2b';ctx.lineWidth=(n.r+p.r)*1.2;ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.strokeStyle='#c45742';ctx.lineWidth=(n.r+p.r)*.7;ctx.stroke();}
    for(let i=s.nodes.length-1;i>=0;i--){const n=s.nodes[i],p=s.nodes[n.parent]||n,size=n.r*3.4;ctx.save();ctx.translate(Math.round(n.x),Math.round(n.y));ctx.rotate(Math.atan2(n.y-p.y,n.x-p.x)+(i%2)*.7);ctx.globalAlpha=s.invulnerable>0&&Math.floor(s.time*18)%2?.6:1;sprite(ctx,i%3===0?9:8,-size/2,-size/2,size);ctx.restore();}
    const h=s.nodes[0];ctx.save();ctx.translate(Math.round(h.x),Math.round(h.y));ctx.rotate(Math.atan2(s.aimY,s.aimX));sprite(ctx,s.grab?10:11,-10,-11,25,22);ctx.restore();
    if(s.grab){const o=(s.grab.type==='enemy'?currentRoom(s).enemies:currentRoom(s).objects).find(o=>o.id===s.grab.id);if(o){ctx.strokeStyle='#ffad7e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.quadraticCurveTo((h.x+o.x)/2,h.y-22,o.x,o.y);ctx.stroke();}}
  }
  function draw(s,now=performance.now()){
    if(!canvas.width)resize();if(roomId!==s.room)background(s.room);
    const dt=Math.min(.08,Math.max(0,(now-previous)/1000));previous=now;
    const tx=viewW>=WIDTH?WIDTH/2:clamp(s.x,viewW/2,WIDTH-viewW/2),ty=viewH>=HEIGHT?HEIGHT/2:clamp(s.y,viewH/2,HEIGHT-viewH/2),ease=reduced.matches?1:1-Math.exp(-dt*9);
    camX+=(tx-camX)*ease;camY+=(ty-camY)*ease;
    ctx.fillStyle='#091117';ctx.fillRect(0,0,viewW,viewH);ctx.save();ctx.translate(Math.round(viewW/2-camX),Math.round(viewH/2-camY));ctx.drawImage(cache,0,0);
    for(const d of s.decals)if(d.room===s.room){ctx.fillStyle='#672f2d';ctx.fillRect(d.x-d.size,d.y,d.size*2,3);}
    const room=currentRoom(s),gate=ROOMS[s.room].gate;
    for(const o of room.objects)if(o.kind==='lamp'){
      if(!o.broken){ctx.drawImage(glow,Math.round(o.x)-96,Math.round(o.y)-72);ctx.strokeStyle='#697e78';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(o.x,o.mountY);ctx.lineTo(o.x,o.y-11);ctx.stroke();sprite(ctx,14,o.x-12,o.y-14,24,30);}
      else fixture(ctx,7,o.x-13,o.y-9,26,20);
    }
    if(gate){if(!room.gateOpen){for(let y=48;y<384;y+=24)if(y<192||y>=288)sprite(ctx,0,gate.x,y,24);sprite(ctx,5,gate.x-6,184,36,106);ctx.fillStyle=gate.kind==='heavy'?'#e2ab62':'#e67b5c';ctx.fillRect(gate.x+10,193,3,83);}
      else{sprite(ctx,15,gate.x-16,360,54,30);ctx.fillStyle='#8bccad';ctx.fillRect(gate.x+8,180,8,3);}}
    for(const o of room.objects){if(o.kind==='lamp')continue;const index={capsule:4,tank:6,feed:6,lever:7,crate:13,desk:12,console:12,terminal:12}[o.kind];
      const sizes={capsule:[70,105],tank:[68,63],feed:[68,63],lever:[30,48],crate:[40,38],desk:[64,58],console:[53,49],terminal:[61,60]}[o.kind];
      sprite(ctx,index,o.x-sizes[0]/2,o.y+26-sizes[1],...sizes);
      if(o.kind==='tank'||o.kind==='feed'){ctx.fillStyle='#b0d9b5';ctx.font='8px monospace';ctx.fillText(o.kind==='feed'?'ПИТАНИЕ':o.bank?'+ МАССА':'РЕЗЕРВ',o.x-21,o.y-42);}
    }
    const target=targetFor(s);
    if(target?.type==='object'){const o=room.objects.find(o=>o.id===target.id);if(o?.kind==='lamp'){ctx.strokeStyle='#f5cb9b';ctx.lineWidth=1;ctx.strokeRect(Math.round(o.x)-16,Math.round(o.y)-18,32,38);}}
    for(const e of room.enemies){if(e.eaten)continue;const moving=e.kind==='tech'&&e.alert>0,frame=e.dead?5:e.hurt>0?4:e.windup>.1?3:moving?1+Math.floor(s.time*9)%2:0;
      ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y+26));ctx.scale(e.dir<0?-1:1,1);ctx.drawImage(people,frame*64,(e.kind==='guard'?1:0)*64,64,64,-32,-58,64,64);ctx.restore();
      if(!e.dead&&e.alert>0){ctx.fillStyle=e.kind==='guard'?'#efb667':'#f49770';ctx.fillRect(e.x-1,e.y-42,2,6);ctx.fillRect(e.x-1,e.y-34,2,2);}
      if(e.windup>0){ctx.strokeStyle='#e7ab6577';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(e.x,e.y-5);ctx.lineTo(s.x,s.y);ctx.stroke();}
      if(target?.id===e.id){ctx.strokeStyle='#f5cb9b';ctx.lineWidth=1;ctx.strokeRect(Math.round(e.x)-17,Math.round(e.y)-28,34,51);}
    }
    creature(s);
    for(const b of s.bullets){ctx.strokeStyle='#ffe6ab';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*.018,b.y-b.vy*.018);ctx.stroke();}
    for(const p of s.particles){ctx.fillStyle=p.color;ctx.globalAlpha=p.life/p.max;ctx.fillRect(Math.round(p.x),Math.round(p.y),2,2);}ctx.globalAlpha=1;
    ctx.restore();
    if(s.invulnerable>.1&&!reduced.matches){ctx.fillStyle='#e66a4812';ctx.fillRect(0,0,viewW,viewH);}
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  return{draw,resize,worldPoint:(x,y)=>{const r=canvas.getBoundingClientRect();return{x:(x-r.left)/r.width*viewW+camX-viewW/2,y:(y-r.top)/r.height*viewH+camY-viewH/2};},destroy:()=>observer.disconnect(),metrics:()=>({width:viewW,height:viewH,cameraX:camX,cameraY:camY})};
}
