import {CASTLE,castleProps,castleGuidance} from './castle.mjs';

const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const propArt={piano:[0,248],bookshelf:[1,216],column:[2,216],candelabra:[3,146],flowerbed:[4,232]};
const hash=(x,y)=>((Math.imul(x,374761393)^Math.imul(y,668265263))>>>0);

/** Castle-only view data. No random calls, state writes, collision bodies or save data. */
export class CastleView{
  constructor(renderer){
    this.patterns={};
    const image=renderer.art.images['castle-tiles'];
    if(!image)return;
    for(const [name,start] of [['parquet',0],['carpet',2],['wood',7]]){
      const detailed=name!=='wood'&&renderer.art.images['castle-floor'];
      const size=detailed?128:32,count=detailed?4:8,source=detailed||image;
      const tile=document.createElement('canvas');tile.width=size*count;tile.height=size*count;
      const c=tile.getContext('2d');c.imageSmoothingEnabled=false;
      for(let y=0;y<count;y++)for(let x=0;x<count;x++){
        const index=start===7?7:start+Number(hash(x,y)%5===0);
        c.drawImage(source,index*size,0,size,size,x*size,y*size,size,size);
      }
      this.patterns[name]=renderer.ctx.createPattern(tile,'repeat');
    }
  }

  camera(width,height,baseScale,player,arena,framing={}){
    // Mobile follows the hero through the wider gallery instead of reducing it
    // to a miniature. Desktop can show both wall rows at the normal actor scale.
    const widthScale=width/(CASTLE.halfWidth*2+176);
    if(arena){
      // Sprite height is much larger than the monarch's collision circle. Fit
      // its crown and the hero into the actual clear space between both HUDs.
      const size=620,anchor=framing.bossAnchor??.94,heroAnchor=framing.heroAnchor??.94;
      const top=framing.top??230,bottom=Math.max(top+100,framing.bottom??height-155);
      const minY=Math.min(CASTLE.bossY+7-size*anchor,player.y+7-96*heroAnchor)-24;
      const maxY=Math.max(CASTLE.bossY+7+size*(1-anchor),player.y+7+96*(1-heroAnchor))+24;
      const minX=Math.min(-size/2,player.x-48),maxX=Math.max(size/2,player.x+48);
      const fit=Math.min(baseScale,(width-24)/(maxX-minX),(bottom-top)/(maxY-minY));
      const scale=Math.max(Math.min(baseScale,.3),fit);
      return {x:(minX+maxX)/2,y:(minY+maxY)/2,scale,screenY:(top+bottom)/2};
    }
    const scale=Math.max(Math.min(baseScale,.52),Math.min(baseScale,widthScale));
    const halfView=width/scale/2;
    const cameraX=halfView>=CASTLE.halfWidth?0:clamp(player.x,-CASTLE.halfWidth+halfView,CASTLE.halfWidth-halfView);
    return {x:cameraX,y:player.y,scale};
  }

  fill(r,name,x,y,w,h){
    const c=r.ctx,unit=r.zoom*2;
    c.save();c.setTransform(unit,0,0,unit,r.cx,r.cy);c.fillStyle=this.patterns[name]||'#3e2a20';
    c.fillRect(x/2,y/2,w/2,h/2);c.restore();
  }

  ground(r,player){
    const c=r.ctx,half=CASTLE.halfWidth,carpet=CASTLE.carpetHalfWidth;
    const top=r.camera.y-r.height/r.scale/2-320,bottom=r.camera.y+r.height/r.scale/2+320;
    c.fillStyle='#100e10';c.fillRect(0,0,r.canvas.width,r.canvas.height);
    this.fill(r,'wood',-half-120,top,half*2+240,bottom-top);
    this.fill(r,'parquet',-half,top,half*2,bottom-top);
    this.fill(r,'carpet',-carpet,top,carpet*2,bottom-top);
    // Border cells repeat without stretching the embroidery or floor motif.
    for(let y=Math.floor(top/64)*64;y<=bottom;y+=64){
      r.blit('castle-tiles',4*32,0,32,32,-carpet+28,y+64,56,64,1);
      r.blit('castle-tiles',5*32,0,32,32,carpet-28,y+64,56,64,1);
    }
    const [lx]=r.at(-half,0),[rx]=r.at(half,0);
    c.fillStyle='#0e0b0c';c.fillRect(lx-20*r.zoom,0,20*r.zoom,r.canvas.height);c.fillRect(rx,0,20*r.zoom,r.canvas.height);
    // The upright wall section is repeated along the same 50m module as its props.
    for(let y=Math.floor(top/128)*128;y<=bottom;y+=128){
      r.blit('castle-props',5*128,0,128,128,-half-28,y+110,152,152,.94);
      r.blit('castle-props',5*128,0,128,128,half+28,y+110,152,152,.94,true);
    }
    c.fillStyle='#bd8a42';
    c.fillRect(lx,0,Math.max(r.dpr,2*r.zoom),r.canvas.height);
    c.fillRect(rx-Math.max(r.dpr,2*r.zoom),0,Math.max(r.dpr,2*r.zoom),r.canvas.height);
    if(top<CASTLE.bossY-CASTLE.hallHalfHeight+220&&bottom>CASTLE.bossY-CASTLE.hallHalfHeight){
      const wallY=CASTLE.bossY-CASTLE.hallHalfHeight;
      for(let x=-half+64;x<half;x+=128)r.blit('castle-props',5*128,0,128,128,x,wallY+56,142,142,.94);
    }
    const props=castleProps(top,bottom).map(p=>({...p,kind:'castle-prop',propKind:p.kind,index:propArt[p.kind]?.[0]??3,size:propArt[p.kind]?.[1]??146}));
    if(r.arena&&['forming','fighting'].includes(r.arena.phase)){
      const y=CASTLE.gateY,[x,py]=r.at(-half,y),[right]=r.at(half,y);
      c.save();c.fillStyle='#211013';c.fillRect(x,py-10*r.zoom,right-x,20*r.zoom);
      c.strokeStyle='#d4a356';c.lineWidth=Math.max(r.dpr,3*r.zoom);c.beginPath();c.moveTo(x,py);c.lineTo(right,py);c.stroke();
      for(let px=-half+24;px<half;px+=48){
        const [bx,by]=r.at(px,y);c.fillStyle='#b48745';c.fillRect(bx-2*r.zoom,by-24*r.zoom,4*r.zoom,48*r.zoom);
      }
      c.restore();
    }
    return props;
  }

