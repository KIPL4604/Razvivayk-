import {bossCast,glassCrossHalfWidth} from './bosses.mjs';
import {groundSlam,shatter,sporeBurst} from './biome-vfx.mjs';

const TAU=Math.PI*2;
const thornLayout=[
  [-.61,-.30,32,-.6],[-.18,-.61,50,.2],[.41,-.49,37,.6],[.69,-.17,41,.8],
  [-.42,.06,53,-.45],[.13,-.08,65,.25],[.48,.20,50,.7],[-.63,.34,40,-.85],
  [-.19,.41,57,-.3],[.24,.61,41,.5],[-.41,.65,30,-.6],
];

function polygon(c,color,points){
  c.fillStyle=color;
  c.beginPath();
  c.moveTo(...points[0]);
  for(const point of points.slice(1))c.lineTo(...point);
  c.closePath();
  c.fill();
}

function circle(c,radius,fill,edge){
  c.beginPath();
  c.arc(0,0,radius,0,TAU);
  c.fillStyle=fill;
  c.fill();
  c.strokeStyle=edge;
  c.lineWidth=2;
  c.stroke();
}

function anchor(r,x,y){
  const c=r.ctx;
  c.save();
  c.translate(...r.at(x,y));
  c.scale(r.zoom,r.zoom);
  return c;
}

function thorn(c,x,y,height,lean,lit){
  c.save();
  c.translate(x,y);
  c.transform(1,0,-lean,1,0,0);
  c.scale(height/50,height/50);
  polygon(c,'#261f25',[[-12,1],[-8,-14],[-14,-24],[-6,-20],[-4,-33],[1,-49],[6,-35],[7,-23],[16,-31],[14,-18],[8,-11],[13,1]]);
  polygon(c,lit?'#db513d':'#6f5a39',[[-9,-1],[-3,-17],[-6,-26],[-1,-25],[1,-43],[5,-31],[4,-17],[11,-24],[9,-15],[4,-9],[8,0]]);
  polygon(c,lit?'#ff9b61':'#9c7347',[[1,-43],[3,-31],[1,-20],[-3,-12],[-2,-22]]);
  c.restore();
}

function stone(c,size,angle){
  c.save();
  c.rotate(angle);
  c.scale(size/30,size/30);
  polygon(c,'#24222e',[[-28,-6],[-19,-23],[2,-29],[21,-20],[30,-5],[24,16],[10,26],[-13,24],[-26,12]]);
  polygon(c,'#58536b',[[-23,-5],[-15,-21],[2,-25],[16,-18],[22,-6],[11,7],[-10,12],[-22,6]]);
  polygon(c,'#a69bb1',[[-15,-20],[2,-25],[13,-17],[2,-13],[-12,-12],[-21,-4]]);
  polygon(c,'#776682',[[5,-11],[19,-17],[25,-7],[21,4],[12,8],[4,4]]);
  polygon(c,'#d6b9e7',[[-12,-12],[-3,-13],[1,-4],[12,-2],[8,1],[-2,0],[-7,-7]]);
  polygon(c,'#413b52',[[-10,12],[11,7],[21,4],[25,12],[9,22],[-13,20]]);
  c.restore();
}

function cross(c,radius,fill,edge){
  const w=glassCrossHalfWidth(radius);
  polygon(c,fill,[[-w,-radius],[w,-radius],[w,-w],[radius,-w],[radius,w],[w,w],
    [w,radius],[-w,radius],[-w,w],[-radius,w],[-radius,-w],[-w,-w]]);
  c.strokeStyle=edge;
  c.lineWidth=2;
  c.stroke();
}

function glass(c,x,y,height){
  polygon(c,'#5d3449',[[x-13,y],[x-9,y-height*.57],[x+2,y-height],[x+13,y-height*.49],[x+9,y]]);
  polygon(c,'#e98589',[[x-10,y],[x+2,y-height],[x+5,y-height*.54],[x,y]]);
  polygon(c,'#ffdf9d',[[x+2,y-height],[x+10,y-height*.49],[x+4,y-height*.37],[x-2,y-height*.57]]);
  polygon(c,'#a84d64',[[x+5,y-height*.54],[x+10,y-height*.49],[x+8,y-2],[x,y]]);
}

