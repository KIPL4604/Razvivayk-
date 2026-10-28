// Shared deterministic castle geometry. One metre is 32 world units.
// Presentation reads this module; it never changes the simulation.
import {waveAt} from './progression.mjs';
export const CASTLE=Object.freeze({halfWidth:360,segmentLength:1600,carpetHalfWidth:120,
  bossY:-2000,hallHalfWidth:720,hallHalfHeight:650,gateY:-1280,triggerRadius:510});
export const CASTLE_DOOR_HP=6000;
const TAU=Math.PI*2;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const createCastle=()=>({phase:'exploring',targetX:0,targetY:null,doorY:null,hallY:null,
  doorId:0,doorBroken:false,doorTime:0});
export function castleLayout(state){
  const c=state?.map==='castle'?state.castle:null,doorY=c?.doorY??null,hallY=c?.hallY??null;
  return {doorY,hallY,doorId:c?.doorId||0,doorBroken:c?.doorBroken===true,doorTime:c?.doorTime||0,
    targetX:0,targetY:c?.targetY??null,phase:c?.phase||'exploring',
    transition:c?.doorBroken&&doorY!==null?clamp((doorY-state.player.y)/250,0,1):0};
}
export const castleGuidance=state=>state.map==='castle'&&state.level>=45&&!state.arena&&state.castle?.targetY!==null
  ? {x:0,y:state.castle.targetY}:null;
export function ensureCastleExit(state){
  const c=state.castle;if(state.map!=='castle'||state.level<45||c.doorY!==null)return false;
  c.doorY=Math.floor((state.player.y-640)/320)*320;c.hallY=c.doorY-CASTLE.hallHalfHeight;
  c.targetY=c.doorY;c.phase='guidance';c.doorId=state.nextId++;
  if(state.enemies.length>=240){
    let index=-1,farthest=-1;
    for(let n=0;n<state.enemies.length;n++){
      const e=state.enemies[n];if(['guardian','arena-boss','castle-door'].includes(e.kind))continue;
      const distance=(e.x-state.player.x)**2+(e.y-state.player.y)**2;
      if(distance>farthest){farthest=distance;index=n;}
    }
    if(index>=0)state.enemies.splice(index,1);
  }
  state.enemies.push({id:c.doorId,kind:'castle-door',x:0,y:c.doorY,hp:CASTLE_DOOR_HP,maxHp:CASTLE_DOOR_HP,
    radius:100,speed:0,damage:0,value:0,phase:0,hitFlash:0,guardianStage:0,fireTimer:0,elite:false,slowTime:0,actionTimer:0});
  return true;
}
export function updateCastleGoal(state,dt=0){
  if(state.map!=='castle')return;
  state.castle ||= createCastle();
  ensureCastleExit(state);
  const c=state.castle;
  c.phase=state.arena?'arena':c.doorBroken?'passage':state.level>=45?'guidance':'exploring';
  c.targetY=c.doorY===null?null:c.doorBroken?c.hallY:c.doorY;
  if(c.doorBroken)c.doorTime=Math.min(1.2,c.doorTime+dt);
  const door=state.enemies.find(e=>e.id===c.doorId&&e.kind==='castle-door');
  if(door){door.x=0;door.y=c.doorY;door.hitFlash=Math.max(0,door.hitFlash-dt);door.slowTime=0;}
}
export function breakCastleDoor(state,enemy,{effect}){
  const c=state.castle;
  if(state.map!=='castle'||enemy.kind!=='castle-door'||enemy.id!==c?.doorId)return false;
  if(c.doorBroken||enemy.hp>0)return true;
  c.doorBroken=true;c.doorTime=0;c.phase='passage';c.targetY=c.hallY;
  state.enemies=state.enemies.filter(e=>e.id!==enemy.id);
  effect(state,'dissolve',0,c.doorY,110,.7);
  return true;
}

