// Four bounded joints, fixed iteration count, collision after every correction.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function makePose(e){
  e.pose||=[[-16,7],[6,14],[18,11],[24,6]].map(([dy,r])=>({x:e.x,y:e.y+dy,px:e.x,py:e.y+dy,r}));
  return e.pose;
}
export function launchHuman(e,vx,vy){
  e.knock=Math.max(e.knock,.85);e.vx=clamp(vx,-380,380);e.vy=clamp(vy,-360,360);e.windup=0;e.fireTime=0;
  const pose=makePose(e);pose.forEach((n,i)=>{n.px=n.x-e.vx/60+(i-1.4)*Math.sign(vx||1)*.6;n.py=n.y-e.vy/60+(i-1)*.16;});
}
export function dragHuman(s,e,dx,dy,move){
  // The torso retains a >24px diameter: a person never fits a specimen duct.
  makePose(e);
  const b={x:e.x,y:e.y+12,r:14},x=b.x,y=b.y;move(s,b,dx,dy);
  const mx=b.x-x,my=b.y-y;e.x=b.x;e.y=b.y-12;
  if(e.pose)for(const n of e.pose){const x=n.x,y=n.y;move(s,n,mx,my);n.px+=n.x-x;n.py+=n.y-y;}
  e.vx=clamp(mx*60,-300,300);e.vy=clamp(my*60,-300,300);
}
export function tickHumanMotion(s,e,dt,move,solid,onFall){
  e.hurt=Math.max(0,e.hurt-dt);e.knock=Math.max(0,e.knock-dt);
  e.impactCooldown=Math.max(0,(e.impactCooldown||0)-dt);
  if(e.eaten||s.grab?.id===e.id)return;
  if(e.dead||e.knock>0||e.pose){
    const pose=makePose(e),before=pose.map(n=>({x:n.x,y:n.y}));
    let collision=null;
    for(const [i,n]of pose.entries()){
      const vx=clamp((n.x-n.px)*.965,-6,6),vy=clamp((n.y-n.py)*.985+420*dt*dt,-6,7);n.px=n.x;n.py=n.y;move(s,n,vx,vy);
      if(i===1&&Math.hypot(vx,vy)/dt>240&&Math.hypot(n.x-n.px-vx,n.y-n.py-vy)>.2)collision={vx:vx/dt,vy:vy/dt};
    }
    const lengths=[22,18,17];
    for(let pass=0;pass<4;pass++)for(let j=1;j<pose.length;j++){
      const a=pose[j-1],b=pose[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,amount=clamp((d-lengths[j-1])*.45,-2,2)/d;
      move(s,a,dx*amount,dy*amount);move(s,b,-dx*amount,-dy*amount);
    }
    pose.forEach(n=>{move(s,n,0,0);if(Math.hypot(n.x-n.px,n.y-n.py)<.08){n.px=n.x;n.py=n.y;}});
    e.x=pose[1].x;e.y=pose[1].y-6;e.vx=clamp((pose[1].x-before[1].x)/dt,-380,380);e.vy=clamp((pose[1].y-before[1].y)/dt,-420,420);
    if(collision&&e.impactCooldown===0){e.impactCooldown=.5;onFall(s,e,1,collision.vx,collision.vy);}
    if(!e.dead&&e.knock===0&&Math.hypot(e.vx,e.vy)<18){
      const b={x:e.x,y:e.y+12,r:14},x=b.x,y=b.y;move(s,b,0,0);
      const headClear=!solid(s,b.x,b.y-34)&&!solid(s,b.x-7,b.y-30)&&!solid(s,b.x+7,b.y-30);
      if(headClear&&Math.hypot(b.x-x,b.y-y)<2){e.pose=null;e.vx=0;e.vy=0;}
    }
    return;
  }
  e.vy=Math.min(420,(e.vy||0)+420*dt);
  const b={x:e.x,y:e.y+12,r:14},x=b.x,y=b.y,v=e.vy;move(s,b,e.vx*dt,e.vy*dt);
  if(Math.abs(b.x-x-e.vx*dt)>.02)e.vx=0;
  if(Math.abs(b.y-y-e.vy*dt)>.02){e.vy=0;if(v>240){onFall(s,e,Math.max(1,Math.floor((v-160)/100)),e.vx,v);}}
  e.x=b.x;e.y=b.y-12;e.vx*=.88;
  // A second head probe prevents upright people being dragged under low lintels.
  const head={x:e.x,y:e.y-15,r:7},hx=head.x,hy=head.y;move(s,head,0,0);
  if(Math.hypot(head.x-hx,head.y-hy)>1)launchHuman(e,e.vx,-25);
}
