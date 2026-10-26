import {SENSE as P,BLOOD} from './tuning.mjs';
import {isScientist} from './props.mjs';
import {ROUTINE} from './tuning.mjs';
export function noise(s,x,y,strength=1,kind='impact',sourceId=null){
  s.noises||=[];if(s.noises.length>=P.maxNoises)s.noises.shift();
  s.noises.push({room:s.room,x,y,strength,kind,life:P.noiseLife,sourceId});
  if(s.time>=(s.nextSound||0)){s.soundKind=kind;s.soundEvent=(s.soundEvent||0)+1;s.nextSound=s.time+P.soundGap;}
}
export function tickNoises(s,dt){for(let i=s.noises.length-1;i>=0;i--){s.noises[i].life-=dt;if(s.noises[i].life<=0)s.noises.splice(i,1);}}
function remember(e,x,y,state,time){e.lastSeen={x,y};e.memory=time;e.behavior=state;}
export function perceive(s,e,room,clear,dt){
  e.memory=Math.max(0,(e.memory||0)-dt);e.reaction=Math.max(0,(e.reaction||0)-dt);
  e.callTime=Math.max(0,(e.callTime||0)-dt);
  const dx=s.x-e.x,dy=s.y-(e.y-P.eyeOffset),d=Math.hypot(dx,dy),sees=d<P.sight&&(d<P.near||dx*e.dir/(d||1)>P.cone)&&clear(s,e.x,e.y-P.eyeOffset,s.x,s.y);
  if(sees){
    if(!e.visible){e.reaction=P.reaction*(isScientist(e)?P.civilianReactionScale:P.armedReactionScale);e.callTime=P.callDelay;}
    e.alert=3;remember(e,s.x,s.y,e.reaction>0?'startled':isScientist(e)?'flee':'defend',P.memory);
  }else if(e.memory>0){e.behavior=e.alert>0&&isScientist(e)?'flee':'search';}
  else{e.behavior='idle';e.lastSeen=null;}
  e.visible=sees;
  // Stagger expensive trace/hearing scans. Sound is a location, never a live target.
  if(!sees&&(s.ticks+e.senseSlot)%P.scanTicks===0){
    let heard=null,best=0;
    for(const n of s.noises){
      if(n.room!==s.room||n.sourceId===e.id)continue;const dist=Math.hypot(n.x-e.x,n.y-e.y),through=clear(s,e.x,e.y-P.eyeOffset,n.x,n.y),range=P.hearing*n.strength*(through?1:P.occludedHearing),value=range-dist;
      if(value>best){heard=n;best=value;}
    }
    if(heard){
      const panic=isScientist(e)&&(heard.kind==='call'||heard.strength>=ROUTINE.noisePanic);
      remember(e,heard.x,heard.y,panic?'flee':'investigate',panic?P.memory:P.search);
      if(panic){e.alert=3;e.reaction=Math.max(e.reaction,ROUTINE.panicDelay);}
      e.dir=Math.sign(heard.x-e.x)||e.dir;
      if(heard.kind==='call')e.alert=Math.max(e.alert,P.callAlert);
    }else if(!e.memory){
      const trace=s.decals.find(t=>t.room===s.room&&t.size>=BLOOD.traceSize&&(t.age||0)<P.traceAge&&Math.hypot(t.x-e.x,t.y-e.y)<P.traceRange&&(t.x-e.x)*e.dir>0&&clear(s,e.x,e.y-P.eyeOffset,t.x,t.y));
      const body=room.enemies.find(other=>other!==e&&!other.eaten&&(other.dead||other.knock>0)&&Math.hypot(other.x-e.x,other.y-e.y)<P.traceRange&&(other.x-e.x)*e.dir>0&&clear(s,e.x,e.y-P.eyeOffset,other.x,other.y));
      if(trace||body){const clue=trace||body;remember(e,clue.x,clue.y,'investigate',P.search);}
    }
  }
  if(sees&&e.reaction===0&&e.callTime===0&&!e.called){
    e.called=true;noise(s,e.x,e.y,P.callRange/P.hearing,'call',e.id);
  }
  if(!e.memory)e.called=false;
  return {sees,d};
}
