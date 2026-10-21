import {TILE,WIDTH,HEIGHT,ROOMS,formFor} from './world.mjs';
import {currentRoom,blocked,targetFor} from './engine.mjs';
import {SCENES,VISUAL_LIMITS} from './presentation.mjs';
import {drawOrganism} from './organism.mjs?v=4';

const path='/static/assets/specimen/';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function load(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Не удалось загрузить графику сектора.'));img.src=src;});}
function surfaceCanvas(w,h){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;return[canvas,c];}

export async function createRenderer(canvas){
  const [atlas,people,fixtures,sector,tissue]=await Promise.all(['atlas','people','fixtures','sector','tissue'].map(name=>load(path+name+'.png?v=3')));
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
  gradient.addColorStop(0,'#ffdcaa70');gradient.addColorStop(.26,'#e1a77538');gradient.addColorStop(1,'#b65e4c00');gc.fillStyle=gradient;gc.fillRect(0,0,256,256);

  function resize(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    const scale=r.height>r.width?r.width/(r.width<600?360:540):Math.min(r.width/768,r.height/432);
    viewW=Math.round(r.width/scale);viewH=Math.round(r.height/scale);canvas.width=viewW;canvas.height=viewH;ctx.imageSmoothingEnabled=false;
    vignette.width=viewW;vignette.height=viewH;const v=vc.createRadialGradient(viewW/2,viewH*.47,Math.min(viewW,viewH)*.27,viewW/2,viewH/2,Math.max(viewW,viewH)*.65);
    v.addColorStop(0,'#08061000');v.addColorStop(1,'#06040d99');vc.fillStyle=v;vc.fillRect(0,0,viewW,viewH);roomId=-1;
  }
  function wire(c,x,y,ex,ey,sag,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo((x+ex)/2,Math.max(y,ey)+sag,ex,ey);c.stroke();}
  function buildBackground(id){
    roomId=id;visibilityKey='';const r=ROOMS[id],scene=SCENES[id];
    bg.clearRect(0,0,WIDTH,HEIGHT);fg.clearRect(0,0,WIDTH,HEIGHT);bg.fillStyle='#16131f';bg.fillRect(0,0,WIDTH,HEIGHT);
    bg.globalAlpha=.78;for(let y=0;y<HEIGHT;y+=96)for(let x=0;x<WIDTH;x+=96)steel(bg,1,x,y,96);bg.globalAlpha=1;
    bg.fillStyle='#08081066';bg.fillRect(49,49,670,335);
    for(let x=78;x<WIDTH-45;x+=96){bg.fillStyle='#302936';bg.fillRect(x,50,5,334);bg.fillStyle='#090911';bg.fillRect(x+5,50,6,334);bg.fillStyle='#65505b';bg.fillRect(x,50,1,334);}
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
    for(const [x,y,w]of r.walls){
      const left=x*TILE,top=y*TILE;
      for(let sx=left+15;sx<left+w*TILE;sx+=96){bg.strokeStyle='#473943';bg.lineWidth=5;bg.beginPath();bg.moveTo(sx,top+24);bg.lineTo(sx,384);bg.stroke();bg.strokeStyle='#17131e';bg.lineWidth=3;bg.beginPath();bg.moveTo(sx+2,top+24);bg.lineTo(sx+2,384);bg.stroke();wire(bg,sx,top+25,sx+37,top+57,0,'#67505a',2);}
      for(let rx=left;rx<left+w*TILE;rx+=48){if(r.ladders.some(([lx,ly])=>ly===top&&Math.abs(lx-rx-24)<25))continue;steel(bg,8,rx,top-23,48,24);}
      steel(bg,10,left,top+30,Math.min(144,w*TILE),42);
    }
    for(const [x,top,bottom]of r.ladders){
      bg.fillStyle='#151019';bg.fillRect(x-12,top,25,bottom-top);
      for(let y=top+5;y<bottom;y+=48)fixture(bg,4,x-8,y,16,Math.min(48,bottom-y));
      bg.fillStyle='#9f8588';bg.fillRect(x-12,top-5,2,13);bg.fillRect(x+11,top-5,2,13);
    }
    wire(bg,58,58,705,58,48,'#3b2a30',3);wire(bg,58,62,705,62,39,'#6a4d48',1);
    wire(bg,68,204,280,209,38,'#594248',2);wire(bg,438,204,695,192,40,'#3d2935',2);
    if(scene.moss)for(const x of [70,198,360,462,618])steel(bg,13,x,364,64,21);
    const at=(x,y)=>x<0||x>=32||y<0||y>=18?1:r.cells[y*32+x];
    for(let y=0;y<18;y++)for(let x=0;x<32;x++)if(at(x,y)){
      const px=x*TILE,py=y*TILE,top=!at(x,y-1),bottom=!at(x,y+1),left=!at(x-1,y),right=!at(x+1,y),edge=top||bottom||left||right;
      fg.fillStyle='#09080f';fg.fillRect(px,py,TILE,TILE);
      fg.globalAlpha=edge?.91:.18;steel(fg,edge?0:2,px,py,TILE);fg.globalAlpha=1;
      if(top){fg.fillStyle='#93828b';fg.fillRect(px,py,TILE,2);fg.fillStyle='#d0b7b1';for(let j=0;j<6;j++)if(hash(x*37+y*19+j)>.5)fg.fillRect(px+j*4,py,2,1);fg.fillStyle='#211923';fg.fillRect(px,py+8,TILE,3);}
      if(bottom){fg.fillStyle='#211723';fg.fillRect(px,py,TILE,13);fg.fillStyle='#65505e';fg.fillRect(px,py+TILE-2,TILE,1);steel(fg,14,px,py+5,TILE,19);}
      if(left){fg.fillStyle='#ab9295';fg.fillRect(px,py,1,TILE);fg.fillStyle='#3e2e3d';fg.fillRect(px+2,py,2,TILE);}
      if(right){fg.fillStyle='#816b7c';fg.fillRect(px+TILE-2,py,2,TILE);}
    }
    if(r.vent){const v=r.vent;fg.strokeStyle='#9b8997';fg.lineWidth=1;fg.strokeRect(v.x-2,v.y+2,v.w+4,v.h-4);fg.fillStyle='#bba284';fg.font='8px monospace';fg.fillText('Ø 36',v.x-4,v.y-8);}
    for(const x of id?[49,698]:[698]){bg.fillStyle='#747365';bg.fillRect(x,218,18,10);bg.fillStyle='#161a1a';bg.fillRect(x+3,222,10,2);bg.fillRect(x+10,220,2,6);}
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
    const room=currentRoom(s),key=s.room+':'+room.gateOpen+':'+formFor(s.mass)+':'+room.objects.filter(o=>o.kind==='lamp').map(o=>o.broken?'0':'1').join('');
    if(key===visibilityKey){ctx.save();ctx.globalCompositeOperation='multiply';ctx.drawImage(lightmap,0,0,WIDTH,HEIGHT);ctx.restore();return;}
    const sources=[...room.objects.filter(o=>o.kind==='lamp'&&!o.broken).map(o=>({x:o.x,y:o.y,color:'#fff3da'})),...SCENES[s.room].fans.map(([x,y])=>({x,y,color:'#fff0dd'}))];
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
      if(o.kind==='lamp'){if(!o.broken){ctx.strokeStyle='#7c6068';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(o.x,o.mountY);ctx.lineTo(o.x,o.y-12);ctx.stroke();steel(ctx,11,o.x-9,o.y-16,18,31);}else fixture(ctx,7,o.x-13,o.y-9,26,20);continue;}
      const index={capsule:4,tank:6,feed:6,lever:7,crate:13,desk:12,console:12,terminal:12}[o.kind],sizes={capsule:[59,99],tank:[57,59],feed:[57,59],lever:[25,43],crate:[34,34],desk:[61,52],console:[49,45],terminal:[56,55]}[o.kind];
      sprite(ctx,index,o.x-sizes[0]/2,o.y+26-sizes[1],...sizes);
      if(o.kind==='tank'||o.kind==='feed'){ctx.fillStyle='#b3c1a4';ctx.font='8px monospace';ctx.fillText(o.kind==='feed'?'ПИТАНИЕ':o.bank?'+ МАССА':'РЕЗЕРВ',o.x-21,o.y-40);}
    }
  }
  function peopleIn(s){
    const target=targetFor(s);
    for(const e of currentRoom(s).enemies){if(e.eaten)continue;const moving=e.kind==='tech'&&e.alert>0,frame=e.dead?5:e.hurt>0?4:e.windup>.1?3:moving?1+Math.floor(s.time*9)%2:0;
      ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y+26));ctx.scale(e.dir<0?-1:1,1);ctx.drawImage(people,frame*64,(e.kind==='guard'?1:0)*64,64,64,-32,-58,64,64);ctx.restore();
      if(!e.dead&&e.alert>0){ctx.fillStyle='#e8ad78';ctx.fillRect(e.x-1,e.y-42,2,6);ctx.fillRect(e.x-1,e.y-34,2,2);}
      if(e.windup>0){ctx.strokeStyle='#ed9d6866';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(e.x,e.y-5);ctx.lineTo(s.x,s.y);ctx.stroke();}
      if(target?.id===e.id){ctx.strokeStyle='#efd2b2';ctx.lineWidth=1;ctx.strokeRect(Math.round(e.x)-17,Math.round(e.y)-28,34,51);}
    }
    if(target?.type==='object'){const o=currentRoom(s).objects.find(o=>o.id===target.id);if(o?.kind==='lamp'){ctx.strokeStyle='#efd2b2';ctx.lineWidth=1;ctx.strokeRect(Math.round(o.x)-13,Math.round(o.y)-18,26,36);}}
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
    for(const d of s.decals)if(d.room===s.room){ctx.globalAlpha=.75;flesh(ctx,6,d.x-d.size*2,d.y-5,d.size*4,14);ctx.globalAlpha=1;}
    props(s);peopleIn(s);creature(s);
    for(const b of s.bullets){ctx.strokeStyle='#ffdf9d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*.018,b.y-b.vy*.018);ctx.stroke();}
    for(const p of s.particles){ctx.fillStyle=p.color;ctx.globalAlpha=p.life/p.max;ctx.fillRect(Math.round(p.x),Math.round(p.y),2,2);}ctx.globalAlpha=1;
    ctx.drawImage(front,0,0);
    const room=currentRoom(s),gate=ROOMS[s.room].gate;
    if(gate){if(!room.gateOpen){for(let y=48;y<384;y+=24)if(y<192||y>=288)steel(ctx,0,gate.x,y,24);steel(ctx,7,gate.x-9,184,42,106);ctx.fillStyle='#e74347';ctx.fillRect(gate.x+10,197,2,77);}else{steel(ctx,14,gate.x-15,367,52,18);ctx.fillStyle='#aecab0';ctx.fillRect(gate.x+8,180,8,2);}}
    illuminate(s);atmosphere(s);ctx.restore();ctx.drawImage(vignette,0,0);
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  return{draw,resize,worldPoint:(x,y)=>{const r=canvas.getBoundingClientRect();return{x:(x-r.left)/r.width*viewW+camX-viewW/2,y:(y-r.top)/r.height*viewH+camY-viewH/2};},destroy:()=>observer.disconnect(),metrics:()=>({width:viewW,height:viewH,cameraX:camX,cameraY:camY,visualStyle:'industrial-crimson',lightRays:VISUAL_LIMITS.rays,dust:VISUAL_LIMITS.dust})};
}
