import {SENSE as P,BLOOD} from './tuning.mjs';
export function noise(s,x,y,strength=1,kind='impact'){
  s.noises||=[];if(s.noises.length>=P.maxNoises)s.noises.shift();
  s.noises.push({room:s.room,x,y,strength,kind,life:P.noiseLife});
  if(s.time>=(s.nextSound||0)){s.soundKind=kind;s.soundEvent=(s.soundEvent||0)+1;s.nextSound=s.time+P.soundGap;}
}
export function tickNoises(s,dt){for(let i=s.noises.length-1;i>=0;i--){s.noises[i].life-=dt;if(s.noises[i].life<=0)s.noises.splice(i,1);}}
function remember(e,x,y,state,time){e.lastSeen={x,y};e.memory=time;e.behavior=state;}
export function perceive(s,e,room,clear,dt){
  e.memory=Math.max(0,(e.memory||0)-dt);e.reaction=Math.max(0,(e.reaction||0)-dt);
  e.callTime=Math.max(0,(e.callTime||0)-dt);
  const dx=s.x-e.x,dy=s.y-(e.y-6),d=Math.hypot(dx,dy),sees=d<P.sight&&(d<P.near||dx*e.dir/(d||1)>P.cone)&&clear(s,e.x,e.y-6,s.x,s.y);
  if(sees){
    if(!e.visible){e.reaction=P.reaction*(e.kind==='tech'?P.civilianReactionScale:P.armedReactionScale);e.callTime=P.callDelay;}
    e.alert=3;remember(e,s.x,s.y,e.reaction>0?'startled':e.kind==='tech'?'flee':'defend',P.memory);
  }else if(e.memory>0){e.behavior=e.alert>0&&e.kind==='tech'?'flee':'search';}
  else{e.behavior='idle';e.lastSeen=null;}
  e.visible=sees;
  // Stagger expensive trace/hearing scans. Sound is a location, never a live target.
  if(!sees&&(s.ticks+e.senseSlot)%P.scanTicks===0){
    let heard=null,best=0;
    for(const n of s.noises){
      if(n.room!==s.room)continue;const dist=Math.hypot(n.x-e.x,n.y-e.y),through=clear(s,e.x,e.y-6,n.x,n.y),range=P.hearing*n.strength*(through?1:P.occludedHearing),value=range-dist;
      if(value>best){heard=n;best=value;}
    }
    if(heard){
      remember(e,heard.x,heard.y,heard.kind==='call'&&e.kind==='tech'?'flee':'investigate',P.search);
      e.dir=Math.sign(heard.x-e.x)||e.dir;
      if(heard.kind==='call')e.alert=Math.max(e.alert,P.callAlert);
    }else if(!e.memory){
      const trace=s.decals.find(t=>t.room===s.room&&t.size>=BLOOD.traceSize&&(t.age||0)<P.traceAge&&Math.hypot(t.x-e.x,t.y-e.y)<P.traceRange&&(t.x-e.x)*e.dir>0&&clear(s,e.x,e.y-6,t.x,t.y));
      const body=room.enemies.find(other=>other!==e&&!other.eaten&&(other.dead||other.knock>0)&&Math.hypot(other.x-e.x,other.y-e.y)<P.traceRange&&(other.x-e.x)*e.dir>0&&clear(s,e.x,e.y-6,other.x,other.y));
      if(trace||body){const clue=trace||body;remember(e,clue.x,clue.y,'investigate',P.search);}
    }
  }
  if(sees&&e.reaction===0&&e.callTime===0&&!e.called){
    e.called=true;noise(s,e.x,e.y,P.callRange/P.hearing,'call');
  }
  if(!e.memory)e.called=false;
  return {sees,d};
}
export function humanIntent(s,e,solid,dt){
  if(e.reaction>0||!e.lastSeen||!['flee','investigate','search'].includes(e.behavior))return;
  const away=e.behavior==='flee',dx=e.lastSeen.x-e.x;
  let dir=away?-Math.sign(dx||e.dir):Math.abs(dx)>P.arrival?Math.sign(dx):0;
  if(!dir){e.dir=Math.sin(s.time*P.lookRate+e.senseSlot)>0?1:-1;return;}
  const speed=away?P.fleeSpeed:P.searchSpeed,nx=e.x+dir*speed*dt;
  if(!solid(s,nx+dir*14,e.y)&&!solid(s,nx+dir*14,e.y-18)&&solid(s,nx+dir*14,e.y+28)){e.x=nx;e.dir=dir;e.walking=true;}
  else{e.walking=false;e.dir=away?-dir:dir;e.behavior=away?'cower':'search';}
}
