// Selective top-down adaptations of Patch Pixelfx. See THIRD_PARTY_NOTICES.md.
const TAU=Math.PI*2;
const CRYSTAL=['#574766','#9163b5','#bc8bde','#e6c6fb'];
const GLASS=['#d989b6','#eab98f','#b7a5f0','#9bd3d4','#f0b7a6'];
const rand=(seed,index)=>((Math.imul((seed^Math.imul(index,0x9e3779b1))>>>0,0x85ebca6b)>>>8)/0x1000000);

export function groundSlam(c,radius,t){
  // Pixelfx's two decelerating fronts flattened into the plane of the arena.
  for(const delay of [0,.16]){
    const age=(t-delay)/(1-delay);
    if(age<0||age>=.8)continue;
    const reach=radius*(.13+.86*(1-(1-age)**3));
    c.globalAlpha=.79*(1-age/.8)**1.2;
    c.strokeStyle=delay?'#9b81a1':'#c7aecf';
    c.lineWidth=2+5*(1-age);
    c.beginPath();
    c.ellipse(0,0,reach,reach*.82,0,0,TAU);
    c.stroke();
  }
  const expansion=1-(1-t)**2;
  for(let i=0;i<14;i++){
    const angle=TAU*i/14,reach=radius*(.18+.68*expansion);
    const x=Math.round(Math.cos(angle)*reach),y=Math.round(Math.sin(angle)*reach*.8);
    const size=4+(i%4)*2+8*expansion;
    c.fillStyle=i%2?'#b79eae':'#83738b';
    c.globalAlpha=(1-t)*(.29+(i%3)*.09);
    c.fillRect(x-size,y-size,size*2,size);
    c.fillRect(x-size*.7,y-size*1.4,size*1.4,size*1.8);
  }
}

export function sporeBurst(c,radius,t,seed){
  const spread=1-(1-t)**2;
  for(let i=0;i<22;i++){
    const angle=TAU*rand(seed,i*3),distance=radius*(.40+.60*rand(seed,i*3+1))*spread;
    const rise=16+46*rand(seed,i*3+2);
    const x=Math.round(Math.cos(angle)*distance),y=Math.round(Math.sin(angle)*distance*.67-rise*Math.sin(t*Math.PI));
    const size=4+i%5;
    c.globalAlpha=Math.min(1,t*12)*(1-t)**1.25;
    c.fillStyle=i%3?'#b1cd74':'#d7de92';
    c.fillRect(x,y,size,size);
    if(i%3===0){
      c.globalAlpha*=.32;
      c.fillStyle='#86a85a';
      c.fillRect(x-size,y-size*2,size*3.5,size*3.5);
    }
  }
}

export function shatter(c,radius,t,seed,glass){
  const palette=glass?GLASS:CRYSTAL;
  for(let i=0;i<(glass?20:14);i++){
    const angle=TAU*rand(seed,i*3),speed=.38+.46*rand(seed,i*3+1);
    const floor=radius*speed*(1-(1-t)**2);
    const height=(glass?45:51)*Math.sin(Math.PI*t)*(1-t*.55);
    const size=(5+7*rand(seed,i*3+2))*(1-t*.38);
    const arm=glass?i%4:0,offset=glass?radius*(.28+(i%5)*.12):0;
    const x=Math.cos(arm*TAU/4)*offset+Math.cos(angle)*floor*(glass?.64:1);
    const y=Math.sin(arm*TAU/4)*offset+Math.sin(angle)*floor*.76*(glass?.64:1)-height;
    c.save();
    c.translate(Math.round(x),Math.round(y));
    c.rotate(angle+t*(i%2?4:-4));
    c.globalAlpha=Math.min(1,t*20)*(1-t)**.8;
    c.fillStyle=palette[i%palette.length];
    c.beginPath();c.moveTo(0,-size*1.5);c.lineTo(size,0);c.lineTo(-size*.55,size);c.closePath();c.fill();
    c.fillStyle=glass?'#f9debe':'#dfbdf8';
    c.fillRect(0,-size*.8,Math.max(1,size*.22),size*.88);
    c.restore();
  }
}

function flyPulse(t){
  // Quick rise, hold, slow fade and darkness between flashes (Pixelfx Fireflies).
  return t<.06?t/.06:t<.14?1:t<.4?1-(t-.14)/.26:0;
}

export function drawFireflies(r,props,time){
  if(r.media.matches)return;
  const {ctx:c,canvas,zoom:z}=r;
  const pixel=Math.max(1,Math.round(z*2));
  c.save();
  let visible=0;
  for(const prop of props){
    const seed=(prop.x|0)^Math.imul(prop.y|0,65537);
    if(rand(seed,1)<.32)continue;
    const period=3.2+rand(seed,2)*3;
    const phase=(time/period+rand(seed,3))%1;
    const drift=time*.82+rand(seed,4)*TAU;
    const [x,y]=r.at(prop.x+36*Math.sin(drift),prop.y-42+22*Math.sin(drift*.77+1));
    if(x<0||y<0||x>=canvas.width||y>=canvas.height)continue;
    if(++visible>16)break;
    const glow=flyPulse(phase);
    if(glow<.08)continue;
    c.globalAlpha=.13*glow;c.fillStyle='#849957';
    c.fillRect(x-pixel,y-pixel,pixel*3,pixel*3);
    c.globalAlpha=.65*glow;c.fillStyle='#c2c77c';
    c.fillRect(x,y,pixel,pixel);
  }
  c.restore();
}

export function drawCandle(r,entity,time,flames,frameSize,anchor,flip){
  const {ctx:c,zoom:z}=r;
  const size=entity.size,opacity=c.globalAlpha;
  const t=r.media.matches?0:Math.floor(time*12)/12;
  c.save();
  for(const [sx,sy] of flames){
    const [x,y]=r.at(entity.x+size*((flip?frameSize-sx:sx)/frameSize-.5),
      entity.y+size*(sy/frameSize-anchor));
    if(x<-8||y<-8||x>=r.canvas.width+8||y>=r.canvas.height+8)continue;
    const phase=entity.y*.031+sx;
    const sway=Math.sin(t*4.4+phase)*.62+Math.sin(t*8.1+phase)*.27;
    const height=(6+Math.sin(t*6.2+phase)*1.2)*z;
    const width=Math.max(1,Math.round(z*1.65));
    c.globalAlpha=opacity*(.16+sway*.045);
    c.fillStyle='#e18b41';c.fillRect(x-width*2,y-height,width*5,height+width);
    c.globalAlpha=opacity*.78;
    c.fillStyle='#ffae51';c.fillRect(Math.round(x+sway*z),Math.round(y-height),width,height);
    c.fillStyle='#ffe4a1';c.fillRect(x,Math.round(y-height*.6),width,height*.62);
  }
  c.restore();
}

export function chestLight(r,e,t){
  if(r.media.matches)return;
  const c=r.ctx,[x,y]=r.at(e.x,e.y),z=r.zoom;
  c.save();
  const count=e.mega?12:7,reach=e.mega?100:58;
  for(let i=0;i<count;i++){
    const angle=-Math.PI+.22+(Math.PI-.44)*i/(count-1);
    const distance=reach*(.25+t*.74);
    const px=Math.round(x+Math.cos(angle)*distance*z);
    const py=Math.round(y-29*z+Math.sin(angle)*distance*z);
    const size=Math.max(1,Math.round(z*(4-t*2)));
    c.globalAlpha=(1-t)**1.5;c.fillStyle=i%2?'#ffca71':'#f9e2a4';
    c.fillRect(px,py,size,size);
  }
  c.restore();
}
