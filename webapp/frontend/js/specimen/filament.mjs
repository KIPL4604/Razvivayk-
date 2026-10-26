import {LIMB} from './tuning.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Small Verlet chains; endpoint forces are supplied by the support/tether solver.
// A collision-safe straight path is the fallback when a bend touches a corner.
export function tickFilament(s,owner,start,end,taut,solid,dt){
  const count=LIMB.segments,dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
  if(!owner.path||owner.path.length!==count+1)owner.path=Array.from({length:count+1},(_,i)=>({x:start.x+dx*i/count,y:start.y+dy*i/count,px:start.x+dx*i/count,py:start.y+dy*i/count}));
  const points=owner.path,rest=(length+LIMB.slack*(1-taut))/count;
  for(let i=1;i<count;i++){
    const p=points[i],limit=LIMB.maxPointSpeed*dt,vx=clamp((p.x-p.px)*LIMB.damping,-limit,limit),vy=clamp((p.y-p.py)*LIMB.damping+LIMB.gravity*dt*dt,-limit,limit);
    p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy;
  }
  const pin=()=>{Object.assign(points[0],{x:start.x,y:start.y});Object.assign(points[count],{x:end.x,y:end.y});};
  for(let pass=0;pass<LIMB.passes;pass++){
    pin();for(let i=1;i<=count;i++){
      const a=points[i-1],b=points[i],x=b.x-a.x,y=b.y-a.y,d=Math.hypot(x,y)||1,k=Math.max(0,d-rest)/d*.5;
      if(i>1){a.x+=x*k;a.y+=y*k;}if(i<count){b.x-=x*k;b.y-=y*k;}
    }
  }
  pin();
  // Bound folding during rapid extension: links retain their order along the
  // tendon while transverse inertia supplies the visible bow and recoil.
  if(length>1)for(let i=1;i<count;i++){
    const p=points[i],rx=p.x-start.x,ry=p.y-start.y,along=clamp((rx*dx+ry*dy)/(length*length),(i-LIMB.orderMargin)/count,(i+LIMB.orderMargin)/count),maxBend=Math.min(LIMB.bendLimit,length*LIMB.bendRatio)*Math.sin(i/count*Math.PI),side=clamp((-rx*dy+ry*dx)/length,-maxBend,maxBend);
    p.x=start.x+dx*along-dy/length*side;p.y=start.y+dy*along+dx/length*side;
  }
  let unsafe=false;
  for(let i=1;i<=count&&!unsafe;i++){
    const a=points[i-1],b=points[i],d=Math.hypot(b.x-a.x,b.y-a.y),samples=Math.max(1,Math.ceil(d/LIMB.collisionStep));
    for(let j=1;j<=samples;j++){if(i===count&&j===samples)continue;if(solid(s,a.x+(b.x-a.x)*j/samples,a.y+(b.y-a.y)*j/samples)){unsafe=true;break;}}
  }
  if(unsafe)points.forEach((p,i)=>{p.x=p.px=start.x+dx*i/count;p.y=p.py=start.y+dy*i/count;});
}
