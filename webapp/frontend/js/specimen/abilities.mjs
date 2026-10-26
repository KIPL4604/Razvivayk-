import {ECHO} from './tuning.mjs';
export function activateEcho(s){
  if(!s.abilities.echo||s.echoCooldown>0)return false;
  s.echoCooldown=ECHO.cooldown;s.echoTime=ECHO.duration;s.echoOrigin={x:s.x,y:s.y,room:s.room};
  s.echoTargets=s.rooms[s.room].enemies.filter(e=>!e.eaten&&Math.hypot(e.x-s.x,e.y-s.y)<=ECHO.radius).map(e=>({id:e.id,x:e.x,y:e.y,d:Math.hypot(e.x-s.x,e.y-s.y)}));
  s.soundKind='echo';s.soundEvent=(s.soundEvent||0)+1;return true;
}
export function tickEcho(s,dt){
  s.echoCooldown=Math.max(0,s.echoCooldown-dt);s.echoTime=Math.max(0,s.echoTime-dt);
  if(!s.echoTime)s.echoTargets=[];
}
