import {PROP_TYPES,propBounds,isScientist} from './props.mjs';
import {ECHO} from './tuning.mjs';
export function drawLabProp(ctx,o,kit){
  const type=PROP_TYPES[o.kind];if(!type)return false;
  const b=propBounds(o);
  if(o.broken){
    ctx.fillStyle=type.material==='wood'?'#806442':'#41524e';
    for(let i=0;i<4;i++)ctx.fillRect(Math.round(b.x+i*b.w/4),Math.round(b.y+b.h-3-i%2),5,2);
    return true;
  }
  const sx=type.slot%4*64+(64-type.w)/2,sy=Math.floor(type.slot/4)*64+(64-type.h)/2;
  ctx.drawImage(kit,sx,sy,type.w,type.h,Math.round(b.x),Math.round(b.y),b.w,b.h);
  if(o.hp<type.hp){
    ctx.strokeStyle='#201c24';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(b.x+3,b.y+3);ctx.lineTo(b.x+b.w*.55,b.y+b.h*.5);ctx.lineTo(b.x+b.w*.35,b.y+b.h-3);ctx.stroke();
  }
  return true;
}
export function drawStaff(ctx,s,e,sheet,reduced){
  if(e.pose){
    const p=e.pose,coat=isScientist(e)?'#aebbb5':'#677867',shadow='#25383c',skin='#baac8c';
    const bone=(i,j,w,color)=>{ctx.strokeStyle=shadow;ctx.lineWidth=w+2;ctx.beginPath();ctx.moveTo(Math.round(p[i].x),Math.round(p[i].y));ctx.lineTo(Math.round(p[j].x),Math.round(p[j].y));ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke();};
    ctx.save();ctx.globalAlpha=1-(s.grab?.id===e.id?s.grab.absorb||0:0)*.85;
    for(const [i,j]of [[2,3],[3,4],[2,5],[5,6]])bone(i,j,5,'#3b565b');
    bone(1,2,15,coat);bone(1,7,5,coat);bone(1,8,5,coat);
    for(const i of [7,8]){ctx.fillStyle=skin;ctx.fillRect(Math.round(p[i].x)-2,Math.round(p[i].y)-2,4,4);}
    ctx.save();ctx.translate(Math.round(p[0].x),Math.round(p[0].y));ctx.rotate(-Math.atan2(p[1].x-p[0].x,p[1].y-p[0].y));
    ctx.fillStyle=shadow;ctx.fillRect(-5,-7,10,14);ctx.fillStyle=skin;ctx.fillRect(-4,-5,8,10);ctx.fillStyle=isScientist(e)?'#89958f':'#73826c';ctx.fillRect(-6,-8,12,4);ctx.restore();ctx.restore();return;
  }
  const science=isScientist(e),panic=e.behavior==='flee',walking=e.walking;
  let row=science?0:7;
  if(e.climbing)row=science?5:10;
  else if(e.stumble>0)row=6;
  else if(panic)row=science?2:9;
  else if(science&&e.activity==='computer')row=3;
  else if(science&&e.activity==='sample')row=4;
  else if(!science&&(e.windup>.05||e.fireTime>0))row=8;
  else if(science&&walking)row=1;
  const animated=e.climbing||walking||[3,4,8].includes(row);
  const phase=e.climbing?e.climbPhase||0:s.time*(panic?12:row===3?5:8)+e.senseSlot;
  const frame=animated&&!reduced?Math.floor(phase)%8:0;
  ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y+26));ctx.scale(e.dir<0?-1:1,1);
  ctx.drawImage(sheet,frame*64,row*64,64,64,-32,-58,64,64);
  if(e.kind==='flamer'){ctx.fillStyle='#6d795e';ctx.fillRect(-12,-34,7,17);ctx.fillStyle='#b6aa6e';ctx.fillRect(-11,-32,2,13);}
  ctx.restore();
}
export function drawEcho(ctx,s,reduced){
  if(!s.echoTime||s.echoOrigin?.room!==s.room)return;
  const progress=1-s.echoTime/ECHO.duration,r=ECHO.radius*(reduced?1:Math.min(1,(ECHO.duration-s.echoTime)/ECHO.waveTime));
  ctx.save();ctx.strokeStyle='#95c8b1';ctx.lineWidth=1;ctx.globalAlpha=.45*(1-progress);ctx.setLineDash([4,5]);
  ctx.beginPath();ctx.arc(s.echoOrigin.x,s.echoOrigin.y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  for(const t of s.echoTargets){
    if(!reduced&&t.d>r)continue;
    const live=s.rooms[s.room].enemies.find(e=>e.id===t.id);if(!live||live.eaten)continue;
    ctx.lineWidth=1.5;ctx.globalAlpha=Math.min(.95,s.echoTime*3);ctx.strokeRect(Math.round(live.x)-10,Math.round(live.y)-23,20,40);
    ctx.fillStyle='#b4ddba';ctx.fillRect(Math.round(live.x)-2,Math.round(live.y)-29,4,3);
  }
  ctx.restore();
}