export function drawBossAim(r,enemy){
  const target=enemy.castTarget;
  if(!target)return;
  const {kind,radius,windup,flight}=bossCast(enemy);
  const progress=1-enemy.actionTimer/windup;
  const c=anchor(r,target.x,target.y);
  if(kind==='brambles'){
    circle(c,radius,'#a3303d54','#ff7165');
    polygon(c,'#381f2d',[[-21,3],[-12,-10],[12,-10],[21,3],[15,10],[-16,10]]);
    thorn(c,-8,2,19+progress*10,-.7,true);
    thorn(c,10,2,22+progress*13,.65,true);
    thorn(c,0,5,32+progress*16,.05,true);
    thorn(c,-radius*.48,16,19+progress*9,-.65,true);
    thorn(c,radius*.47,19,21+progress*10,.6,true);
    thorn(c,0,radius*.54,16+progress*8,.1,true);
    c.fillStyle='#ffb085';
    for(let i=0;i<8;i++){
      const angle=i*TAU/8;
      const x=Math.cos(angle)*(radius-5),y=Math.sin(angle)*(radius-5);
      c.fillRect(x-3,y-3,6,6);
    }
  }else if(kind==='boulder'){
    circle(c,radius,'#533b6575','#dcabf0');
    const size=10+31*Math.max(0,1-enemy.actionTimer/flight);
    c.fillStyle='#251b34bd';
    c.beginPath();
    c.ellipse(0,0,size,size*.48,0,0,TAU);
    c.fill();
    polygon(c,'#e1b6ec',[[0,-17],[10,0],[0,17],[-10,0]]);
    polygon(c,'#442e55',[[0,-10],[6,0],[0,10],[-6,0]]);
  }else{
    cross(c,radius,'#b6414e53','#e9a077');
    for(let i=0;i<4;i++){
      c.save();
      c.rotate(i*TAU/4);
      const distance=radius-20-progress*(radius-48);
      polygon(c,'#ffd990',[[0,-distance+10],[-8,-distance-4],[0,-distance],[8,-distance-4]]);
      c.restore();
    }
    polygon(c,'#ffe3a0',[[0,-15],[12,0],[0,15],[-12,0]]);
  }
  c.restore();
}

export function drawBossFlight(r,enemy,point){
  const target=enemy.castTarget;
  if(!target)return;
  const attack=bossCast(enemy);
  if(attack.kind!=='boulder')return;
  const progress=Math.max(0,1-enemy.actionTimer/attack.flight);
  const side=Math.cos(enemy.phase)<0?-1:1;
  const handX=point.x+side*enemy.radius*.85,handY=point.y-enemy.radius*1.25;
  const x=handX+(target.x-handX)*progress;
  const y=handY+(target.y-handY)*progress-Math.sin(progress*Math.PI)*115;
  const c=anchor(r,x,y);
  const size=attack.radius*.52;
  stone(c,size,side*(progress*4-.3));
  c.restore();
}

export function drawBossImpact(r,e){
  const progress=Math.max(0,Math.min(1,1-e.life/e.maxLife));
  const reduced=r.media.matches,seed=(e.x|0)^Math.imul(e.y|0,65537);
  const c=anchor(r,e.x,e.y);
  c.globalAlpha=Math.min(1,(1-progress)*3.6);
  if(e.kind==='brambles'){
    circle(c,e.radius,'#802c3b61','#e36258');
    thornLayout.forEach(([x,y,height,lean],i)=>{
      const rise=reduced?1:Math.max(.08,Math.min(1,(progress-i*.012)*9));
      const wilt=reduced?1:1-Math.max(0,progress-.65)*1.85;
      thorn(c,x*e.radius,y*e.radius,height*1.2*rise*wilt,lean,true);
    });
    if(!reduced)sporeBurst(c,e.radius,progress,seed);
  }else if(e.kind==='boulder'){
    circle(c,e.radius,'#9775b036','#dcbde4');
    c.strokeStyle='#332839';
    c.lineWidth=3;
    for(let i=0;i<6;i++){
      const angle=i*TAU/6;
      const length=e.radius*(.48+(i%3)*.12);
      c.beginPath();
      c.moveTo(0,0);
      c.lineTo(Math.cos(angle+.17)*length*.45,Math.sin(angle+.17)*length*.45);
      c.lineTo(Math.cos(angle)*length,Math.sin(angle)*length);
      c.stroke();
    }
    for(let i=0;i<3;i++){
      const angle=i*TAU/3+.38;
      const offset=13+(reduced?0:14*progress);
      c.save();
      c.translate(Math.cos(angle)*offset,Math.sin(angle)*offset);
      stone(c,16-i*2,angle);
      c.restore();
    }
    if(!reduced){
      groundSlam(c,e.radius,progress);
      shatter(c,e.radius,progress,seed,false);
    }
  }else{
    cross(c,e.radius,'#e064665b','#ffcf8a');
    for(let n=-4;n<=4;n++){
      if(!n)continue;
      const distance=e.radius*n*.23;
      const rise=reduced?1:Math.max(.1,Math.min(1,(progress-.022*Math.abs(n))*8));
      const height=(25+5*Math.abs(n))*rise;
      glass(c,distance,0,height);
      glass(c,n%2?8:-8,distance,height);
    }
    glass(c,0,4,67*(reduced?1:Math.min(1,.2+progress*8)));
    if(!reduced&&progress>.09)shatter(c,e.radius,(progress-.09)/.91,seed,true);
  }
  c.restore();
}
