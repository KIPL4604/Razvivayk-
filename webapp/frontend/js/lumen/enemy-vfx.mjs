// Hostile-projectile presentation only: no RNG calls, simulation writes or save fields.
const TAU=Math.PI*2;
const MAX_SHOTS=160,MAX_POINTS=6,MAX_FADES=24,MAX_TRAILS=32,MAX_SPARKS=36;
const colors=['#ffaf76','#ffd27c','#fff1c5','#ead8bb'];
const number=n=>Number.isFinite(n)?n:0;
const angleOf=shot=>Math.atan2(number(shot.vy),number(shot.vx));
const noise=n=>((Math.imul(n|0,1597334677)^3812015801)>>>0)/4294967296;

/** Select existing visual families without attaching an owner/type to the shot. */
export function enemyProjectileFamily(state,shot){
  if(shot.radius>=20&&!shot.vx&&!shot.vy)return 2;
  if(shot.weapon==='moon_shard')return 3;
  if(state.map==='castle'&&state.arena)return 0;
  if(state.map==='castle'&&Math.abs(Math.hypot(shot.vx,shot.vy)-145)<.01&&shot.damage===9)return 3;
  let owner=null,best=180*180;
  for(const enemy of state.enemies||[]){
    const distance=(enemy.x-shot.x)**2+(enemy.y-shot.y)**2;
    if(distance<best){best=distance;owner=enemy;}
  }
  if(owner?.bossType==='monarch'||owner?.bossType==='conductor')return 0;
  if(owner?.kind==='paper-moth')return 3;
  if(owner?.kind==='wax-servant')return 2;
  return 1;
}

export class EnemyVFX{
  constructor(){this.reset();}
  reset(){this.runId=null;this.time=-1;this.shots=new Map();this.fades=[];this.beginFrame();}
  beginFrame(){this.trails=0;this.sparks=0;this.halos=0;}
  observe(state){
    const time=number(state.time),fresh=this.runId!==state.runId||this.time<0||time<this.time;
    if(fresh){this.shots.clear();this.fades=[];}
    if(this.time===time&&this.runId===state.runId)return;
    const next=new Map();
    for(const shot of (state.projectiles||[]).filter(p=>p.hostile).slice(-MAX_SHOTS)){
      const old=this.shots.get(shot.id),points=old?old.points.filter(p=>time-p.time<.14):[];
      if(!points.length||Math.hypot(shot.x-points.at(-1).x,shot.y-points.at(-1).y)>2){
        points.push({x:shot.x,y:shot.y,time});
      }
      next.set(shot.id,{row:old?.row??enemyProjectileFamily(state,shot),points:points.slice(-MAX_POINTS),
        x:shot.x,y:shot.y,vx:number(shot.vx),vy:number(shot.vy),radius:shot.radius,angle:angleOf(shot),since:old?.since??time,life:shot.life});
    }
    const battleEnded=state.arena&&!['forming','fighting'].includes(state.arena.phase);
    if(!fresh&&!battleEnded){
      let emitted=0;
      for(const [id,old] of this.shots){
        if(next.has(id)||emitted>=12)continue;
        const age=Math.min(.05,Math.max(0,time-this.time));
        this.fades.push({id,row:old.row,x:old.x+old.vx*age,y:old.y+old.vy*age,angle:old.angle,since:time,life:.22});
        emitted++;
      }
    }
    this.fades=battleEnded?[]:this.fades.filter(p=>time-p.since<p.life).slice(-MAX_FADES);
    this.shots=next;this.time=time;this.runId=state.runId;
  }

  sprite(r,row,frame,x,y,size,angle=0,alpha=1){
    const atlas=r.art.images['enemy-projectiles'];if(!atlas)return false;
    const c=r.ctx,[px,py]=r.at(x,y),width=Math.max(1,Math.round(size*r.zoom));
    const anchor=r.art.manifest.enemyProjectiles?.anchor||[20,16];
    c.save();c.translate(px,py);c.rotate(angle);c.globalAlpha=Math.max(0,Math.min(1,alpha));
    c.drawImage(atlas,frame*32,row*32,32,32,-width*anchor[0]/32,-width*anchor[1]/32,width,width);
    c.restore();return true;
  }

