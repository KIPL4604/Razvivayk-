import {TILE,WIDTH,HEIGHT,ROOMS,FORMS,formFor,freshRoom} from './world.mjs';
import {updateAnchors,constrainAnchors} from './locomotion.mjs';
export {ROOMS,FORMS,formFor};
export const VERSION=2, LIMITS=Object.freeze({nodes:16,limbs:10,bullets:40,particles:90,decals:36});
const H=1/60,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),hyp=Math.hypot;
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
export function currentRoom(s){return s.rooms[s.room];}
export function notice(s,message){s.message=message;s.messageTime=4;s.event++;}
function makeNode(x,y,r,parent){return{x,y,px:x,py:y,r,parent};}
function resize(s){
  const f=FORMS[formFor(s.mass)],nodes=s.nodes;
  if(nodes.length>f.nodes)nodes.length=f.nodes;
  for(let i=0;i<nodes.length;i++)nodes[i].r=f.r*(i===0?1.12:.8+(i%3)*.1);
  while(nodes.length<f.nodes){const i=nodes.length;if(i===0){nodes.push(makeNode(s.x,s.y,f.r*1.12,0));continue;}const parent=i<4?Math.max(0,i-1):i-3,p=nodes[parent];
    nodes.push(makeNode(p.x-6,p.y+(i%2?4:-4),f.r,parent));}
  if(s.limbs)updateAnchors(s,0,0,blocked,0);
}
export function createRun(){
  const s={version:VERSION,room:0,rooms:ROOMS.map(freshRoom),nodes:[],limbs:[],x:184,y:236,mass:32,time:0,ticks:0,accumulator:0,
    status:'playing',visited:[0],grab:null,grabTime:0,aimX:1,aimY:0,dash:0,dashCooldown:0,invulnerable:0,
    bullets:[],particles:[],decals:[],kills:0,event:0,checkpointEvent:0,message:'Ты проснулся. Найди выход из изолятора.',messageTime:6};
  resize(s);updateAnchors(s,0,0,blocked,H);return s;
}
function rectPush(n,b){
  const nx=clamp(n.x,b.x,b.x+b.w),ny=clamp(n.y,b.y,b.y+b.h),dx=n.x-nx,dy=n.y-ny,d=hyp(dx,dy);
  if(d>=n.r)return;
  if(d>.0001){n.x+=dx/d*(n.r-d);n.y+=dy/d*(n.r-d);return;}
  const distances=[n.x-b.x,b.x+b.w-n.x,n.y-b.y,b.y+b.h-n.y],side=distances.indexOf(Math.min(...distances));
  if(side===0)n.x=b.x-n.r;else if(side===1)n.x=b.x+b.w+n.r;else if(side===2)n.y=b.y-n.r;else n.y=b.y+b.h+n.r;
}
export function blocked(s,x,y){
  if(x<0||x>=WIDTH||y<0||y>=HEIGHT)return true;
  const room=ROOMS[s.room];if(room.cells[Math.floor(y/TILE)*32+Math.floor(x/TILE)])return true;
  const inside=b=>b&&x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h;
  return !!((!currentRoom(s).gateOpen&&inside(room.gate))||(formFor(s.mass)>0&&inside(room.vent)));
}
export function lineClear(s,x,y,tx,ty){const d=hyp(tx-x,ty-y),steps=Math.ceil(d/5);for(let i=1;i<=steps;i++)if(blocked(s,x+(tx-x)*i/steps,y+(ty-y)*i/steps))return false;return true;}
function collide(s,n){
  const room=ROOMS[s.room],minX=clamp(Math.floor((n.x-n.r)/TILE),0,31),maxX=clamp(Math.floor((n.x+n.r)/TILE),0,31),minY=clamp(Math.floor((n.y-n.r)/TILE),0,17),maxY=clamp(Math.floor((n.y+n.r)/TILE),0,17);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(room.cells[y*32+x])rectPush(n,{x:x*TILE,y:y*TILE,w:TILE,h:TILE});
  if(room.gate&&!currentRoom(s).gateOpen)rectPush(n,room.gate);
  if(room.vent&&formFor(s.mass)>0)rectPush(n,room.vent);
  n.x=clamp(n.x,n.r,WIDTH-n.r);n.y=clamp(n.y,n.r,HEIGHT-n.r);
}
function moveNode(s,n,dx,dy){const count=Math.max(1,Math.ceil(hyp(dx,dy)/5));for(let i=0;i<count;i++){n.x+=dx/count;collide(s,n);n.y+=dy/count;collide(s,n);}}
function particles(s,x,y,color,count=8){
  for(let i=0;i<count&&s.particles.length<LIMITS.particles;i++){const a=(s.ticks+i*7)*2.399;s.particles.push({x,y,vx:Math.cos(a)*(20+i*4),vy:Math.sin(a)*(20+i*4),life:.35+i*.035,max:.35+i*.035,color});}
}
function decal(s,x,y){s.decals.push({room:s.room,x,y,size:6+(s.ticks%8)});if(s.decals.length>LIMITS.decals)s.decals.shift();}
export function breakLamp(s,o){
  if(o.kind!=='lamp'||o.broken)return false;o.broken=true;o.fallV=0;
  particles(s,o.x,o.y,'#e7c990',17);particles(s,o.x,o.y,'#a3b7b1',8);notice(s,'Лампа разбита. Свет погас.');return true;
}
function activate(s,obj){
  const room=currentRoom(s);
  if(obj.kind==='lever'){if(!room.gateOpen){room.gateOpen=true;particles(s,obj.x,obj.y,'#edbc67');notice(s,'Блокировка снята. Изолятор открыт.');}return;}
  if(obj.kind==='terminal'){if(!room.gateOpen){room.gateOpen=true;particles(s,obj.x,obj.y,'#9cd8bd');notice(s,'Стерилизация отменена. Пройди через шлюз.');}return;}
  if(obj.kind==='tank'){
    if(s.mass>36){const shed=s.mass-32;obj.bank=(obj.bank||0)+shed;s.mass=32;resize(s);notice(s,'Масса сохранена в резервуаре. Узкий путь доступен.');}
    else if(obj.bank>0){const take=Math.min(100-s.mass,obj.bank);s.mass+=take;obj.bank-=take;resize(s);notice(s,'Сохранённая масса возвращена.');}
    else notice(s,'Резервуар пуст. Здесь можно оставить лишнюю массу.');
    s.checkpointEvent++;return;
  }
  if(obj.kind==='feed'){s.mass=100;resize(s);notice(s,'Питательный контур восстановил массу. Большая форма готова.');s.checkpointEvent++;return;}
  if(obj.kind==='console'){notice(s,'Состояние сектора сохранено.');s.checkpointEvent++;}
}
export function interaction(s){
  const candidates=currentRoom(s).objects.filter(o=>['lever','terminal','tank','feed','console'].includes(o.kind)).map(o=>({o,d:hyp(o.x-s.x,o.y-s.y)})).filter(v=>v.d<78&&lineClear(s,s.x,s.y,v.o.x,v.o.y));
  candidates.sort((a,b)=>a.d-b.d);const o=candidates[0]?.o;if(!o)return null;
  return {id:o.id,label:o.kind==='tank'?(s.mass>36?'Оставить массу':o.bank?'Вернуть массу':'Резервуар пуст'):o.kind==='feed'?'Восстановить массу':o.kind==='console'?'Сохранить':'Снять блокировку',object:o};
}
function candidate(s){
  const room=currentRoom(s),reach=FORMS[formFor(s.mass)].reach,all=[...room.enemies.filter(e=>!e.eaten).map(e=>({...e,type:'enemy'})),...room.objects.filter(o=>['crate','lever','terminal','lamp'].includes(o.kind)&&!o.broken).map(o=>({...o,type:'object'}))];
  let best=null,score=Infinity;
  for(const o of all){const dx=o.x-s.x,dy=o.y-s.y,d=hyp(dx,dy),dot=d?(dx*s.aimX+dy*s.aimY)/d:1;if(d>reach||dot<.66||!lineClear(s,s.x,s.y,o.x,o.y))continue;
    const value=d*(1.6-dot)+(o.type==='enemy'?-90:20);if(value<score){score=value;best={id:o.id,type:o.type};}}
  return best;
}
export function targetFor(s){return candidate(s);}
function updateGrab(s,input){
  if(!input.grabbing){if(s.grab){s.grab=null;s.grabTime=0;}return;}
  if(!s.grab){s.grab=candidate(s);s.grabTime=0;}
  if(!s.grab)return;
  const room=currentRoom(s),o=(s.grab.type==='enemy'?room.enemies:room.objects).find(v=>v.id===s.grab.id);
  if(!o||o.eaten||hyp(o.x-s.x,o.y-s.y)>FORMS[formFor(s.mass)].reach+35||!lineClear(s,s.x,s.y,o.x,o.y)){s.grab=null;return;}
  if(o.kind==='lever'||o.kind==='terminal'){activate(s,o);s.grab=null;return;}
  s.grabTime+=H;
  if(o.kind==='lamp'){if(s.grabTime>.24){breakLamp(s,o);s.grab=null;s.grabTime=0;}return;}
  const distance=s.grab.type==='enemy'?18:52,tx=s.x+s.aimX*distance,ty=s.y+s.aimY*distance;
  const dx=(tx-o.x)*.1,dy=(ty-o.y)*.1;
  if(lineClear(s,o.x,o.y,o.x+dx,o.y+dy)){o.x+=dx;o.y+=dy;}
  if(s.grab.type==='enemy'){
    o.hurt=.15;o.alert=3;
    if(s.grabTime>.55&&hyp(o.x-s.x,o.y-s.y)<34){o.dead=true;o.eaten=true;s.mass=Math.min(100,s.mass+(o.kind==='guard'?28:22));s.kills++;resize(s);particles(s,o.x,o.y,'#ed7860',14);decal(s,o.x,o.y);s.grab=null;s.grabTime=0;notice(s,'Поглощение · масса растёт.');}
  }
}
function hurt(s,amount){if(s.invulnerable>0)return;s.mass=Math.max(0,s.mass-amount);s.invulnerable=.22;resize(s);particles(s,s.x,s.y,'#ffb286',6);s.event++;if(s.mass<=0){s.status='dead';notice(s,'Связь с образцом потеряна.');}}
function tickAI(s){
  const room=currentRoom(s);
  for(const e of room.enemies){e.hurt=Math.max(0,e.hurt-H);if(e.eaten||e.dead||s.grab?.id===e.id)continue;
    if(e.y<358){e.y=Math.min(358,e.y+150*H);if(blocked(s,e.x,e.y+20))e.y-=150*H;}
    const d=hyp(e.x-s.x,e.y-s.y),sees=d<320&&lineClear(s,e.x,e.y-6,s.x,s.y);
    e.alert=Math.max(0,e.alert-H);e.cooldown=Math.max(0,e.cooldown-H);
    if(sees)e.alert=3;
    if(e.kind==='tech'){
      if(e.alert>0){e.dir=Math.sign(e.x-s.x)||1;const nx=clamp(e.x+e.dir*58*H,66,702);if(!blocked(s,nx+e.dir*14,e.y)&&!blocked(s,nx+e.dir*14,e.y+16))e.x=nx;}
    }else if(sees){
      e.dir=Math.sign(s.x-e.x)||1;
      if(e.cooldown<=0){e.windup+=H;if(e.windup>=.48){const dx=s.x-e.x,dy=s.y-e.y,dist=hyp(dx,dy)||1;
        if(s.bullets.length<LIMITS.bullets)s.bullets.push({x:e.x,y:e.y-5,vx:dx/dist*310,vy:dy/dist*310,life:2});
        particles(s,e.x+e.dir*15,e.y-5,'#ecc477',3);e.windup=0;e.cooldown=.68;}}
    }else e.windup=Math.max(0,e.windup-H*2);
    if(s.dash>0&&formFor(s.mass)>0&&d<42){e.dead=true;particles(s,e.x,e.y,'#ed7860',10);decal(s,e.x,e.y);}
  }
}
function tickBullets(s){
  for(let i=s.bullets.length-1;i>=0;i--){const b=s.bullets[i];b.life-=H;let hit=false;
    for(let j=0;j<3&&!hit;j++){b.x+=b.vx*H/3;b.y+=b.vy*H/3;
      const lamp=currentRoom(s).objects.find(o=>o.kind==='lamp'&&!o.broken&&Math.hypot(o.x-b.x,o.y-b.y)<12);
      if(lamp){breakLamp(s,lamp);hit=true;}
      else if(blocked(s,b.x,b.y)||currentRoom(s).objects.some(o=>o.kind==='crate'&&Math.abs(b.x-o.x)<17&&Math.abs(b.y-o.y)<18)){hit=true;particles(s,b.x,b.y,'#d1ba85',2);}
      else if(s.nodes.some(n=>hyp(n.x-b.x,n.y-b.y)<n.r+2)){hurt(s,7);hit=true;}}
    if(hit||b.life<=0)s.bullets.splice(i,1);
  }
}
function changeRoom(s,delta){
  if(s.room===5&&delta===1){if(currentRoom(s).gateOpen){s.status='won';notice(s,'Образец вышел из сектора. Продолжение следует.');}return;}
  const next=s.room+delta;if(next<0||next>=ROOMS.length)return;
  s.room=next;s.x=delta>0?82:686;s.y=240;s.grab=null;s.bullets.length=0;s.particles.length=0;s.dash=0;s.invulnerable=1;
  s.nodes=[];s.limbs=[];resize(s);updateAnchors(s,0,0,blocked,H);if(!s.visited.includes(next))s.visited.push(next);notice(s,ROOMS[next].subtitle);s.checkpointEvent++;
}
function tick(s,input){
  s.time+=H;s.ticks++;s.messageTime=Math.max(0,s.messageTime-H);s.invulnerable=Math.max(0,s.invulnerable-H);s.dashCooldown=Math.max(0,s.dashCooldown-H);s.dash=Math.max(0,s.dash-H);
  let ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,len=hyp(ix,iy);if(len>1){ix/=len;iy/=len;len=1;}
  if(finite(input.aimX,-1,1)&&finite(input.aimY,-1,1)&&hyp(input.aimX,input.aimY)>.1){const a=hyp(input.aimX,input.aimY);s.aimX=input.aimX/a;s.aimY=input.aimY/a;}
  else if(len>.1&&!input.grabbing){s.aimX=ix/(len||1);s.aimY=iy/(len||1);}
  if(input.burst&&s.dashCooldown<=0){s.dash=.22;s.dashCooldown=1.3;s.dashX=len>.1?ix:s.aimX;s.dashY=len>.1?iy:s.aimY;particles(s,s.x,s.y,'#f39870',9);}
  const f=FORMS[formFor(s.mass)],head=s.nodes[0],oldX=head.x,oldY=head.y;
  const room=ROOMS[s.room],gate=room.gate;
  if(s.dash>0&&gate?.kind==='heavy'&&!currentRoom(s).gateOpen&&Math.abs(head.x-gate.x)<70){
    if(formFor(s.mass)===2){currentRoom(s).gateOpen=true;particles(s,gate.x,head.y,'#a1b0a6',24);notice(s,'Грузовая перегородка разрушена.');s.checkpointEvent++;}
    else notice(s,'Для этой перегородки нужна большая форма.');
  }
  const supports=updateAnchors(s,ix,iy,blocked,H),traction=supports>=2?1:supports===1?.65:.25,speed=f.speed*(s.dash>0?3.2:traction);
  const blend=s.dash>0?1:.38,vx=(head.x-head.px)*(1-blend)+(s.dash>0?s.dashX:ix)*speed*H*blend,
    vy=(head.y-head.py)*(1-blend)+(s.dash>0?s.dashY:iy)*speed*H*blend+(supports?0:170*H*H);
  moveNode(s,head,vx,vy);
  head.px=oldX;head.py=oldY;
  for(let i=1;i<s.nodes.length;i++){const n=s.nodes[i],vx=(n.x-n.px)*.81,vy=(n.y-n.py)*.81;n.px=n.x;n.py=n.y;moveNode(s,n,vx,vy);}
  for(let pass=0;pass<7;pass++)for(let i=1;i<s.nodes.length;i++){
    const n=s.nodes[i],p=s.nodes[n.parent],dx=n.x-p.x,dy=n.y-p.y,d=hyp(dx,dy)||1,max=(n.r+p.r)*.87;
    if(d>max){const excess=(d-max)/d;n.x-=dx*excess*.9;n.y-=dy*excess*.9;if(n.parent>0){p.x+=dx*excess*.1;p.y+=dy*excess*.1;}collide(s,n);}
  }
  constrainAnchors(s,collide);
  s.x=head.x;s.y=head.y;
  if(input.interact){const item=interaction(s);if(item)activate(s,item.object);else notice(s,'Подойди ближе к рычагу, резервуару или терминалу.');}
  updateGrab(s,input);tickAI(s);tickBullets(s);
  for(const o of currentRoom(s).objects)if(o.kind==='crate'&&s.grab?.id!==o.id){
    if(hyp(o.x-s.x,o.y-s.y)<31){const nx=o.x+(o.x-s.x)*.05;if(!blocked(s,nx,o.y))o.x=clamp(nx,64,704);}
    if(o.y<362&&!blocked(s,o.x,o.y+20))o.y=Math.min(362,o.y+120*H);
  }
  for(const o of currentRoom(s).objects)if(o.kind==='lamp'){
    if(o.broken){o.fallV=(o.fallV||0)+230*H;const probe={x:o.x,y:o.y,r:7};moveNode(s,probe,0,o.fallV*H);if(probe.y<=o.y+.01)o.fallV=0;o.x=probe.x;o.y=probe.y;}
    else if(s.dash>0&&s.nodes.some(n=>hyp(n.x-o.x,n.y-o.y)<n.r+14))breakLamp(s,o);
  }
  for(let i=s.particles.length-1;i>=0;i--){const p=s.particles[i];p.life-=H;p.x+=p.vx*H;p.y+=p.vy*H;p.vy+=80*H;if(p.life<=0)s.particles.splice(i,1);}
  if(s.status==='playing'&&s.y>192&&s.y<288){if(s.x>WIDTH-23)changeRoom(s,1);else if(s.x<23)changeRoom(s,-1);}
}
export function step(s,dt,input={}){
  if(s.status!=='playing'||!finite(dt,0,60))return s;
  s.accumulator+=Math.min(dt,.16);let count=0;
  while(s.accumulator>=H&&count++<10&&s.status==='playing'){tick(s,input);s.accumulator-=H;input={...input,interact:false,burst:false};}
  return s;
}
export function serialize(s){return{version:VERSION,room:s.room,x:s.x,y:s.y,mass:s.mass,time:s.time,kills:s.kills,status:s.status,
  visited:[...s.visited],rooms:s.rooms.map(r=>({gateOpen:r.gateOpen,enemies:r.enemies.map(e=>({id:e.id,x:e.x,y:e.y,dead:e.dead,eaten:e.eaten})),objects:r.objects.map(o=>({id:o.id,x:o.x,y:o.y,bank:o.bank||0,broken:o.broken===true}))}))};}
