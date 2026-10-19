// Preserved presentation for keeper and later enemies pending art approval.
const TAU = Math.PI * 2;
function circle(c,x,y,r,fill,stroke) {c.beginPath();c.arc(x,y,r,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function ellipse(c,x,y,rx,ry,fill) {c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();}
function line(c,points,color,width=1) {c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function poly(c,points,fill,stroke) {c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}}
function glow(c,x,y,r,color) {const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');circle(c,x,y,r,g);}
function plant(c,x,y,size,flip=1) {
  c.save();c.translate(x,y);c.scale(size*flip,size);
  for(let i=0;i<5;i++){const a=-2.7+i*.58;c.save();c.rotate(a);poly(c,[[0,0],[12,-6],[28,0],[12,6]],i%2?'#466D5D':'#2F574A');line(c,[[0,0],[25,0]],'#6D9270');c.restore();}
  c.restore();
}
function hero(c,x,y,t,character='scout',invulnerable=0,moving=false) {
  c.save();c.translate(x,y);const bob=moving?Math.sin(t*14)*1.5:Math.sin(t*2)*.7;
  ellipse(c,0,15,15,6,'#061B2490');
  if(invulnerable>0)circle(c,0,0,26,null,'#BDF8DF99');
  c.translate(0,bob);
  const cloak=character==='keeper'?'#C8875B':'#438E8B';
  poly(c,[[-10,-3],[8,-4],[16,21],[1,18],[-13,21]],cloak,'#192E35');
  line(c,[[-7,3],[-6,15]],'#81ADA1',2);
  ellipse(c,-5,17,4,3,'#13272E');ellipse(c,6,17,4,3,'#13272E');
  ellipse(c,0,0,11,14,'#E1D8B7');
  poly(c,[[-10,-1],[-8,-13],[0,-19],[10,-10],[12,-1]],'#EEE5CF','#A5B8A9');
  ellipse(c,0,0,8,7,'#253E40');line(c,[[-4,-1],[4,-1]],'#AAEDD5',3);
  c.fillStyle='#B57C56';c.fillRect(-11,7,22,4);circle(c,0,8,3,'#EDD5A6');
  line(c,[[12,-5],[17,17]],'#D4B57B',3);circle(c,13,-7,5,'#94F5D4');
  circle(c,13,-7,2,'#E9FFF1');
  c.restore();
}
function enemySprite(kind) {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d');c.translate(64,64);c.scale(1.65,1.65);
  if(kind==='guardian'){
    ellipse(c,0,22,28,9,'#061B24A0');
    for(let i=0;i<6;i++){const a=i*TAU/6;c.save();c.rotate(a);poly(c,[[10,-7],[29,-11],[32,4],[14,9]],'#647B6F','#A1A18A');c.restore();}
    circle(c,0,0,24,'#A2A48B','#D0C7A8');circle(c,0,0,18,'#244E4C','#D0AB70');
    poly(c,[[0,-15],[11,0],[0,15],[-11,0]],'#E9AB68');circle(c,0,0,5,'#FFF2B5');
    for(let i=0;i<4;i++){const a=i*TAU/4+.4;circle(c,Math.cos(a)*20,Math.sin(a)*20,3,'#E3C282');}
  }else if(kind==='wasp'){
    ellipse(c,0,15,15,5,'#061B2480');ellipse(c,-12,-3,13,7,'#BBBCD37A');ellipse(c,12,-3,13,7,'#BBBCD37A');
    line(c,[[-21,-3],[-5,2],[21,-3]],'#CBD4DD',1);ellipse(c,0,3,8,12,'#8B83A8');
    poly(c,[[-7,-4],[0,-12],[7,-4],[0,4]],'#E1C6BD');circle(c,0,-4,3,'#F6B7A9');
    line(c,[[0,11],[0,20]],'#C9B8C9',2);
  }else if(kind==='beetle'){
    ellipse(c,0,14,17,6,'#061B2490');
    for(let i=0;i<3;i++){line(c,[[-7,-7+i*7],[-18,-12+i*10],[-22,-7+i*10]],'#A17C5E',2);line(c,[[7,-7+i*7],[18,-12+i*10],[22,-7+i*10]],'#A17C5E',2);}
    ellipse(c,0,0,14,17,'#B5A17D');ellipse(c,0,-2,11,13,'#D8C8A1');line(c,[[0,-14],[0,12]],'#6E7964',2);
    circle(c,0,-16,7,'#3A594D');circle(c,-3,-18,2,'#F4D482');circle(c,3,-18,2,'#F4D482');
  }else{
    ellipse(c,0,12,10,4,'#061B2470');poly(c,[[0,-15],[11,-2],[8,10],[-8,10],[-11,-2]],'#B57153','#E3B382');
    poly(c,[[0,-9],[6,-2],[0,5],[-6,-2]],'#F3C37C');circle(c,0,-1,3,'#FFF3C1');
    line(c,[[-6,8],[-10,14]],'#C5976E',2);line(c,[[6,8],[10,14]],'#C5976E',2);
  }
  return canvas;
}

export {hero, enemySprite};
