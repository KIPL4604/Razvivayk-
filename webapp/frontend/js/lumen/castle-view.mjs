import {CASTLE,castleProps,castleGuidance,castleLayout} from './castle.mjs';

const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const propArt={piano:[0,248],bookshelf:[1,216],column:[2,216],candelabra:[3,146],flowerbed:[4,232]};
const hash=(x,y)=>((Math.imul(x,374761393)^Math.imul(y,668265263))>>>0);

// One presentation contract for the actor, camera and visual acceptance checks.
// Neither number changes a combat body or a simulation coordinate.
export const CASTLE_HALL_VISUAL=Object.freeze({heroSize:96,monarchSize:744});
const WALL=Object.freeze({bay:320,depth:160,rise:240,cap:12});

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
    const layout=framing.layout,bossY=arena?.y??layout?.hallY;
    const scale=Math.max(Math.min(baseScale,.46),Math.min(baseScale,widthScale));
    const halfView=width/scale/2;
    const cameraX=halfView>=CASTLE.halfWidth?0:clamp(player.x,-CASTLE.halfWidth+halfView,CASTLE.halfWidth-halfView);
    const corridor={x:cameraX,y:player.y,scale,screenY:height*.49};
    if(arena||layout?.doorBroken&&Number.isFinite(bossY)){
      // Sprite height is much larger than the monarch's collision circle. Fit
      // its crown and the hero into the actual clear space between both HUDs.
      const {monarchSize:size,heroSize}=CASTLE_HALL_VISUAL,anchor=framing.bossAnchor??.94,heroAnchor=framing.heroAnchor??.94;
      const top=framing.top??230,bottom=Math.max(top+100,framing.bottom??height-155);
      const minY=Math.min(bossY+7-size*anchor,player.y+7-heroSize*heroAnchor)-24;
      const maxY=Math.max(bossY+7+size*(1-anchor),player.y+7+heroSize*(1-heroAnchor))+24;
      const minX=Math.min(-size/2,player.x-heroSize/2),maxX=Math.max(size/2,player.x+heroSize/2);
      const fit=Math.min(baseScale,(width-24)/(maxX-minX),(bottom-top)/(maxY-minY));
      const scale=Math.max(Math.min(baseScale,.3),fit),mix=arena?1:clamp(layout.transition||0,0,1);
      const hall={x:(minX+maxX)/2,y:(minY+maxY)/2,scale,screenY:(top+bottom)/2};
      return Object.fromEntries(Object.keys(corridor).map(key=>[key,corridor[key]+(hall[key]-corridor[key])*mix]));
    }
    return corridor;
  }

  follow(state,target,width,height){
    const key=width+'x'+height,fresh=this.cameraRun!==state.runId||this.cameraTime===undefined||state.time<this.cameraTime||key!==this.cameraSize;
    if(fresh)this.viewCamera={...target};
    else{
      const dt=Math.max(0,Math.min(.1,state.time-this.cameraTime)),blend=1-Math.exp(-dt*7);
      for(const key of ['x','y','scale','screenY'])this.viewCamera[key]+=(target[key]-this.viewCamera[key])*blend;
    }
    this.cameraRun=state.runId;this.cameraTime=state.time;this.cameraSize=key;
    return this.viewCamera;
  }

  fill(r,name,x,y,w,h){
    const c=r.ctx,unit=r.zoom*2;
    c.save();c.setTransform(unit,0,0,unit,r.cx,r.cy);c.fillStyle=this.patterns[name]||'#3e2a20';
    c.fillRect(x/2,y/2,w/2,h/2);c.restore();
  }

  hallDecor(r,index,x,y,width,height=width,flip=false){
    const meta=r.art.manifest.castleHall?.decor,size=meta?.frameSize||256;
    if(!r.art.images['castle-hall-decor'])return;
    const columns=meta?.columns||6;
    r.blit('castle-hall-decor',(index%columns)*size,Math.floor(index/columns)*size,size,size,
      x,y,width,height,(meta?.anchor?.[1]??244)/size,flip);
  }

  sideWalls(r,half,minY,maxY,origin=0){
    if(maxY<=minY)return;
    const image=r.art.images['castle-hall-decor'];if(!image)return;
    const c=r.ctx,cell=r.art.manifest.castleHall?.decor?.frameSize||256;
    // This crop excludes the atlas gutter, keeping neighbouring bays flush.
    const sx=cell*4+8,sy=28,sw=cell-16,sh=216;
    const first=Math.floor((minY-origin)/WALL.bay),last=Math.ceil((maxY-origin)/WALL.bay);
    for(const side of [-1,1])for(let bay=first;bay<last;bay++){
      const y0=origin+bay*WALL.bay,start=Math.max(minY,y0),end=Math.min(maxY,y0+WALL.bay);
      if(end<=start)continue;
      const u0=(start-y0)/WALL.bay,u1=(end-y0)/WALL.bay;
      const inner=side*half,outer=side*(half+WALL.depth);
      const [tx,ty]=r.at(outer,start-WALL.rise),[bx,by]=r.at(inner,start);
      const span=(end-start)*r.zoom,sourceWidth=(u1-u0)*sw;
      c.save();
      // Horizontal texture axis follows the length of the wall; its vertical
      // axis follows actual wall height. Both sides use mirrored 3D planes.
      c.setTransform(0,span/sourceWidth,(bx-tx)/sh,(by-ty)/sh,tx,ty);
      c.drawImage(image,sx+u0*sw,sy,sourceWidth,sh,0,0,sourceWidth,sh);
      const shade=c.createLinearGradient(0,0,0,sh);
      shade.addColorStop(0,'#080b1010');shade.addColorStop(1,'#080b1055');
      c.fillStyle=shade;c.fillRect(0,0,sourceWidth,sh);c.restore();
      const [ex,ey]=r.at(outer,end-WALL.rise),[cx,cy]=r.at(outer+side*WALL.cap,start-WALL.rise-10);
      c.save();c.beginPath();c.moveTo(tx,ty);c.lineTo(ex,ey);c.lineTo(ex+cx-tx,ey+cy-ty);c.lineTo(cx,cy);c.closePath();
      c.fillStyle='#46321f';c.fill();c.strokeStyle='#a77a37';c.lineWidth=Math.max(r.dpr,2*r.zoom);c.stroke();
      const [fx,fy]=r.at(inner,end);
      c.beginPath();c.moveTo(bx,by);c.lineTo(fx,fy);c.strokeStyle='#171013';c.lineWidth=Math.max(2*r.dpr,7*r.zoom);c.stroke();
      c.beginPath();c.moveTo(bx-side*3*r.zoom,by-3*r.zoom);c.lineTo(fx-side*3*r.zoom,fy-3*r.zoom);
      c.strokeStyle='#9c6d30';c.lineWidth=Math.max(r.dpr,2*r.zoom);c.stroke();c.restore();
    }
  }

  hallBackdrop(r,layout){
    const top=layout.hallY-CASTLE.hallHalfHeight,width=CASTLE.hallHalfWidth*2;
    const image=r.art.images['castle-hall-floor'];
    if(image)r.blit('castle-hall-floor',0,0,image.width,image.height,0,layout.doorY,width,CASTLE.hallHalfHeight*2,1);
    else this.fill(r,'carpet',-CASTLE.hallHalfWidth,top,width,CASTLE.hallHalfHeight*2);
    // A single tall architectural composition: wide rear niche, paired crests,
    // statues and four pilasters. The floor remains one broad carpeted space.
    this.hallDecor(r,5,0,top+96,520,420);
    for(const side of [-1,1]){
      this.hallDecor(r,4,side*505,top+96,490,420,side===1);
      this.hallDecor(r,1,side*430,top+128,182,308);
      this.hallDecor(r,2,side*575,top+152,190,256,side===1);
      this.hallDecor(r,0,side*710,top+170,214,410,side===1);
      this.hallDecor(r,0,side*235,top+118,150,320,side===1);
      // The entrance shoulders are large walnut bays rather than a tile grid.
      this.hallDecor(r,4,side*(CASTLE.halfWidth+180),layout.doorY+52,360,230,side===1);
    }
    this.sideWalls(r,CASTLE.hallHalfWidth,top+96,layout.doorY,top+96);
  }

  ground(r,player,state){
    const c=r.ctx,layout=castleLayout(state),half=CASTLE.halfWidth,carpet=CASTLE.carpetHalfWidth;
    const top=r.camera.y-r.height/r.scale/2-320,bottom=r.camera.y+r.height/r.scale/2+320;
    const hall=Number.isFinite(layout?.doorY)&&Number.isFinite(layout?.hallY),hallTop=hall?layout.hallY-CASTLE.hallHalfHeight:0,hallBottom=hall?layout.doorY:0;
    const inHall=y=>hall&&y>=hallTop&&y<hallBottom;
    c.fillStyle='#100e10';c.fillRect(0,0,r.canvas.width,r.canvas.height);
    this.fill(r,'wood',-half-120,top,half*2+240,bottom-top);
    this.fill(r,'parquet',-half,top,half*2,bottom-top);
    this.fill(r,'carpet',-carpet,top,carpet*2,bottom-top);
    // The opaque hall floor/entrance shoulders occlude gallery wall tops that
    // project behind the doorway; they cannot become wings inside the room.
    this.sideWalls(r,half,hall?Math.max(top,hallBottom):top,bottom);
    if(hall){
      const start=Math.max(top,hallTop),end=Math.min(bottom,hallBottom);
      if(end>start)this.fill(r,'wood',-CASTLE.hallHalfWidth-120,start,CASTLE.hallHalfWidth*2+240,end-start);
      const [,endY]=r.at(0,hallTop);if(endY>0){c.fillStyle='#100e10';c.fillRect(0,0,r.canvas.width,Math.min(r.canvas.height,endY));}
      if(bottom>hallTop-420&&top<hallBottom+240)this.hallBackdrop(r,layout);
    }
    // Border cells repeat without stretching the embroidery or floor motif.
    for(let y=Math.floor(top/64)*64;y<=bottom;y+=64){
      if(hall&&y<hallBottom)continue;
      const width=carpet;
      r.blit('castle-tiles',4*32,0,32,32,-width+28,y+64,56,64,1);
      r.blit('castle-tiles',5*32,0,32,32,width-28,y+64,56,64,1);
    }
    const props=castleProps(top,bottom,state).map(p=>inHall(p.y)?
      {...p,kind:'castle-hall-prop',index:p.kind==='column'?0:3,size:p.kind==='column'?350:190}:
      {...p,kind:'castle-prop',propKind:p.kind,index:propArt[p.kind]?.[0]??3,size:propArt[p.kind]?.[1]??146});
    if(hall&&layout.doorBroken)props.push({kind:'castle-open-door',x:0,y:layout.doorY});
    if(r.arena&&['forming','fighting'].includes(r.arena.phase)){
      const y=layout.doorY,[x,py]=r.at(-half,y),[right]=r.at(half,y);
      c.save();c.fillStyle='#211013';c.fillRect(x,py-10*r.zoom,right-x,20*r.zoom);
      c.strokeStyle='#d4a356';c.lineWidth=Math.max(r.dpr,3*r.zoom);c.beginPath();c.moveTo(x,py);c.lineTo(right,py);c.stroke();
      for(let px=-half+24;px<half;px+=48){
        const [bx,by]=r.at(px,y);c.fillStyle='#b48745';c.fillRect(bx-2*r.zoom,by-24*r.zoom,4*r.zoom,48*r.zoom);
      }
      c.restore();
    }
    return props;
  }

  door(r,entity,state){
    const image=r.art.images['castle-door'];if(!image)return;
    const layout=castleLayout(state),opened=entity.kind==='castle-open-door'||layout.doorBroken;
    const ratio=entity.maxHp?Math.max(0,entity.hp/entity.maxHp):1;
    const frame=opened?Math.min(5,3+Math.floor((layout.doorTime||0)/.4)):ratio>.65?0:ratio>.3?1:2;
    const anchor=(r.art.manifest.castleDoor?.anchor?.[1]??244)/256;
    r.blit('castle-door',frame*256,0,256,256,0,entity.y,CASTLE.halfWidth*2,300,anchor);
    if(!opened){
      const c=r.ctx,[x,rawY]=r.at(0,entity.y-300),y=Math.max(rawY,((r.castleInsets?.top||190)+20)*r.dpr),w=Math.min(r.width-48,240)*r.dpr,h=6*r.dpr;
      c.save();c.fillStyle='#241818';c.fillRect(x-w/2-2*r.dpr,y-2*r.dpr,w+4*r.dpr,h+4*r.dpr);c.fillStyle='#c9a45d';c.fillRect(x-w/2,y,w*ratio,h);
      c.font=`${12*r.dpr}px LumenSquare,monospace`;c.textAlign='center';c.fillStyle='#f1d79a';
      const text='ВОРОТА · '+Math.ceil(entity.hp)+' / '+entity.maxHp;
      c.strokeStyle='#1d1113';c.lineWidth=3*r.dpr;c.strokeText(text,x,y-8*r.dpr);c.fillText(text,x,y-8*r.dpr);c.restore();
    }
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

  hallProp(r,entity,player,time){
    const c=r.ctx;
    c.save();
    if(entity.index===3){
      const pulse=r.media.matches?1:.96+Math.sin(time*2.5+entity.y*.017)*.04;
      const [x,y]=r.at(entity.x,entity.y-entity.size*.61),radius=100*r.zoom;
      const glow=c.createRadialGradient(x,y,0,x,y,radius);
      glow.addColorStop(0,'#ffbf632b');glow.addColorStop(1,'#ffad5000');
      c.globalAlpha=pulse;c.fillStyle=glow;c.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
    c.globalAlpha=entity.y>player.y&&Math.hypot(entity.x-player.x,entity.y-player.y)<150?.62:1;
    this.hallDecor(r,entity.index,entity.x,entity.y,entity.size,entity.size,entity.x>0);
    c.restore();
  }

  monarchLight(r,x,y,time){
    const c=r.ctx,[px,py]=r.at(x,y+7-CASTLE_HALL_VISUAL.monarchSize*.59),radius=128*r.zoom;
    const glow=c.createRadialGradient(px,py,0,px,py,radius);
    glow.addColorStop(0,'#ffd58a20');glow.addColorStop(.35,'#e6923510');glow.addColorStop(1,'#b04a1700');
    c.save();c.globalAlpha=r.media.matches?1:.96+Math.sin(time*2)*.04;
    c.fillStyle=glow;c.fillRect(px-radius,py-radius,radius*2,radius*2);c.restore();
  }

  guide(r,state){
    const target=castleGuidance(state);if(!target)return;
    const layout=castleLayout(state);
    // At the closed door its visible frame and health bar take over guidance.
    if(!layout.doorBroken&&Math.hypot(state.player.x,state.player.y-target.y)<190)return;
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
