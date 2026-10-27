// Shared deterministic castle geometry. One metre is 32 world units.
// Presentation reads this module; it never changes the simulation.
import {waveAt} from './progression.mjs';
export const CASTLE=Object.freeze({halfWidth:720,segmentLength:1600,carpetHalfWidth:240,
  bossY:-2000,hallHalfWidth:720,hallHalfHeight:650,gateY:-1280,triggerRadius:510});
const TAU=Math.PI*2;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const createCastle=()=>({phase:'exploring',targetX:0,targetY:CASTLE.bossY});
export const castleGuidance=state=>state.map==='castle'&&state.level>=45&&!state.arena
  ? {x:0,y:CASTLE.bossY}:null;
export function updateCastleGoal(state){
  if(state.map!=='castle')return;
  state.castle.phase=state.arena?'arena':state.level>=45?'guidance':'exploring';
}

// These are foot anchors and collision radii, not sprite bounding boxes.
// Repeating bays end before the separate final hall.
export function castleProps(minY,maxY){
  const props=[];
  const add=(kind,x,y,radius)=>{if(y>=minY-140&&y<=maxY+140)props.push({kind,x,y,radius});};
  const first=Math.max(-4,Math.floor((minY-160)/320)),last=Math.min(first+48,Math.ceil((maxY+160)/320));
  const decor=['piano','flowerbed','bookshelf','flowerbed','bookshelf'];
  for(let i=first;i<=last;i++){
    const y=i*320;
    if(y<CASTLE.gateY+80)continue;
    for(const side of [-1,1]){
      add('column',side*674,y,27);
      const kind=decor[((i+(side===1?2:0))%5+5)%5];
      add(kind,side*622,y+155,kind==='piano'?56:kind==='bookshelf'?47:51);
      add('candelabra',side*566,y+34,20);
    }
  }
  for(const side of [-1,1])for(const offset of [-480,-160,160,480]){
    add('column',side*672,CASTLE.bossY+offset,27);
    add('candelabra',side*573,CASTLE.bossY+offset+45,20);
  }
  return props;
}
export function castleColliders(minY,maxY){
  return castleProps(minY,maxY).map((p,i)=>({...p,id:-(i+1),kind:'castle-prop',hp:1}));
}
export function constrainCastleEntity(entity,state,body=20){
  if(state.map!=='castle')return;
  const inHall=Boolean(state.arena),halfWidth=inHall?CASTLE.hallHalfWidth:CASTLE.halfWidth;
  entity.x=clamp(entity.x,-halfWidth+body,halfWidth-body);
  if(inHall)entity.y=clamp(entity.y,CASTLE.bossY-CASTLE.hallHalfHeight+body,CASTLE.bossY+CASTLE.hallHalfHeight-body);
  else entity.y=Math.max(entity.y,(state.level>=45?CASTLE.bossY-CASTLE.hallHalfHeight:CASTLE.gateY)+body);
  for(const p of castleProps(entity.y-100,entity.y+100)){
    const dx=entity.x-p.x,dy=entity.y-p.y,d=Math.hypot(dx,dy),radius=body+p.radius;
    if(d<radius){const nx=d?dx/d:(entity.x>0?-1:1),ny=d?dy/d:0;entity.x=p.x+nx*radius;entity.y=p.y+ny*radius;}
  }
  entity.x=clamp(entity.x,-halfWidth+body,halfWidth-body);
}
export function validateCastle(value,state){
  if(state.map!=='castle')return value===null;
  if(!value||typeof value!=='object'||Array.isArray(value)||value.targetX!==0||value.targetY!==CASTLE.bossY)return false;
  const phase=state.arena?'arena':state.level>=45?'guidance':'exploring';
  return value.phase===phase&&state.level<=45;
}
export function castleCreatureStats(kind,wave){
  if(wave.kind==='harvest')return {hp:12,radius:10,speed:40,damage:3};
  if(wave.kind==='opening')return {hp:18,radius:10,speed:47,damage:7};
  const s=wave.stage;
  if(kind==='palace-guard')return {hp:wave.kind==='opening'?24:88+s*25,radius:16,speed:39+s*2,damage:13};
  if(kind==='wax-servant')return {hp:wave.kind==='opening'?18:52+s*15,radius:13,speed:32+s,damage:10};
  return {hp:wave.kind==='opening'?16:35+s*12,radius:11,speed:65+s*2,damage:7};
}
export function updateCastleEnemy(state,e,dt,{hurt,effect,limits}){
  if(!['palace-guard','wax-servant','paper-moth'].includes(e.kind))return false;
  e.hitFlash=Math.max(0,e.hitFlash-dt);e.slowTime=Math.max(0,e.slowTime-dt);
  // Opening (24HP after map scaling) and harvest (12HP) survivors remain
  // harmless melee creatures when the next pressure wave starts. Otherwise
  // an entire surviving harvest would turn into casters on the same tick.
  const active=waveAt(state.time).kind==='pressure'&&e.maxHp>30;
  if(!active)e.actionTimer=0;
  const previous=e.actionTimer||0;
  e.actionTimer=Math.max(0,previous-dt);e.fireTimer=Math.max(0,e.fireTimer-dt);
  const dx=state.player.x-e.x,dy=state.player.y-e.y,distance=Math.hypot(dx,dy)||1;
  if(previous>0){
    if(e.actionTimer>0)return true;
    if(e.kind==='palace-guard'){
      const along=dx*Math.cos(e.phase)+dy*Math.sin(e.phase),across=Math.abs(dx*Math.sin(e.phase)-dy*Math.cos(e.phase));
      effect(state,'arc',e.x,e.y,28,.25);
      Object.assign(state.effects.at(-1),{toX:e.x+Math.cos(e.phase)*130,toY:e.y+Math.sin(e.phase)*130});
      if(along>=0&&along<=130&&across<28+state.player.radius)hurt(state,18,.3);
    }else{
      const wax=e.kind==='wax-servant',count=wax?1:3;
      for(let n=0;n<count&&state.projectiles.length<limits.projectiles;n++){
        const angle=e.phase+(n-(count-1)/2)*.23;
        state.projectiles.push({id:state.nextId++,x:e.x+Math.cos(angle)*(wax?72:15),y:e.y+Math.sin(angle)*(wax?72:15),
          vx:Math.cos(angle)*(wax?0:145),vy:Math.sin(angle)*(wax?0:145),radius:wax?24:6,damage:wax?12:9,
          life:wax?3.8:4,hostile:true,weapon:'hostile',pierce:0,hits:[],returning:false});
      }
    }
    e.fireTimer=e.kind==='palace-guard'?2.5:3.4;
    return true;
  }
  if(active&&e.fireTimer<=0&&distance<(e.kind==='palace-guard'?135:350)){
    e.phase=(Math.atan2(dy,dx)+TAU)%TAU;e.actionTimer=e.kind==='wax-servant'?.8:.65;
    if(e.kind==='palace-guard'){
      effect(state,'charge',e.x,e.y,28,e.actionTimer);
      Object.assign(state.effects.at(-1),{toX:e.x+Math.cos(e.phase)*130,toY:e.y+Math.sin(e.phase)*130});
    }else effect(state,'warning',e.x+Math.cos(e.phase)*(e.kind==='wax-servant'?72:0),
      e.y+Math.sin(e.phase)*(e.kind==='wax-servant'?72:0),e.kind==='wax-servant'?30:45,e.actionTimer);
    return true;
  }
  const spacing=e.kind==='paper-moth'?(distance<155?-.5:distance<270?.15:1):distance<65?0:1;
  const sway=e.kind==='paper-moth'?Math.sin(state.time*2.6+e.id)*.6:0;
  const amount=e.speed*dt*(e.slowTime>0?.58:1)*spacing;
  e.x+=(dx-dy*sway)/distance*amount;e.y+=(dy+dx*sway)/distance*amount;
  return true;
}