  prop(r,entity,player,time){
    const [index,size]=propArt[entity.propKind]||[entity.index,entity.size];
    const c=r.ctx;
    c.save();
    // Candles retain a quiet warm halo; reduced motion preserves a fixed light.
    if(entity.propKind==='column'||entity.propKind==='candelabra'){
      const pulse=r.media.matches?1:.92+Math.sin(time*3+entity.y*.017)*.08;
      const [x,y]=r.at(entity.x,entity.y-size*.6),radius=105*r.zoom;
      const glow=c.createRadialGradient(x,y,0,x,y,radius);
      glow.addColorStop(0,'#ffc77830');glow.addColorStop(1,'#ffc77800');
      c.globalAlpha=pulse;c.fillStyle=glow;c.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
    const near=Math.hypot(entity.x-player.x,entity.y-player.y);
    c.globalAlpha=entity.y>player.y&&near<130?.65:1;
    r.blit('castle-props',index*128,0,128,128,entity.x,entity.y,size,size,.94,entity.x>0&&entity.propKind==='column');
    c.restore();
  }

  guide(r,state){
    const target=castleGuidance(state);if(!target)return;
    const c=r.ctx,d=r.dpr,hasBoss=state.enemies.some(e=>e.kind==='guardian');
    const center={x:r.canvas.width/2,y:r.canvas.height*.52};
    const [tx,ty]=r.at(target.x??target.targetX??0,target.y??target.targetY??CASTLE.bossY);
    const dx=tx-center.x,dy=ty-center.y,angle=Math.atan2(dy,dx);
    const safe={left:32*d,right:r.canvas.width-32*d,top:Math.max(hasBoss?250:172,(r.castleInsets?.top||0)+24)*d,bottom:r.canvas.height-170*d};
    safe.bottom=Math.max(safe.top+48*d,safe.bottom);
    let travel=1;
    if(dx>0)travel=Math.min(travel,(safe.right-center.x)/dx);
    if(dx<0)travel=Math.min(travel,(safe.left-center.x)/dx);
    if(dy>0)travel=Math.min(travel,(safe.bottom-center.y)/dy);
    if(dy<0)travel=Math.min(travel,(safe.top-center.y)/dy);
    const x=clamp(center.x+dx*travel,safe.left,safe.right),y=clamp(center.y+dy*travel,safe.top,safe.bottom);
    const size=19*d;
    c.save();c.translate(Math.round(x),Math.round(y));c.rotate(angle+Math.PI/2);
    c.beginPath();c.moveTo(0,-size);c.lineTo(size*.85,size*.2);c.lineTo(size*.85,size*.7);c.lineTo(0,0);c.lineTo(-size*.85,size*.7);c.lineTo(-size*.85,size*.2);c.closePath();
    c.strokeStyle='#29190e';c.lineWidth=5*d;c.stroke();c.fillStyle='#f0bf62';c.fill();
    c.strokeStyle='#ffe3a0';c.lineWidth=d;c.stroke();c.restore();
    c.save();c.font=`${13*d}px LumenSquare,monospace`;c.textAlign='center';c.textBaseline='top';
    c.strokeStyle='#171014';c.lineWidth=4*d;c.strokeText('45',x,y+20*d);c.fillStyle='#f4d58f';c.fillText('45',x,y+20*d);c.restore();
  }
}