export function restore(raw){
  if(!raw||![1,VERSION].includes(raw.version)||!Number.isInteger(raw.room)||raw.room<0||raw.room>=ROOMS.length||!finite(raw.mass,1,100)||!finite(raw.x,10,758)||!finite(raw.y,20,410)||!finite(raw.time,0,864000)||!Array.isArray(raw.rooms)||raw.rooms.length!==6||!['playing','won'].includes(raw.status))return null;
  const s=createRun();s.room=raw.room;s.mass=raw.mass;s.x=raw.x;s.y=raw.y;s.time=raw.time;s.kills=finite(raw.kills,0,100)?Math.floor(raw.kills):0;s.status=raw.status;
  s.visited=Array.isArray(raw.visited)?[...new Set(raw.visited.filter(n=>Number.isInteger(n)&&n>=0&&n<6))]:[s.room];
  for(let i=0;i<6;i++){
    const rr=raw.rooms[i];if(!rr||typeof rr.gateOpen!=='boolean'||!Array.isArray(rr.enemies)||!Array.isArray(rr.objects))return null;
    const r=s.rooms[i];if(rr.enemies.length!==r.enemies.length||rr.objects.length!==(raw.version===1?ROOMS[i].legacyObjects:r.objects.length))return null;r.gateOpen=rr.gateOpen;
    for(const e of r.enemies){const v=rr.enemies.find(v=>v?.id===e.id);if(!v||!finite(v.x,24,744)||!finite(v.y,24,390)||typeof v.dead!=='boolean'||typeof v.eaten!=='boolean'||(v.eaten&&!v.dead))return null;Object.assign(e,{x:v.x,y:v.y,dead:v.dead,eaten:v.eaten});}
    for(const o of r.objects){if(raw.version===1&&o.kind==='lamp')continue;const v=rr.objects.find(v=>v?.id===o.id);if(!v||!finite(v.x,24,744)||!finite(v.y,24,390)||!finite(v.bank,0,1000)||(o.kind==='lamp'&&typeof v.broken!=='boolean'))return null;Object.assign(o,{x:v.x,y:v.y,bank:v.bank,broken:v.broken===true});}
  }
  if(blocked(s,s.x,s.y)){s.x=ROOMS[s.room].spawn[0];s.y=240;}
  s.nodes=[];s.limbs=[];resize(s);updateAnchors(s,0,0,blocked,H);s.invulnerable=1;notice(s,'Связь с образцом восстановлена.');return s;
}
export function objective(s){
  if(s.status==='won')return 'Побег завершён';
  const r=ROOMS[s.room],dynamic=currentRoom(s);
  if(r.gate&&!dynamic.gateOpen)return r.gate.kind==='heavy'?'Большая форма → рывок в перегородку':r.gate.kind==='terminal'?'Отключи блокировку терминалом':'Потяни рычаг блокировки';
  if(r.vent&&formFor(s.mass)>0)return 'Оставь массу в резервуаре → узкий канал';
  return s.room===2&&formFor(s.mass)<2?'Поглощай персонал и наращивай массу':'Найди выход справа →';
}