  projectile(r,shot,point,time){
    if(!r.art.images['enemy-projectiles'])return false;
    if(Number.isFinite(r.width)&&Number.isFinite(r.height)){
      const [x,y]=r.at(point.x,point.y),margin=70*r.dpr;
      if(x<-margin||x>r.width*r.dpr+margin||y<-margin||y>r.height*r.dpr+margin)return true;
    }
    const old=this.shots.get(shot.id),row=old?.row??enemyProjectileFamily({map:r.map,arena:r.arena,enemies:[]},shot);
    const wax=shot.radius>=20&&!shot.vx&&!shot.vy,angle=wax?0:angleOf(shot);
    const frame=r.media.matches?0:Math.floor(time*12+shot.id%6)%6;
    const size=wax?shot.radius*2.1:row===1?50:row===3?42:48;
    if(wax){
      // The complete stationary danger footprint remains visible below the droplet.
      const c=r.ctx,[x,y]=r.at(point.x,point.y);
      c.save();c.globalAlpha=.78;c.fillStyle='#5b3b27';c.beginPath();c.ellipse(x,y,shot.radius*r.zoom,shot.radius*r.zoom,0,0,TAU);c.fill();
      c.strokeStyle='#efc47c';c.lineWidth=Math.max(r.dpr,1.5*r.zoom);c.stroke();c.restore();
      this.sprite(r,row,frame,point.x,point.y,size,0,.95);return true;
    }
    if(!r.media.matches&&old&&old.points.length>1&&this.trails<MAX_TRAILS){
      this.trails++;
      const c=r.ctx,points=old.points;
      c.save();c.strokeStyle=colors[row];c.lineCap='round';
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=i===points.length-1?point:points[i];
        const [x,y]=r.at(a.x,a.y),[tx,ty]=r.at(b.x,b.y);
        c.globalAlpha=.08+.21*i/points.length;c.lineWidth=Math.max(r.dpr,(row===1?4:5)*r.zoom*i/points.length);
        c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.stroke();
      }
      c.restore();
      if(shot.id%3===0&&this.sparks<MAX_SPARKS){
        const age=(time*9+shot.id*.37)%1,side=(noise(shot.id)-.5)*10;
        const x=point.x-Math.cos(angle)*(9+age*22)-Math.sin(angle)*side,y=point.y-Math.sin(angle)*(9+age*22)+Math.cos(angle)*side;
        this.spark(r,x,y,colors[row],(1-age)*.65,2);
      }
    }
    // Core keeps its authored dark rim and ivory highlights; trails never become colliders.
    if(!r.media.matches&&row<2&&this.halos<16){
      this.halos++;r.ctx.save();r.ctx.globalCompositeOperation='lighter';
      this.sprite(r,row,frame,point.x,point.y,size*1.16,angle,.2);r.ctx.restore();
    }
    this.sprite(r,row,frame,point.x,point.y,size,angle,1);
    return true;
  }

  spark(r,x,y,color,alpha,size){
    if(this.sparks>=MAX_SPARKS)return;this.sparks++;
    const c=r.ctx,[px,py]=r.at(x,y),s=Math.max(r.dpr,size*r.zoom);
    c.save();c.globalAlpha=alpha;c.fillStyle=color;c.fillRect(Math.round(px-s/2),Math.round(py-s/2),Math.ceil(s),Math.ceil(s));c.restore();
  }

  aftermath(r,time){
    if(r.media.matches)return;
    for(const fade of this.fades){
      const age=Math.max(0,time-fade.since),fraction=age/fade.life;if(fraction>=1)continue;
      this.sprite(r,fade.row,5,fade.x,fade.y,24*(1-fraction*.45),fade.angle,(1-fraction)*.7);
      for(let n=0;n<3&&this.sparks<MAX_SPARKS;n++){
        const angle=fade.angle+Math.PI+(n-1)*.75,reach=(7+noise(fade.id+n)*18)*fraction;
        this.spark(r,fade.x+Math.cos(angle)*reach,fade.y+Math.sin(angle)*reach,colors[fade.row],(1-fraction)*.75,2);
      }
    }
  }
}
