// Bounded, fixed-step cargo dynamics. Geometry and damage are supplied by the engine.
export function throwCargo(s,o){
  const power=Math.min(1,s.grabTime/.4),speed=230+power*150,head=s.nodes[0];
  o.vx=s.aimX*speed+(head.x-head.px)*60*.35;o.vy=s.aimY*speed-50+(head.y-head.py)*60*.35;
  const v=Math.hypot(o.vx,o.vy);if(v>480){o.vx*=480/v;o.vy*=480/v;}
  o.spin=Math.sign(o.vx||1)*3;o.thrown=true;o.hitIds=[];o.regrab=.25;
}
export function tickCargo(s,dt,move,hit){
  const room=s.rooms[s.room];
  for(const o of room.objects){
    if(o.kind!=='crate'||s.grab?.id===o.id)continue;
    o.regrab=Math.max(0,(o.regrab||0)-dt);
    o.vx=(o.vx||0)*.993;o.vy=Math.min(460,(o.vy||0)+420*dt);
    const steps=Math.max(1,Math.ceil(Math.hypot(o.vx,o.vy)*dt/4)),body={x:o.x,y:o.y,r:18};
    for(let i=0;i<steps;i++){
      let before=body.x,delta=o.vx*dt/steps;move(s,body,delta,0);if(Math.abs(body.x-before-delta)>.02){o.vx*=-.42;o.spin*=-.5;}
      before=body.y;delta=o.vy*dt/steps;move(s,body,0,delta);
      if(Math.abs(body.y-before-delta)>.02){o.vy=Math.abs(o.vy)>75?-o.vy*.32:0;o.vx*=.88;o.spin*=.75;}
      const speed=Math.hypot(o.vx,o.vy);
      if(o.thrown&&speed>130)for(const e of room.enemies){
        if(e.eaten||e.dead||o.hitIds?.includes(e.id)||Math.hypot(body.x-e.x,body.y-(e.y+4))>33)continue;
        (o.hitIds||=[]).push(e.id);hit(s,e,Math.min(5,Math.max(1,Math.floor(speed/85))),o.vx,o.vy);o.vx*=.55;o.vy-=35;o.spin*=.6;
      }
    }
    o.x=body.x;o.y=body.y;o.angle=((o.angle||0)+(o.spin||0)*dt)%(Math.PI*2);
    if(Math.hypot(o.vx,o.vy)<35)o.thrown=false;
  }
}
