import {ROOMS,formFor} from './world.mjs';
import {isScientist,isMilitary} from './props.mjs';
import {navigateHuman} from './navigation.mjs';
import {NAV,ROUTINE} from './tuning.mjs';
import {fragments} from './effects.mjs';
export function tickStaff(s,e,dt,solid,move){
  const room=s.rooms[s.room],science=isScientist(e),military=isMilitary(e);
  if(military){
    e.alone=room.enemies.filter(v=>isMilitary(v)&&!v.dead&&!v.eaten).length===1;
    if(e.visible)e.threatForm=formFor(s.mass);
    if(e.memory>0&&e.alone&&e.threatForm===2)e.behavior='flee';
    else if(e.visible&&e.reaction===0)e.behavior='defend';
  }
  const afraid=e.behavior==='flee'||e.behavior==='startled'&&science;
  if(afraid&&!e.panicking){
    e.panicking=true;e.stumble=ROUTINE.stumbleTime;e.route=[];e.activity=null;
    if(e.heldTube){fragments(s,'glass',e.x+e.dir*12,e.y-10,e.dir,-1,ROUTINE.sampleDrop);e.heldTube=false;}
  }
  e.stumble=Math.max(0,(e.stumble||0)-dt);
  if(e.reaction>0||e.stumble>0){e.walking=false;return;}
  if(e.behavior==='flee'){
    e.activity=null;e.windup=0;e.fireTime=0;
    if(e.lastSeen)navigateHuman(s,e,e.lastSeen,dt,solid,move,{flee:true,speed:NAV.runSpeed});
    return;
  }
  if(e.behavior==='defend'){
    e.activity=null;
    if(e.climbing)navigateHuman(s,e,e.lastSeen,dt,solid,move);
    else e.route=[];
    return;
  }
  if(['investigate','search'].includes(e.behavior)&&e.lastSeen){
    e.activity=null;navigateHuman(s,e,e.lastSeen,dt,solid,move,{speed:NAV.walkSpeed});return;
  }
  e.panicking=false;
  if(science){
    const stations=ROOMS[s.room].stations.filter(st=>room.objects.some(o=>o.id===st.prop&&!o.broken));
    if(!stations.length){e.activity='idle';return;}
    if(!e.station||!stations.some(st=>st.id===e.station))e.station=stations[e.senseSlot%stations.length].id;
    const station=stations.find(st=>st.id===e.station);
    if(e.climbing){e.activity='walk';navigateHuman(s,e,station,dt,solid,move);return;}
    const dx=station.x-e.x,dy=station.y-e.y;
    if(Math.abs(dx)<ROUTINE.dockReach&&Math.abs(dy)<NAV.grid&&(Math.abs(dx)>ROUTINE.dockArrival||Math.abs(dy)>ROUTINE.dockArrival)){
      const b={x:e.x,y:e.y+12,r:14,npc:true},step=NAV.walkSpeed*dt;
      move(s,b,Math.max(-step,Math.min(step,dx)),Math.max(-step,Math.min(step,dy)));
      e.walking=Math.hypot(b.x-e.x,b.y-e.y-12)>.02;e.x=b.x;e.y=b.y-12;e.activity='walk';e.heldTube=false;e.route=[];if(Math.abs(dx)>1)e.dir=Math.sign(dx);return;
    }
    if(Math.abs(dx)<=ROUTINE.dockArrival&&Math.abs(dy)<=ROUTINE.dockArrival){
      e.activity=station.mode;e.dir=1;e.walking=false;e.workPhase+=dt;e.heldTube=station.mode==='sample';
      if(e.workPhase>ROUTINE.workTime){e.workPhase=0;e.station=stations[(stations.indexOf(station)+1)%stations.length].id;e.route=[];}
    }else{
      e.activity='walk';e.heldTube=false;navigateHuman(s,e,station,dt,solid,move);
      e.jobWait=e.walking||e.climbing?0:(e.jobWait||0)+dt;
      if(e.jobWait>ROUTINE.restTime){e.station=stations[(stations.indexOf(station)+1)%stations.length].id;e.route=[];e.jobWait=0;}
    }
  }else{
    e.activity='patrol';e.patrolTime=(e.patrolTime||0)+dt;
    if(!e.patrolGoal||e.patrolTime>ROUTINE.workTime){
      e.patrolTime=0;e.patrolSide=-(e.patrolSide||-1);
      e.patrolGoal={x:e.home+e.patrolSide*ROUTINE.patrolRadius,y:e.y};e.route=[];
    }
    navigateHuman(s,e,e.patrolGoal,dt,solid,move);
  }
}