// These are foot anchors and collision radii, not sprite bounding boxes.
// Before the cap the same five bays repeat in BOTH directions without an end.
export function castleProps(minY,maxY,state){
  const props=[];
  const {doorY,hallY}=castleLayout(state);
  const add=(kind,x,y,radius)=>{if(y>=minY-140&&y<=maxY+140)props.push({kind,x,y,radius});};
  const first=Math.floor((minY-160)/320),last=Math.min(first+48,Math.ceil((maxY+160)/320));
  const decor=['piano','flowerbed','bookshelf','flowerbed','bookshelf'];
  for(let i=first;i<=last;i++){
    const y=i*320;
    if(doorY!==null&&y<doorY+80)continue;
    for(const side of [-1,1]){
      add('column',side*(CASTLE.halfWidth-46),y,27);
      const kind=decor[((i+(side===1?2:0))%5+5)%5];
      add(kind,side*(CASTLE.halfWidth-98),y+155,kind==='piano'?56:kind==='bookshelf'?47:51);
      add('candelabra',side*(CASTLE.halfWidth-154),y+34,20);
    }
  }
  if(hallY!==null)for(const side of [-1,1])for(const offset of [-480,-160,160,480]){
    add('column',side*(CASTLE.hallHalfWidth-48),hallY+offset,27);
    add('candelabra',side*(CASTLE.hallHalfWidth-147),hallY+offset+45,20);
  }
  return props;
}
export function castleColliders(minY,maxY,state){
  return castleProps(minY,maxY,state).map((p,i)=>({...p,id:-(i+1),kind:'castle-prop',hp:1}));
}
export function constrainCastleEntity(entity,state,body=20){
  if(state.map!=='castle')return;
  const {doorY,hallY,doorBroken}=castleLayout(state);
  // Wider hall shoulders have a real south wall; walking back beside the
  // opening cannot snap a player sideways into the narrower corridor.
  if(doorBroken&&doorY!==null&&Math.abs(entity.x)>CASTLE.halfWidth-body&&entity.y<doorY+body)
    entity.y=Math.min(entity.y,doorY-body);
  const inHall=Boolean(state.arena)||doorBroken&&doorY!==null&&entity.y<doorY;
  const halfWidth=inHall?CASTLE.hallHalfWidth:CASTLE.halfWidth;
  entity.x=clamp(entity.x,-halfWidth+body,halfWidth-body);
  if(state.arena)entity.y=clamp(entity.y,hallY-CASTLE.hallHalfHeight+body,hallY+CASTLE.hallHalfHeight-body);
  else if(inHall)entity.y=Math.max(entity.y,hallY-CASTLE.hallHalfHeight+body);
  else if(doorY!==null&&!doorBroken)entity.y=Math.max(entity.y,doorY+body);
  for(const p of castleProps(entity.y-100,entity.y+100,state)){
    const dx=entity.x-p.x,dy=entity.y-p.y,d=Math.hypot(dx,dy),radius=body+p.radius;
    if(d<radius){const nx=d?dx/d:(entity.x>0?-1:1),ny=d?dy/d:0;entity.x=p.x+nx*radius;entity.y=p.y+ny*radius;}
  }
  entity.x=clamp(entity.x,-halfWidth+body,halfWidth-body);
}
export function validateCastle(value,state){
  if(state.map!=='castle')return value===null;
  if(!value||typeof value!=='object'||Array.isArray(value)||value.targetX!==0||state.level>45||
    typeof value.doorBroken!=='boolean'||!Number.isFinite(value.doorTime)||value.doorTime<0||value.doorTime>1.2||
    !Number.isInteger(value.doorId)||value.doorId<0||value.doorId>=state.nextId)return false;
  const doors=state.enemies.filter(e=>e.kind==='castle-door');
  if(state.level<45)return value.phase==='exploring'&&value.targetY===null&&value.doorY===null&&value.hallY===null&&
    value.doorId===0&&!value.doorBroken&&value.doorTime===0&&!doors.length&&!state.arena;
  if(!Number.isFinite(value.doorY)||Math.abs(value.doorY)>1e7||value.hallY!==value.doorY-CASTLE.hallHalfHeight)return false;
  if(value.doorBroken)return !doors.length&&value.targetY===value.hallY&&value.phase===(state.arena?'arena':'passage')&&
    (value.doorId>0||Boolean(state.arena));
  const door=doors[0];
  return !state.arena&&value.phase==='guidance'&&value.targetY===value.doorY&&value.doorTime===0&&doors.length===1&&
    door.id===value.doorId&&door.x===0&&door.y===value.doorY&&door.maxHp===CASTLE_DOOR_HP&&door.radius===100&&
    door.speed===0&&door.damage===0&&door.value===0&&door.guardianStage===0;
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
