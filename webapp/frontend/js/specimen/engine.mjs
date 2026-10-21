import {TILE,COLS,ROWS,WIDTH,HEIGHT,ROOMS,FORMS,formFor,freshRoom,LEGACY_LAYOUT} from './world.mjs';
import {updateAnchors,constrainAnchors,validateAnchors,supportTraction} from './locomotion.mjs';
import {throwCargo,tickCargo} from './cargo.mjs';
export {ROOMS,FORMS,formFor};
export const VERSION=3, LIMITS=Object.freeze({nodes:16,limbs:10,bullets:40,particles:90,decals:36});
const H=1/60,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),hyp=Math.hypot;
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
export function currentRoom(s){return s.rooms[s.room];}
export function notice(s,message){s.message=message;s.messageTime=4;s.event++;}
function makeNode(x,y,r,parent){return{x,y,px:x,py:y,r,parent};}
function resize(s){
  const f=FORMS[formFor(s.mass)],nodes=s.nodes,initial=nodes.length===0;
  if(nodes.length>f.nodes)nodes.length=f.nodes;
  while(nodes.length<f.nodes){const i=nodes.length;if(i===0){nodes.push(makeNode(s.x,s.y,f.r*1.12,0));collide(s,nodes[0]);continue;}const parent=i<4?Math.max(0,i-1):i-3,p=nodes[parent],r=initial?f.r*(.8+(i%3)*.1):2.5;
    const n=makeNode(p.x,p.y,r,parent);moveNode(s,n,-(p.r+r)*.78,(i%2?1:-1)*(p.r+r)*.38);n.px=n.x;n.py=n.y;nodes.push(n);}
  // Shape transition is transient: mass, form thresholds and v1/v2 saves stay unchanged.
  if(initial){solveBody(s);for(const n of nodes){n.px=n.x;n.py=n.y;}s.x=nodes[0].x;s.y=nodes[0].y;s.moveSpeed=f.speed;s.bodyAngle=0;}
  if(s.limbs)updateAnchors(s,0,0,blocked,0);
}
export function createRun(){
  const s={version:VERSION,room:0,rooms:ROOMS.map(freshRoom),nodes:[],limbs:[],x:ROOMS[0].spawn[0],y:ROOMS[0].spawn[1],mass:32,time:0,ticks:0,accumulator:0,
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
  const room=ROOMS[s.room];if(room.cells[Math.floor(y/TILE)*COLS+Math.floor(x/TILE)])return true;
  const inside=b=>b&&x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h;
  return !!((!currentRoom(s).gateOpen&&inside(room.gate))||(formFor(s.mass)>0&&inside(room.vent)));
}
export function lineClear(s,x,y,tx,ty){const d=hyp(tx-x,ty-y),steps=Math.ceil(d/5);for(let i=1;i<=steps;i++)if(blocked(s,x+(tx-x)*i/steps,y+(ty-y)*i/steps))return false;return true;}
function collide(s,n){
  const room=ROOMS[s.room],minX=clamp(Math.floor((n.x-n.r)/TILE),0,COLS-1),maxX=clamp(Math.floor((n.x+n.r)/TILE),0,COLS-1),minY=clamp(Math.floor((n.y-n.r)/TILE),0,ROWS-1),maxY=clamp(Math.floor((n.y+n.r)/TILE),0,ROWS-1);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(room.cells[y*COLS+x])rectPush(n,{x:x*TILE,y:y*TILE,w:TILE,h:TILE});
  if(room.gate&&!currentRoom(s).gateOpen)rectPush(n,room.gate);
  if(room.vent&&formFor(s.mass)>0)rectPush(n,room.vent);
  n.x=clamp(n.x,n.r,WIDTH-n.r);n.y=clamp(n.y,n.r,HEIGHT-n.r);
}
function moveNode(s,n,dx,dy){const count=Math.max(1,Math.ceil(hyp(dx,dy)/5));for(let i=0;i<count;i++){n.x+=dx/count;collide(s,n);n.y+=dy/count;collide(s,n);}}
function limitVelocity(n,max){const vx=n.x-n.px,vy=n.y-n.py,d=hyp(vx,vy);if(d>max){n.px=n.x-vx/d*max;n.py=n.y-vy/d*max;}}
function solveBody(s){
  // Local length / compression / bend bounds retain the existing branched body.
  function separate(n,p,min,max,weight,stiffness=1){
    let dx=n.x-p.x,dy=n.y-p.y,d=hyp(dx,dy);if(d>=min&&d<=max)return;
    if(d<.0001){dx=-1;dy=n.parent%2?.5:-.5;d=hyp(dx,dy);}
    const correction=clamp((d<min?d-min:d-max)*stiffness,-2.5,2.5)/d;
    moveNode(s,n,-dx*correction*(1-weight),-dy*correction*(1-weight));
    if(weight)moveNode(s,p,dx*correction*weight,dy*correction*weight);
  }
  for(let pass=0;pass<7;pass++){
    for(let i=1;i<s.nodes.length;i++){
      const n=s.nodes[i],p=s.nodes[n.parent],sum=n.r+p.r;
      separate(n,p,sum*.65,sum*.87,n.parent? .12:0);
      if(n.parent){const g=s.nodes[p.parent];separate(n,g,(n.r+p.r*2+g.r)*.34,Infinity,p.parent?.1:0,.35);}
    }
    if(pass%2===0)for(let i=1;i<s.nodes.length;i++)for(let j=0;j<i;j++){
      const n=s.nodes[i],p=s.nodes[j];if(n.parent===j)continue;
      separate(n,p,(n.r+p.r)*.58,Infinity,j?.5:0,.55);
    }
  }
  // The final operation on every node is collision projection, never an unchecked constraint.
  for(const n of s.nodes)collide(s,n);
}
function easeShape(s){
  const f=FORMS[formFor(s.mass)];s.moveSpeed+=clamp(f.speed-s.moveSpeed,-60*H,60*H);
  for(let i=0;i<s.nodes.length;i++){
    const n=s.nodes[i],target=f.r*(i===0?1.12:.8+(i%3)*.1),before=n.r;
    n.r+=clamp(target-n.r,-6*H,6*H);
    const x=n.x,y=n.y;collide(s,n);
    // Radius projection must not inject a launch velocity into the next fixed step.
    n.px+=n.x-x;n.py+=n.y-y;
    if(n.r>before&&blocked(s,n.x,n.y)){n.r=before;collide(s,n);}
  }
}
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
  if(obj.kind==='nest'){obj.lit=true;s.nestTouch=obj.id;notice(s,'Живое ядро приняло образец. Побег сохранён.');s.checkpointEvent++;}
}
export function interaction(s){
  const candidates=currentRoom(s).objects.filter(o=>['lever','terminal','tank','feed','nest'].includes(o.kind)).map(o=>({o,d:hyp(o.x-s.x,o.y-s.y)})).filter(v=>v.d<78&&lineClear(s,s.x,s.y,v.o.x,v.o.y));
  candidates.sort((a,b)=>a.d-b.d);const o=candidates[0]?.o;if(!o)return null;
  return {id:o.id,label:o.kind==='tank'?(s.mass>36?'Оставить массу':o.bank?'Вернуть массу':'Резервуар пуст'):o.kind==='feed'?'Восстановить массу':o.kind==='nest'?'Слиться с ядром':'Снять блокировку',object:o};
}
function candidate(s){
  const room=currentRoom(s),reach=FORMS[formFor(s.mass)].reach,all=[...room.enemies.filter(e=>!e.eaten).map(e=>({...e,type:'enemy'})),...room.objects.filter(o=>['crate','lever','terminal','lamp'].includes(o.kind)&&!o.broken&&!(o.regrab>0)).map(o=>({...o,type:'object'}))];
  let best=null,score=Infinity;
  for(const o of all){const dx=o.x-s.x,dy=o.y-s.y,d=hyp(dx,dy),dot=d?(dx*s.aimX+dy*s.aimY)/d:1;if(d>reach||dot<.66||!lineClear(s,s.x,s.y,o.x,o.y))continue;
    const value=d*(1.6-dot)+(o.type==='enemy'?-24:o.kind==='crate'?-10:20);if(value<score){score=value;best={id:o.id,type:o.type};}}
  return best;
}
export function targetFor(s){return candidate(s);}
function updateGrab(s,input){
  if(!input.grabbing){if(s.grab){const o=currentRoom(s).objects.find(o=>o.id===s.grab.id);if(o?.kind==='crate'&&s.grabTime>.07)throwCargo(s,o);s.grab=null;s.grabTime=0;}return;}
  if(!s.grab){s.grab=candidate(s);s.grabTime=0;}
  if(!s.grab)return;
  const room=currentRoom(s),o=(s.grab.type==='enemy'?room.enemies:room.objects).find(v=>v.id===s.grab.id);
  if(!o||o.eaten||hyp(o.x-s.x,o.y-s.y)>FORMS[formFor(s.mass)].reach+35||!lineClear(s,s.x,s.y,o.x,o.y)){s.grab=null;return;}
  s.grabTime+=H;
  if(o.kind==='lever'||o.kind==='terminal'){if(s.grabTime>.18){activate(s,o);s.grab=null;s.grabTime=0;}return;}
  if(o.kind==='lamp'){if(s.grabTime>.24){breakLamp(s,o);s.grab=null;s.grabTime=0;}return;}
  const distance=s.grab.type==='enemy'?18:52,tx=s.x+s.aimX*distance,ty=s.y+s.aimY*distance;
  const dx=(tx-o.x)*.1,dy=(ty-o.y)*.1;
  if(o.kind==='crate'){const body={x:o.x,y:o.y,r:18};moveNode(s,body,dx,dy);o.vx=(body.x-o.x)/H;o.vy=(body.y-o.y)/H;o.x=body.x;o.y=body.y;o.thrown=false;}
  else{const body={x:o.x,y:o.y+12,r:14};moveNode(s,body,dx,dy);o.x=body.x;o.y=body.y-12;}
  if(s.grab.type==='enemy'){
    o.hurt=.15;o.alert=3;
    if(s.grabTime>.55&&hyp(o.x-s.x,o.y-s.y)<34){o.dead=true;o.eaten=true;s.mass=Math.min(100,s.mass+(o.kind==='guard'?28:22));s.kills++;resize(s);particles(s,o.x,o.y,'#ed7860',14);decal(s,o.x,o.y);s.grab=null;s.grabTime=0;notice(s,'Поглощение · масса растёт.');}
  }
}
function hurt(s,amount){if(s.invulnerable>0)return;s.mass=Math.max(0,s.mass-amount);s.invulnerable=.22;resize(s);particles(s,s.x,s.y,'#ffb286',6);s.event++;if(s.mass<=0){s.status='dead';notice(s,'Связь с образцом потеряна.');}}
function hitEnemy(s,e,damage,vx,vy){
  e.hp=Math.max(0,e.hp-damage);e.hurt=.3;e.knock=.85;e.vx=clamp(vx*.45,-190,190);e.vy=Math.min(-65,vy*.35-55);e.windup=0;e.fireTime=0;e.alert=3;
  if(e.hp===0){e.dead=true;decal(s,e.x,e.y);}particles(s,e.x,e.y,'#bd6555',5);
}
export function flameClear(s,x,y,tx,ty){
  if(!lineClear(s,x,y,tx,ty))return false;
  const d=hyp(tx-x,ty-y)||1;
  for(let t=4;t<d;t+=4)if(currentRoom(s).objects.some(o=>o.kind==='crate'&&hyp(x+(tx-x)*t/d-o.x,y+(ty-y)*t/d-o.y)<20))return false;
  return true;
}
function tickAI(s){
  const room=currentRoom(s);
  for(const e of room.enemies){
    e.hurt=Math.max(0,e.hurt-H);e.knock=Math.max(0,e.knock-H);if(e.eaten||s.grab?.id===e.id)continue;
    e.vy=Math.min(360,e.vy+420*H);const body={x:e.x,y:e.y+12,r:14},before=body.y;
    moveNode(s,body,e.vx*H,e.vy*H);if(body.y-before<e.vy*H-.01)e.vy=0;e.x=body.x;e.y=body.y-12;e.vx*=.88;
    if(e.dead||e.knock>0)continue;
    const d=hyp(e.x-s.x,e.y-s.y),sees=d<320&&lineClear(s,e.x,e.y-6,s.x,s.y);
    e.alert=Math.max(0,e.alert-H);e.cooldown=Math.max(0,e.cooldown-H);
    if(sees)e.alert=3;
    if(e.kind==='tech'){
      if(e.alert>0){e.dir=Math.sign(e.x-s.x)||1;const nx=clamp(e.x+e.dir*58*H,66,702);if(!blocked(s,nx+e.dir*14,e.y)&&blocked(s,nx+e.dir*14,e.y+28))e.x=nx;}
    }else if(e.kind==='flamer'){
      e.fireTime=Math.max(0,e.fireTime-H);
      if(e.fireTime>0){
        const ox=e.x+e.dir*18,oy=e.y-6;
        if(s.nodes.some(n=>{const dx=n.x-ox,dy=n.y-oy,dist=hyp(dx,dy);return dist<160+n.r&&dist>0&&(dx*e.fireX+dy*e.fireY)/dist>.88&&flameClear(s,ox,oy,n.x,n.y);}))hurt(s,3);
        if(s.ticks%3===0)particles(s,ox+e.fireX*28,oy+e.fireY*28,'#f9a64c',2);
      }else if(sees&&d<240&&e.cooldown<=0){
        e.dir=Math.sign(s.x-e.x)||1;e.windup+=H;
        if(e.windup>=.65){const dx=s.x-e.x,dy=s.y-(e.y-6),dist=hyp(dx,dy)||1;e.fireX=dx/dist;e.fireY=dy/dist;e.fireTime=.8;e.cooldown=2.1;e.windup=0;}
      }else e.windup=Math.max(0,e.windup-H*2);
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
  s.room=next;s.x=delta>0?82:686;s.y=(delta>0?ROOMS[next].portals.entry:ROOMS[next].portals.exit).floor-40;s.grab=null;s.nestTouch=null;s.bullets.length=0;s.particles.length=0;s.dash=0;s.invulnerable=1;
  s.nodes=[];s.limbs=[];resize(s);updateAnchors(s,0,0,blocked,H);if(!s.visited.includes(next))s.visited.push(next);notice(s,ROOMS[next].subtitle);s.checkpointEvent++;
}
function tick(s,input){
  s.time+=H;s.ticks++;s.messageTime=Math.max(0,s.messageTime-H);s.invulnerable=Math.max(0,s.invulnerable-H);s.dashCooldown=Math.max(0,s.dashCooldown-H);s.dash=Math.max(0,s.dash-H);
  let ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,len=hyp(ix,iy);if(len>1){ix/=len;iy/=len;len=1;}
  if(finite(input.aimX,-1,1)&&finite(input.aimY,-1,1)&&hyp(input.aimX,input.aimY)>.1){const a=hyp(input.aimX,input.aimY);s.aimX=input.aimX/a;s.aimY=input.aimY/a;}
  else if(len>.1&&!input.grabbing){s.aimX=ix/(len||1);s.aimY=iy/(len||1);}
  if(input.burst&&s.dashCooldown<=0){s.dash=.22;s.dashCooldown=1.3;s.dashX=len>.1?ix:s.aimX;s.dashY=len>.1?iy:s.aimY;particles(s,s.x,s.y,'#f39870',9);}
  const head=s.nodes[0];
  const room=ROOMS[s.room],gate=room.gate;
  if(s.dash>0&&gate?.kind==='heavy'&&!currentRoom(s).gateOpen&&Math.abs(head.x-gate.x)<70&&head.y>gate.y-20&&head.y<gate.y+gate.h+20){
    if(formFor(s.mass)===2){currentRoom(s).gateOpen=true;particles(s,gate.x,head.y,'#a1b0a6',24);notice(s,'Грузовая перегородка разрушена.');s.checkpointEvent++;}
    else notice(s,'Для этой перегородки нужна большая форма.');
  }
  easeShape(s);
  const oldX=head.x,oldY=head.y;
  if(len>.1){const angle=Math.atan2(iy,ix),turn=Math.atan2(Math.sin(angle-s.bodyAngle),Math.cos(angle-s.bodyAngle));s.bodyAngle+=clamp(turn,-5*H,5*H);}
  const supports=updateAnchors(s,ix,iy,blocked,H),traction=supportTraction(s,ix,iy),speed=s.moveSpeed*(s.dash>0?3.2:.3+.7*traction);
  let vx=(head.x-head.px)/H,vy=(head.y-head.py)/H;
  if(s.dash>0){vx=s.dashX*speed;vy=s.dashY*speed;}
  else{
    const drag=supports?(len>.05?.985:.82):.975;vx*=drag;vy*=drag;
    const response=supports?14:1.2,ax=(ix*speed-vx)*response,ay=(iy*speed-vy)*response;
    const acceleration=900*(.8+.2*FORMS[0].speed/s.moveSpeed),amount=Math.min(1,acceleration/(hyp(ax,ay)||1));
    // In free flight only intent adds force; releasing input leaves exponential air drag.
    vx+=(supports?ax:ix*90)*amount*H;vy+=(supports?ay:iy*90)*amount*H;
    if(!supports)vy+=170*H;
    const velocity=hyp(vx,vy),max=s.moveSpeed*1.15;if(velocity>max){vx*=max/velocity;vy*=max/velocity;}
  }
  moveNode(s,head,vx*H,vy*H);
  head.px=oldX;head.py=oldY;
  for(let i=1;i<s.nodes.length;i++){
    const n=s.nodes[i],p=s.nodes[n.parent],rest=(n.r+p.r)*.8,angle=s.bodyAngle+(i<4?0:(i%2?.55:-.55));
    limitVelocity(n,s.moveSpeed*3.2*H);
    // A bounded elastic bias turns the rear around the front instead of pushing a rigid pile.
    const ax=clamp((p.x-Math.cos(angle)*rest-n.x)*40*H*H,-.3,.3),ay=clamp((p.y-Math.sin(angle)*rest-n.y)*40*H*H,-.3,.3);
    const vx=(n.x-n.px)*.8+ax,vy=(n.y-n.py)*.8+ay;n.px=n.x;n.py=n.y;moveNode(s,n,vx,vy);
  }
  constrainAnchors(s,moveNode);solveBody(s);
  for(const n of s.nodes)limitVelocity(n,s.moveSpeed*(s.dash>0?3.2:1.4)*H);
  validateAnchors(s,blocked);
  s.x=head.x;s.y=head.y;
  if(input.interact){const item=interaction(s);if(item)activate(s,item.object);else notice(s,'Подойди ближе к рычагу, резервуару или терминалу.');}
  updateGrab(s,input);tickAI(s);tickBullets(s);
  validateAnchors(s,blocked);
  tickCargo(s,H,moveNode,hitEnemy);
  const nest=currentRoom(s).objects.find(o=>o.kind==='nest'&&hyp(o.x-s.x,o.y-s.y)<64&&lineClear(s,s.x,s.y,o.x,o.y));
  if(nest&&s.nestTouch!==nest.id)activate(s,nest);else if(!nest)s.nestTouch=null;
  for(const o of currentRoom(s).objects)if(o.kind==='lamp'){
    if(o.broken){o.fallV=(o.fallV||0)+230*H;const probe={x:o.x,y:o.y,r:7};moveNode(s,probe,0,o.fallV*H);if(probe.y<=o.y+.01)o.fallV=0;o.x=probe.x;o.y=probe.y;}
    else if(s.dash>0&&s.nodes.some(n=>hyp(n.x-o.x,n.y-o.y)<n.r+14))breakLamp(s,o);
  }
  for(let i=s.particles.length-1;i>=0;i--){const p=s.particles[i];p.life-=H;p.x+=p.vx*H;p.y+=p.vy*H;p.vy+=80*H;if(p.life<=0)s.particles.splice(i,1);}
  if(s.status==='playing'){
    const inside=p=>p&&s.y>p.y+8&&s.y<p.floor-8;
    if(s.x>WIDTH-23&&inside(room.portals.exit))changeRoom(s,1);else if(s.x<23&&inside(room.portals.entry))changeRoom(s,-1);
  }
}
export function step(s,dt,input={}){
  if(s.status!=='playing'||!finite(dt,0,60))return s;
  s.accumulator+=Math.min(dt,.16);let count=0;
  while(s.accumulator>=H&&count++<10&&s.status==='playing'){tick(s,input);s.accumulator-=H;input={...input,interact:false,burst:false};}
  return s;
}
export function serialize(s){return{version:VERSION,room:s.room,x:s.x,y:s.y,mass:s.mass,time:s.time,kills:s.kills,status:s.status,
  visited:[...s.visited],rooms:s.rooms.map(r=>({gateOpen:r.gateOpen,enemies:r.enemies.map(e=>({id:e.id,x:e.x,y:e.y,dead:e.dead,eaten:e.eaten,hp:e.hp,knock:e.knock,vx:e.vx,vy:e.vy})),objects:r.objects.map(o=>({id:o.id,x:o.x,y:o.y,bank:o.bank||0,broken:o.broken===true,lit:o.lit===true,vx:o.vx||0,vy:o.vy||0,angle:o.angle||0,spin:o.spin||0,thrown:o.thrown===true,hitIds:o.hitIds||[]}))}))};}
export function restore(raw){
  if(!raw||![1,2,VERSION].includes(raw.version)||!Number.isInteger(raw.room)||raw.room<0||raw.room>=ROOMS.length||!finite(raw.mass,1,100)||!finite(raw.x,10,758)||!finite(raw.y,20,HEIGHT-10)||!finite(raw.time,0,864000)||!Array.isArray(raw.rooms)||raw.rooms.length!==6||!['playing','won'].includes(raw.status))return null;
  const legacy=raw.version<3;
  const s=createRun();s.room=raw.room;s.mass=raw.mass;s.x=raw.x;s.y=raw.y;s.time=raw.time;s.kills=finite(raw.kills,0,100)?Math.floor(raw.kills):0;s.status=raw.status;
  s.visited=Array.isArray(raw.visited)?[...new Set(raw.visited.filter(n=>Number.isInteger(n)&&n>=0&&n<6))]:[s.room];
  for(let i=0;i<6;i++){
    const rr=raw.rooms[i];if(!rr||typeof rr.gateOpen!=='boolean'||!Array.isArray(rr.enemies)||!Array.isArray(rr.objects))return null;
    const r=s.rooms[i],enemyCount=legacy?LEGACY_LAYOUT.enemies[i]:r.enemies.length,objectCount=legacy?LEGACY_LAYOUT.objects[i]+(raw.version===2?LEGACY_LAYOUT.lamps[i]:0):r.objects.length;
    if(rr.enemies.length!==enemyCount||rr.objects.length!==objectCount||new Set(rr.enemies.map(v=>v?.id)).size!==enemyCount||new Set(rr.objects.map(v=>v?.id)).size!==objectCount)return null;r.gateOpen=rr.gateOpen;
    for(const e of r.enemies){
      const v=rr.enemies.find(v=>v?.id===e.id);if(legacy&&Number(e.id.split('e')[1])>=enemyCount)continue;
      if(!v||!finite(v.x,legacy?24:10,legacy?744:WIDTH-10)||!finite(v.y,24,legacy?390:HEIGHT-24)||typeof v.dead!=='boolean'||typeof v.eaten!=='boolean'||(v.eaten&&!v.dead))return null;
      if(!legacy&&(!finite(v.hp,0,6)||(v.hp===0&&!v.dead)||!finite(v.knock,0,2)||!finite(v.vx,-600,600)||!finite(v.vy,-600,600)))return null;
      Object.assign(e,{dead:v.dead,eaten:v.eaten,...(!legacy?{x:v.x,y:v.y,hp:v.hp,knock:v.knock,vx:v.vx,vy:v.vy}:{})});
    }
    for(const o of r.objects){
      const oldIndex=Number(o.id.split(':o')[1]);if(legacy&&((o.kind==='lamp'&&raw.version===1)||(Number.isInteger(oldIndex)&&oldIndex>=LEGACY_LAYOUT.objects[i])))continue;
      const v=rr.objects.find(v=>v?.id===o.id);
      if(!v||!finite(v.x,legacy?24:10,legacy?744:WIDTH-10)||!finite(v.y,24,legacy?390:HEIGHT-24)||!finite(v.bank,0,1000)||(o.kind==='lamp'&&typeof v.broken!=='boolean'))return null;
      if(!legacy&&(!finite(v.vx,-600,600)||!finite(v.vy,-600,600)||!finite(v.angle,-1e6,1e6)||!finite(v.spin,-40,40)||typeof v.lit!=='boolean'||typeof v.thrown!=='boolean'||!Array.isArray(v.hitIds)||v.hitIds.length>r.enemies.length||v.hitIds.some(id=>!r.enemies.some(e=>e.id===id))))return null;
      Object.assign(o,{bank:v.bank,broken:v.broken===true,...(!legacy?{x:v.x,y:v.y,vx:v.vx,vy:v.vy,angle:v.angle,spin:v.spin,lit:v.lit,thrown:v.thrown,hitIds:[...v.hitIds]}:{})});
    }
  }
  if(legacy||blocked(s,s.x,s.y)){[s.x,s.y]=ROOMS[s.room].spawn;}
  s.nodes=[];s.limbs=[];resize(s);updateAnchors(s,0,0,blocked,H);s.invulnerable=1;notice(s,'Связь с образцом восстановлена.');return s;
}
export function objective(s){
  if(s.status==='won')return 'Побег завершён';
  const r=ROOMS[s.room],dynamic=currentRoom(s);
  if(r.vent&&!dynamic.gateOpen)return formFor(s.mass)>0?'Резервуар → малая форма → вентиляция':'Вентиляция над площадкой → обход двери';
  if(r.gate&&!dynamic.gateOpen)return r.gate.kind==='heavy'?'Большая форма → грузовая дверь на среднем этаже':r.gate.kind==='terminal'?'Поднимись к терминалу шлюза':'Поднимись к рычагу блокировки';
  return s.room===2&&formFor(s.mass)<2?'Поглощай персонал и наращивай массу':`Выход справа · ${r.portals.exit.floor===240?'верхний':r.portals.exit.floor===456?'средний':'нижний'} этаж →`;
}
