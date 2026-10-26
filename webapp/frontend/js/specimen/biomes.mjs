import {WIDTH,HEIGHT,TILE,COLS,ROWS} from './world.mjs';
export function biomeBackground(ctx,r,texture){
  if(r.biome==='lab')return;
  for(let y=0;y<HEIGHT;y+=256)for(let x=0;x<WIDTH;x+=256)ctx.drawImage(texture,x,y,256,256);
  ctx.fillStyle=r.biome==='swamp'?'#192d2799':'#15162fbb';ctx.fillRect(0,0,WIDTH,HEIGHT);
  for(let i=0;i<7;i++){
    const x=60+i*108;ctx.strokeStyle=r.biome==='cavern'?'#303242':i%2?'#293e32':'#3b4c38';ctx.lineWidth=9+i%3*3;ctx.beginPath();ctx.moveTo(x,48);ctx.lineTo(x+24,190);ctx.lineTo(x-13,350);ctx.lineTo(x+34,HEIGHT-48);ctx.stroke();
    ctx.strokeStyle=r.biome==='cavern'?'#66627c':'#617154';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='#263d35';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x+10,224);ctx.lineTo(x-40,285);ctx.lineTo(x-70,450);ctx.stroke();
  }
  if(r.biome==='cavern'){
    for(const [x,y,w]of [[80,260,90],[390,520,140],[650,300,110]]){
      ctx.fillStyle='#222737';ctx.beginPath();ctx.moveTo(x-w/2,y+70);ctx.lineTo(x-w*.7,y+18);ctx.lineTo(x-w*.25,y-12);ctx.lineTo(x+w*.4,y+3);ctx.lineTo(x+w*.6,y+70);ctx.fill();
      ctx.strokeStyle='#77729b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-12,y+40);ctx.lineTo(x-8,y+9);ctx.lineTo(x+10,y-5);ctx.stroke();
      ctx.fillStyle='#aaa2c6';for(let i=0;i<5;i++)ctx.fillRect(x-16+i*7,y+10-i%3*6,3,2);
    }
  }else{
    for(let x=80;x<700;x+=53){
      ctx.strokeStyle='#718658';ctx.lineWidth=1;
      for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(x+i*3,670);ctx.lineTo(x-8+i*7,620-i%3*11);ctx.stroke();}
      ctx.fillStyle='#485f3d';for(let i=0;i<4;i++)ctx.fillRect(x-10+i*8,650-i%2*8,8,2);
    }
  }
  for(let i=0;i<32;i++){
    const x=62+(i*89)%640,y=85+(i*137)%540;ctx.fillStyle=r.biome==='cavern'?'#77739e':'#74936d';ctx.fillRect(x,y,2,2);
  }
  ctx.font='9px monospace';ctx.fillStyle='#9bbaa0';ctx.fillText(r.biome==='swamp'?'OUTER MARSH / 08':'ROOT COLLECTOR / 07',86,88);
}
export function biomeTerrain(ctx,r,texture){
  if(r.biome==='lab')return;
  const at=(x,y)=>x<0||x>=COLS||y<0||y>=ROWS?1:r.cells[y*COLS+x];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(at(x,y)){
    ctx.drawImage(texture,(x%10)*24,(y%10)*24,24,24,x*TILE,y*TILE,TILE,TILE);
    ctx.fillStyle='#101d24aa';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
    if(!at(x,y-1)){ctx.fillStyle='#6f8360';ctx.fillRect(x*TILE,y*TILE,24,3);ctx.fillStyle='#334e37';for(let i=0;i<24;i+=4)ctx.fillRect(x*TILE+i,y*TILE-3-(i%3),2,5);}
  }
}
export function structures(ctx,r,kit){
  for(const [x,top,bottom]of r.ladders){
    for(let y=top;y<bottom;y+=64){const h=Math.min(64,bottom-y);ctx.drawImage(kit,146,64,28,h,x-14,y,28,h);}
  }
  for(const a of r.stairs){
    ctx.strokeStyle='#263c3d';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(a.x,a.base+8);ctx.lineTo(a.x+a.count*a.run,a.base-a.count*a.rise+8);ctx.stroke();
    ctx.strokeStyle='#8a9681';ctx.lineWidth=1;ctx.stroke();
  }
  for(const t of r.treads){
    if(t.material==='wood'){ctx.fillStyle='#79684a';ctx.fillRect(t.x,t.y,t.w,t.h);ctx.fillStyle='#b09d70';ctx.fillRect(t.x,t.y,t.w,1);for(let x=t.x+6;x<t.x+t.w;x+=12){ctx.fillStyle='#343c32';ctx.fillRect(x,t.y+2,1,2);}}
    else ctx.drawImage(kit,0,154,64,12,t.x,t.y,t.w,t.h);
  }
}
export function waterIn(ctx,s,r,reduced){
  for(const a of r.water){
    ctx.fillStyle='#335b5c77';ctx.fillRect(a.x,a.y,a.w,a.h);
    ctx.fillStyle='#7ca79a88';const time=reduced?0:s.time;
    for(let i=0;i<a.w;i+=24)ctx.fillRect(Math.round(a.x+i+(time*5+i%7)%8),Math.round(a.y+Math.sin(time+i)*2),13,1);
  }
}
