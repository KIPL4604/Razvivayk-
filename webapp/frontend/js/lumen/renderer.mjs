// Original Canvas artwork. No sprites, fonts or textures are fetched externally.
const TAU = Math.PI * 2;
function circle(c,x,y,r,fill,stroke) {c.beginPath();c.arc(x,y,r,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function ellipse(c,x,y,rx,ry,fill) {c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();}
function line(c,points,color,width=1) {c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function poly(c,points,fill,stroke) {c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}}
function glow(c,x,y,r,color) {const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');circle(c,x,y,r,g);}
function plant(c,x,y,size,flip=1) {
  c.save();c.translate(x,y);c.scale(size*flip,size);
  for(let i=0;i<5;i++){const a=-2.7+i*.58;c.save();c.rotate(a);poly(c,[[0,0],[12,-6],[28,0],[12,6]],i%2?'#466D5D':'#2F574A');line(c,[[0,0],[25,0]],'#6D9270');c.restore();}
  c.restore();
}
function hero(c,x,y,t,character='scout',invulnerable=0,moving=false) {
  c.save();c.translate(x,y);const bob=moving?Math.sin(t*14)*1.5:Math.sin(t*2)*.7;
  ellipse(c,0,15,15,6,'#061B2490');
  if(invulnerable>0)circle(c,0,0,26,null,'#BDF8DF99');
  c.translate(0,bob);
  const cloak=character==='keeper'?'#C8875B':'#438E8B';
  poly(c,[[-10,-3],[8,-4],[16,21],[1,18],[-13,21]],cloak,'#192E35');
  line(c,[[-7,3],[-6,15]],'#81ADA1',2);
  ellipse(c,-5,17,4,3,'#13272E');ellipse(c,6,17,4,3,'#13272E');
  ellipse(c,0,0,11,14,'#E1D8B7');
  poly(c,[[-10,-1],[-8,-13],[0,-19],[10,-10],[12,-1]],'#EEE5CF','#A5B8A9');
  ellipse(c,0,0,8,7,'#253E40');line(c,[[-4,-1],[4,-1]],'#AAEDD5',3);
  c.fillStyle='#B57C56';c.fillRect(-11,7,22,4);circle(c,0,8,3,'#EDD5A6');
  line(c,[[12,-5],[17,17]],'#D4B57B',3);circle(c,13,-7,5,'#94F5D4');
  circle(c,13,-7,2,'#E9FFF1');
  c.restore();
}
function enemySprite(kind) {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d');c.translate(64,64);c.scale(1.65,1.65);
  if(kind==='guardian'){
    ellipse(c,0,22,28,9,'#061B24A0');
    for(let i=0;i<6;i++){const a=i*TAU/6;c.save();c.rotate(a);poly(c,[[10,-7],[29,-11],[32,4],[14,9]],'#647B6F','#A1A18A');c.restore();}
    circle(c,0,0,24,'#A2A48B','#D0C7A8');circle(c,0,0,18,'#244E4C','#D0AB70');
    poly(c,[[0,-15],[11,0],[0,15],[-11,0]],'#E9AB68');circle(c,0,0,5,'#FFF2B5');
    for(let i=0;i<4;i++){const a=i*TAU/4+.4;circle(c,Math.cos(a)*20,Math.sin(a)*20,3,'#E3C282');}
  }else if(kind==='wasp'){
    ellipse(c,0,15,15,5,'#061B2480');ellipse(c,-12,-3,13,7,'#BBBCD37A');ellipse(c,12,-3,13,7,'#BBBCD37A');
    line(c,[[-21,-3],[-5,2],[21,-3]],'#CBD4DD',1);ellipse(c,0,3,8,12,'#8B83A8');
    poly(c,[[-7,-4],[0,-12],[7,-4],[0,4]],'#E1C6BD');circle(c,0,-4,3,'#F6B7A9');
    line(c,[[0,11],[0,20]],'#C9B8C9',2);
  }else if(kind==='beetle'){
    ellipse(c,0,14,17,6,'#061B2490');
    for(let i=0;i<3;i++){line(c,[[-7,-7+i*7],[-18,-12+i*10],[-22,-7+i*10]],'#A17C5E',2);line(c,[[7,-7+i*7],[18,-12+i*10],[22,-7+i*10]],'#A17C5E',2);}
    ellipse(c,0,0,14,17,'#B5A17D');ellipse(c,0,-2,11,13,'#D8C8A1');line(c,[[0,-14],[0,12]],'#6E7964',2);
    circle(c,0,-16,7,'#3A594D');circle(c,-3,-18,2,'#F4D482');circle(c,3,-18,2,'#F4D482');
  }else{
    ellipse(c,0,12,10,4,'#061B2470');poly(c,[[0,-15],[11,-2],[8,10],[-8,10],[-11,-2]],'#B57153','#E3B382');
    poly(c,[[0,-9],[6,-2],[0,5],[-6,-2]],'#F3C37C');circle(c,0,-1,3,'#FFF3C1');
    line(c,[[-6,8],[-10,14]],'#C5976E',2);line(c,[[6,8],[10,14]],'#C5976E',2);
  }
  return canvas;
}
function groundTile() {
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=384;
  const c=canvas.getContext('2d');c.fillStyle='#183438';c.fillRect(0,0,384,384);
  for(let y=0;y<6;y++)for(let x=0;x<6;x++){
    const n=((x*73+y*97+17)%41)/41;
    c.fillStyle=['#1A393B','#1B3A3C','#1D3C3E'][Math.floor(n*3)];c.fillRect(x*64+1,y*64+1,62,62);
    line(c,[[x*64+3,y*64+3],[x*64+61,y*64+3]],'#294647');
    if(n>.6)line(c,[[x*64+44,y*64+3],[x*64+39,y*64+14],[x*64+48,y*64+22]],'#102D31');
    if(n<.3){ellipse(c,x*64+15,y*64+44,10,4,'#244C43');circle(c,x*64+18,y*64+43,2,'#54735A');}
  }
  for(let i=0;i<52;i++){const x=(i*173+19)%384,y=(i*97+53)%384;c.fillStyle=i%3?'#496052':'#758067';c.fillRect(x,y,1,i%3+1);}
  return canvas;
}
export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    if(!this.ctx)throw new Error('Canvas 2D unavailable');
    this.pattern=this.ctx.createPattern(groundTile(),'repeat');
    this.sprites=Object.fromEntries(['mote','beetle','wasp','guardian'].map(k=>[k,enemySprite(k)]));
    this.width=0;this.height=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  resize() {
    const box=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.75);
    if(!box.width||!box.height)return;
    this.width=box.width;this.height=box.height;
    const w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    this.dpr=dpr;this.scale=Math.max(.72,Math.min(1.25,Math.min(box.width/650,box.height/650)));
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  draw(state,preview=false) {
    const c=this.ctx,w=this.width,h=this.height;if(!w||!h)return;
    const p=state.player,t=state.time||0,s=this.scale;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#102B30';c.fillRect(0,0,w,h);
    c.save();c.translate(w/2,h*.49);c.scale(s,s);c.translate(-p.x,-p.y);
    const left=p.x-w/s/2,top=p.y-h/s/2;
    c.fillStyle=this.pattern;c.fillRect(left-80,top-100,w/s+160,h/s+200);
    // Garden beds are deterministic scenery, never invisible collision walls.
    for(let gy=Math.floor(top/330)-1;gy<Math.ceil((top+h/s)/330)+1;gy++){
      for(let gx=Math.floor(left/390)-1;gx<Math.ceil((left+w/s)/390)+1;gx++){
        const x=gx*390+Math.sin(gy*4)*60+120,y=gy*330+80;
        if(Math.hypot(x,y)<150)continue;
        ellipse(c,x,y+14,50,19,'#0D292C');ellipse(c,x,y+8,46,18,'#35584C');
        plant(c,x-18,y+4,1.3);plant(c,x+17,y+8,.9,-1);
        for(let i=0;i<3;i++){const fx=x-20+i*19,fy=y-9-i%2*11;line(c,[[fx,fy+12],[fx,fy]],'#68917C',2);ellipse(c,fx,fy,6,3,'#A8CABC');circle(c,fx,fy-1,2,'#D6E0B4');}
      }
    }
    this.beacon(c,0,0,t);
    // Small floor lights guide the player without enclosing the arena.
    for(let i=0;i<8;i++){const a=i*TAU/8,x=Math.cos(a)*280,y=Math.sin(a)*280;
      ellipse(c,x,y+6,10,5,'#0A252B');c.fillStyle='#7A8170';c.fillRect(x-5,y-5,10,10);circle(c,x,y-6,3,'#A3E1BD');}
    for(const gem of state.gems||[]){const x=gem.x,y=gem.y;
      poly(c,[[x,y-5],[x+4,y],[x,y+6],[x-4,y]],gem.value>=5?'#F0C280':'#80D9B1');
      line(c,[[x,y-3],[x+2,y]],'#E2FFE2');
    }
    if(state.upgrades?.orbit){
      const count=1+state.upgrades.orbit,radius=76+state.upgrades.orbit*6;
      circle(c,p.x,p.y,radius,null,'#7ED9B426');
      for(let i=0;i<count;i++){const a=state.orbitAngle+i*TAU/count,x=p.x+Math.cos(a)*radius,y=p.y+Math.sin(a)*radius;circle(c,x,y,6,'#B6F3D5','#6DAF97');circle(c,x-1,y-2,2,'#F4FFE3');}
    }
    const entities=[...(state.enemies||[]),{...p,kind:'hero'}].sort((a,b)=>a.y-b.y);
    for(const e of entities){
      if(Math.abs(e.x-p.x)>w/s*.6+80||Math.abs(e.y-p.y)>h/s*.6+90)continue;
      if(e.kind==='hero'){hero(c,p.x,p.y,t,state.character,p.invulnerable,Boolean(state.moving));continue;}
      const radius=e.radius||12,size=e.kind==='guardian'?radius*3.4:radius*4.6;
      const sprite=this.sprites[e.kind]||this.sprites.mote;
      c.save();c.translate(e.x,e.y);if(!this.reduced)c.rotate(Math.sin(t*6+e.id)*.08);
      c.drawImage(sprite,-size/2,-size/2,size,size);c.restore();
      if(e.hitFlash>0)circle(c,e.x,e.y,radius+3,null,'#FFF7D2');
      if(e.kind==='guardian'||e.hp<e.maxHp){c.fillStyle='#0A242A';c.fillRect(e.x-radius,e.y-radius-15,radius*2,4);c.fillStyle=e.kind==='guardian'?'#E6AA70':'#A8D7B4';c.fillRect(e.x-radius,e.y-radius-15,radius*2*Math.max(0,e.hp/e.maxHp),4);}
    }
    for(const shot of state.projectiles||[]){
      line(c,[[shot.x-(shot.vx||0)*.025,shot.y-(shot.vy||0)*.025],[shot.x,shot.y]],shot.hostile?'#D1886C':'#7BC9B4',4);
      if(shot.hostile)poly(c,[[shot.x,shot.y-7],[shot.x+6,shot.y],[shot.x,shot.y+7],[shot.x-6,shot.y]],'#F6BB88','#FFE3B4');
      else circle(c,shot.x,shot.y,shot.radius||3,'#DAFFDD');
    }
    for(const effect of state.effects||[]){
      if(this.reduced&&!['pulse','warning'].includes(effect.kind))continue;
      c.save();c.globalAlpha=Math.min(.7,effect.life/(effect.maxLife||.5));
      if(effect.kind==='pulse'){c.lineWidth=3;circle(c,effect.x,effect.y,effect.radius||80,null,'#ADFFCF');}
      else if(effect.kind==='warning'){c.lineWidth=2;circle(c,effect.x,effect.y,effect.radius,null,'#F5C18A');}
      else {circle(c,effect.x,effect.y,(effect.radius||10)*(1.2-effect.life/(effect.maxLife||.5)),null,effect.kind==='hurt'?'#EDA47C':'#BDEDC9');}
      c.restore();
    }
    if(!this.reduced){for(let i=0;i<16;i++){const x=left+((i*179+t*3)%(w/s+100)),y=top+((i*127+Math.sin(t+i)*8)%(h/s+100));circle(c,x,y,1,'#ADD8BC77');}}
    c.restore();
    const vignette=c.createRadialGradient(w/2,h*.45,Math.min(w,h)*.2,w/2,h/2,Math.max(w,h)*.72);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#031C277D');c.fillStyle=vignette;c.fillRect(0,0,w,h);
    if(preview){const g=c.createLinearGradient(0,h*.4,0,h);g.addColorStop(0,'transparent');g.addColorStop(1,'#09242DF2');c.fillStyle=g;c.fillRect(0,0,w,h);}
  }
  beacon(c,x,y,t) {
    glow(c,x,y,160,'#64DFBA18');
    ellipse(c,x,y+30,56,27,'#0B292F');ellipse(c,x,y+23,49,23,'#4B6559');
    ellipse(c,x,y+16,45,22,'#718475');ellipse(c,x,y+12,40,19,'#2D4C49');
    c.lineWidth=1;ellipse(c,x,y+10,32,14,'#254B47');
    for(let i=0;i<8;i++){const a=i*TAU/8;circle(c,x+Math.cos(a)*34,y+10+Math.sin(a)*13,1.8,'#B8DBAE');}
    poly(c,[[x-18,y+8],[x-22,y-33],[x,y-67],[x+22,y-33],[x+18,y+8],[x,y+20]],'#B3C9B2','#E8DEAD');
    poly(c,[[x,y-60],[x+12,y-30],[x,y+11],[x-12,y-30]],'#78DDB5');
    poly(c,[[x,y-60],[x+12,y-30],[x,y+11]],'#AFEFD0');
    line(c,[[x-20,y-30],[x+20,y-30]],'#DAE9C0');
    if(!this.reduced)glow(c,x,y-27,31+Math.sin(t*2)*4,'#87F2C347');
  }
  destroy(){this.canvas.width=1;this.canvas.height=1;this.sprites={};this.pattern=null;}
}
