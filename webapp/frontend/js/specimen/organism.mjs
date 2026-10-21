// Read-only visual anatomy. Every attachment starts at an existing physical node.
export const ORGANISM_LIMITS=Object.freeze({patches:7,vineSamples:128,windings:3});
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const average=(nodes)=>({x:nodes.reduce((v,n)=>v+n.x,0)/nodes.length,y:nodes.reduce((v,n)=>v+n.y,0)/nodes.length});
const vineCache=new WeakMap();
function displayedVine(s,id,start,end,options){
  let cache=vineCache.get(s);if(!cache){cache=new Map();vineCache.set(s,cache);}
  const key=[start.x,start.y,end.x,end.y,options.bend,options.base,options.normal?.x||0,options.normal?.y||0].map(v=>Math.round(v*8)).join(',');
  const saved=cache.get(id);if(saved?.key===key)return saved.geometry;
  const geometry=vineGeometry(start,end,options);cache.set(id,{key,geometry});return geometry;
}

export function bodyWeave(s,reduced=false){
  const nodes=s.nodes,head=nodes[0],stage=nodes.length>10?2:nodes.length>6?1:0;
  const r=clamp(nodes.reduce((v,n)=>v+n.r,0)/nodes.length,7,14),angle=s.bodyAngle||0,nx=-Math.sin(angle),ny=Math.cos(angle);
  const tail=average(nodes.slice(Math.max(2,nodes.length-4))),middle=average(nodes.slice(1)),shoulder=nodes[Math.min(2,nodes.length-1)];
  const time=reduced?0:s.time,patches=[];
  function patch(slot,centre,side,w,h,turn=0){patches.push({slot,x:centre.x+nx*r*side,y:centre.y+ny*r*side,w:r*w,h:r*h,angle:angle+turn+Math.sin(time*.55+slot)*.035});}
  // These are the same open coils and membranes used by the approved cover.
  patch(1,tail,-.5,5.3,6,.15);
  patch(2,middle,.1,6,5.4,-.12);
  patch(0,shoulder,-.6,5.8,4.7,.1);
  // Draw the open tail ring last, so other textures cannot fill its centre.
  patch(3,tail,stage?1.2:.65,5.5,5.5,-.15);
  if(stage>0)patch(7,middle,-1.55,5.1,4.4,.25);
  const mouth={slot:4,x:head.x+Math.cos(s.aimY===0&&s.aimX===0?angle:Math.atan2(s.aimY,s.aimX))*r*.35,
    y:head.y+Math.sin(s.aimY===0&&s.aimX===0?angle:Math.atan2(s.aimY,s.aimX))*r*.35,w:r*4.05,h:r*(s.grab?3.1:2.7),angle:Math.atan2(s.aimY,s.aimX)};
  const sensory={slot:5,x:head.x-Math.cos(angle)*r*.7+nx*r*.75,y:head.y-Math.sin(angle)*r*.7+ny*r*.75,w:r*2.6,h:r*2.3,angle};
  return{patches,mouth,sensory,r,stage};
}

export function vineGeometry(start,end,{base=5,bend=12,normal=null,phase=0,pitch=14}={}){
  const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy),d=length||1,px=-dy/d,py=dx/d;
  const count=clamp(Math.ceil(length/1.8),8,ORGANISM_LIMITS.vineSamples),pull=Math.min(24,length*.18);
  const c1={x:start.x+dx*.3+px*bend,y:start.y+dy*.3+py*bend};
  const c2=normal?{x:end.x+normal.x*pull+px*bend*.25,y:end.y+normal.y*pull+py*bend*.25}:{x:start.x+dx*.73+px*bend*.65,y:start.y+dy*.73+py*bend*.65};
  const points=[];let arc=0;
  for(let i=0;i<=count;i++){
    const t=i/count,u=1-t,x=u*u*u*start.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x,y=u*u*u*start.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*end.y;
    const tx=3*u*u*(c1.x-start.x)+6*u*t*(c2.x-c1.x)+3*t*t*(end.x-c2.x),ty=3*u*u*(c1.y-start.y)+6*u*t*(c2.y-c1.y)+3*t*t*(end.y-c2.y),tl=Math.hypot(tx,ty)||1;
    if(i)arc+=Math.hypot(x-points[i-1].x,y-points[i-1].y);
    points.push({x,y,t,nx:-ty/tl,ny:tx/tl,radius:(.9+(base-.9)*Math.pow(1-t,.65))*.5,arc});
  }
  const strands=[];
  for(let k=0;k<ORGANISM_LIMITS.windings;k++)strands.push(points.map(p=>{
    const a=p.arc/pitch*TAU+phase+k*TAU/ORGANISM_LIMITS.windings,offset=Math.sin(a)*(p.radius+.35)*Math.min(1,(1-p.t)*12);
    return{x:p.x+p.nx*offset,y:p.y+p.ny*offset,front:Math.cos(a)>=0};
  }));
  return{points,strands,length};
}

