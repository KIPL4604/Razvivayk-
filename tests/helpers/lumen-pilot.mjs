// QA only. Chooses ordinary directional input from visible threats and pickups.
// Never edits gameplay, health, spawns, upgrades, or positions.
import {bodyRadius,PLAYER_BODY} from '../../webapp/frontend/js/lumen/physics.mjs';
export function steer(run,frame,memory){
  if(frame%6&&memory.input)return memory.input;
  const p=run.player;
  let target=null,nearest=Infinity;
  for(const item of [...run.chests,...run.gems]){
    const d=Math.hypot(item.x-p.x,item.y-p.y);
    if(d<nearest){nearest=d;target=item;}
  }
  const nearby=run.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<260);
  if(!target&&run.enemies.length){
    const e=run.enemies.reduce((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(b.x-p.x,b.y-p.y)?a:b);
    const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
    target={x:e.x+dx/d*95,y:e.y+dy/d*95};
  }
  const gx=target?target.x-p.x:Math.cos(frame/260),gy=target?target.y-p.y:Math.sin(frame/260),gd=Math.hypot(gx,gy)||1;
  const shots=run.projectiles.filter(s=>s.hostile&&Math.hypot(s.x-p.x,s.y-p.y)<200);
  let best=-Infinity,input={x:0,y:0};
  for(let i=0;i<24;i++){
    const angle=i*Math.PI/12,x=Math.cos(angle),y=Math.sin(angle);
    let score=(x*gx+y*gy)/gd+.18*(x*(memory.input?.x||0)+y*(memory.input?.y||0));
    for(const horizon of [.2,.5]){
      const px=p.x+x*p.speed*horizon,py=p.y+y*p.speed*horizon;
      for(const e of nearby){
        const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
        const spacing=['spitter','moonmoth'].includes(e.kind)&&d<140?-.6:1;
        const ex=e.x+dx/d*e.speed*horizon*spacing,ey=e.y+dy/d*e.speed*horizon*spacing;
        const clearance=Math.hypot(px-ex,py-ey)-bodyRadius(e)-PLAYER_BODY;
        if(clearance<40)score-=Math.min(15,((40-clearance)/30)**2)*1.5;
      }
      for(const s of shots){const d=Math.hypot(px-s.x-s.vx*horizon,py-s.y-s.vy*horizon);if(d<42)score-=(42-d)/5;}
      for(const warning of run.effects.filter(e=>e.kind==='charge')){
        const dx=warning.toX-warning.x,dy=warning.toY-warning.y,len=dx*dx+dy*dy||1;
        const along=Math.max(0,Math.min(1,((px-warning.x)*dx+(py-warning.y)*dy)/len));
        const d=Math.hypot(px-warning.x-dx*along,py-warning.y-dy*along);if(d<50)score-=(50-d)/8;
      }
    }
    if(score>best){best=score;input={x,y};}
  }
  memory.input=input;return input;
}
