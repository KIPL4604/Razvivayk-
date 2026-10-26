// Deterministic, bounded simulation effects. Rendering never advances these bodies.
export const EFFECT_LIMITS=Object.freeze({particles:120,fragments:36,decals:64,flashes:8});
import {BLOOD} from './tuning.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MATERIALS=Object.freeze({metal:{bounce:.38,drag:.985,friction:.72,life:5,color:'#9ba8a9'},glass:{bounce:.55,drag:.991,friction:.76,life:4,color:'#b2d7d7'},tissue:{bounce:.07,drag:.97,friction:.58,life:3,color:'#ab2639'}});
export function surfaceMark(s,x,y,nx=0,ny=-1,size=5){
  s.decals.push({room:s.room,x,y,nx,ny,size:clamp(size,2,12),age:0,run:0});
  if(s.decals.length>EFFECT_LIMITS.decals)s.decals.shift();
}
export function emit(s,kind,x,y,dx=0,dy=-1,count=12){
  const direction=Math.hypot(dx,dy)||1;dx/=direction;dy/=direction;
  const colors={blood:'#ce3046',absorb:'#951a35',spark:'#ffe1a0',dust:'#8e8c86',steam:'#bdc4bc',smoke:'#54545c',fire:'#ef9c43'};
  for(let i=0;i<count&&s.particles.length<EFFECT_LIMITS.particles;i++){
    const spread=Math.sin((s.ticks+i*13)*2.399),side=Math.cos((s.ticks+i*7)*1.73),speed=35+i*6;
    const life=kind==='smoke'||kind==='steam'?.7+i*.026:.28+i*.025;
    s.particles.push({kind,x,y,vx:dx*speed+spread*speed*.8,vy:dy*speed+side*speed*.65,life,max:life,color:colors[kind]||colors.dust});
  }
}
export function flash(s,x,y,color='#ffc87d',radius=62){
  if(s.flashes.length>=EFFECT_LIMITS.flashes)s.flashes.shift();
  s.flashes.push({x,y,color,radius,life:.14,max:.14});
}
export function fragments(s,material,x,y,dx=0,dy=-1,count=6){
  const m=MATERIALS[material];
  for(let i=0;i<count&&s.fragments.length<EFFECT_LIMITS.fragments;i++){
    const a=(s.ticks+i*9)*2.399,speed=45+i*12,r=material==='tissue'?2.4:1.5+i%2;
    s.fragments.push({material,x,y,r,vx:dx*speed+Math.cos(a)*speed,vy:dy*speed+Math.sin(a)*speed,angle:a,spin:Math.sin(a)*7,life:m.life,sleep:0,...m});
  }
}
export function impact(s,x,y,vx,vy,damage=1){
  const speed=Math.hypot(vx,vy)||1,dx=vx/speed,dy=vy/speed;
  emit(s,'blood',x,y,dx,dy,10+Math.min(14,damage*3));fragments(s,'tissue',x,y,dx,dy,Math.min(4,damage));
}
export function tickEffects(s,dt,move,solid){
  for(const d of s.decals){
    d.age=Math.min(BLOOD.dryTime*2,(d.age||0)+dt);d.run||=0;
    if(d.room===s.room&&d.nx&&d.age<BLOOD.dripTime&&d.run<BLOOD.dripLength){
      const next=d.run+dt*BLOOD.dripLength/BLOOD.dripTime;
      if(solid(s,d.x-d.nx*2,d.y+next)&&!solid(s,d.x+d.nx*2,d.y+next))d.run=next;
    }
  }
  for(let i=s.particles.length-1;i>=0;i--){
    const p=s.particles[i];p.life-=dt;
    if(p.kind==='blood'){
      const body={x:p.x,y:p.y,r:.8},x=p.x,y=p.y,dx=p.vx*dt,dy=p.vy*dt;move(s,body,dx,dy);
      if(Math.abs(body.x-x-dx)+Math.abs(body.y-y-dy)>.04){
        const wall=Math.abs(body.x-x-dx)>.02;
        surfaceMark(s,body.x,body.y,wall?-Math.sign(dx):0,wall?0:-Math.sign(dy),3+Math.min(7,Math.hypot(p.vx,p.vy)/38));p.life=0;
      }
      p.x=body.x;p.y=body.y;p.vy+=380*dt;p.vx*=.99;
    }else{
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      p.vy+=(p.kind==='steam'||p.kind==='smoke'?-32:90)*dt;p.vx*=.98;
      if(solid(s,p.x,p.y))p.life=0;
    }
    if(p.life<=0)s.particles.splice(i,1);
  }
  for(let i=s.fragments.length-1;i>=0;i--){
    const f=s.fragments[i];f.life-=dt;
    if(f.sleep<.3){
      f.vx*=f.drag;f.vy=Math.min(420,f.vy+420*dt);const x=f.x,y=f.y,dx=f.vx*dt,dy=f.vy*dt;
      move(s,f,dx,0);if(Math.abs(f.x-x-dx)>.02){f.vx*=-f.bounce;f.spin*=-.5;}
      move(s,f,0,dy);if(Math.abs(f.y-y-dy)>.02){
        if(f.material==='tissue'&&Math.abs(f.vy)>45)surfaceMark(s,f.x,f.y,0,-Math.sign(dy),4);
        f.vy=Math.abs(f.vy)>45?-f.vy*f.bounce:0;f.vx*=f.friction;f.spin*=.65;
      }
      f.angle+=f.spin*dt;
      if(Math.hypot(f.vx,f.vy)<7)f.sleep+=dt;else f.sleep=0;
    }
    if(f.life<=0)s.fragments.splice(i,1);
  }
  for(let i=s.flashes.length-1;i>=0;i--){s.flashes[i].life-=dt;if(s.flashes[i].life<=0)s.flashes.splice(i,1);}
}