function ribbon(ctx,points,scale=1,shift=0){
  ctx.beginPath();
  for(let i=0;i<points.length;i++){const p=points[i],r=p.radius*(scale+shift),x=p.x+p.nx*r,y=p.y+p.ny*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  for(let i=points.length-1;i>=0;i--){const p=points[i],r=p.radius*(scale-shift);ctx.lineTo(p.x-p.nx*r,p.y-p.ny*r);}ctx.closePath();ctx.fill();
}
function winding(ctx,strands,front){
  ctx.beginPath();
  for(const strand of strands){let pen=false;for(const p of strand){if(p.front!==front){pen=false;continue;}if(pen)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);pen=true;}}
  ctx.strokeStyle=front?'#d3424c':'#470d1d';ctx.lineWidth=front?.9:1;ctx.stroke();
}
export function paintVine(ctx,geometry){
  if(geometry.length<2)return;ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  winding(ctx,geometry.strands,false);
  ctx.fillStyle='#310813';ribbon(ctx,geometry.points,1.13);
  ctx.fillStyle='#7d1428';ribbon(ctx,geometry.points,.88,-.1);
  ctx.fillStyle='#b42437';ribbon(ctx,geometry.points,.42,-.28);
  winding(ctx,geometry.strands,true);ctx.restore();
}

export function drawBodyWeave(ctx,s,flesh,reduced=false){
  const weave=bodyWeave(s,reduced);ctx.save();ctx.globalAlpha=s.invulnerable>0&&Math.floor(s.time*18)%2?.68:1;
  // Narrow inter-node tendons support the texture without painting a solid volume.
  ctx.lineWidth=3;ctx.strokeStyle='#700f26';ctx.beginPath();
  for(let i=1;i<s.nodes.length;i++){const n=s.nodes[i],p=s.nodes[n.parent];ctx.moveTo(n.x,n.y);ctx.quadraticCurveTo((n.x+p.x)/2+weave.r*.25,(n.y+p.y)/2-weave.r*.3,p.x,p.y);}ctx.stroke();
  for(const p of [...weave.patches,weave.sensory,weave.mouth]){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);flesh(ctx,p.slot,-p.w/2,-p.h/2,p.w,p.h);ctx.restore();}
  ctx.restore();return weave;
}

export function drawOrganism(ctx,s,flesh,room,reduced=false){
  const stage=s.nodes.length>10?2:s.nodes.length>6?1:0;
  for(let i=0;i<s.limbs.length;i++){
    const l=s.limbs[i],root=s.nodes[l.root],tip=l.anchor||l.tip,d=Math.hypot(tip.x-root.x,tip.y-root.y);
    const bend=(l.planted?Math.min(16,Math.max(2,(l.reach-d)*.085)):21)*(i%2?1:-1);
    paintVine(ctx,displayedVine(s,i,root,tip,{base:3.7+stage*1.2,bend,normal:l.anchor?{x:l.anchor.nx,y:l.anchor.ny}:null,phase:i*1.7,pitch:11+stage*1.2}));
  }
  drawBodyWeave(ctx,s,flesh,reduced);
  if(s.grab){const target=(s.grab.type==='enemy'?room.enemies:room.objects).find(o=>o.id===s.grab.id);if(target)paintVine(ctx,displayedVine(s,'grab',s.nodes[0],target,{base:5+stage,bend:14,phase:1.3,pitch:12}));}
}
