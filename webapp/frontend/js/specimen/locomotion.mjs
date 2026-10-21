// Limbs belong to the simulation: fixed contacts, reach constraints and traction.
const TAU=Math.PI*2;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDifference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function surface(s,n,angle,reach,solid){
  const dx=Math.cos(angle),dy=Math.sin(angle);
  for(let d=10;d<=reach;d+=4){const x=n.x+dx*d,y=n.y+dy*d;if(solid(s,x,y))return{x,y,nx:-dx,ny:-dy};}
  return null;
}
function visibleContact(s,n,a,solid){const d=distance(n,a);for(let t=6;t<d-6;t+=5)if(solid(s,n.x+(a.x-n.x)*t/d,n.y+(a.y-n.y)*t/d))return false;return true;}
function findContact(s,n,index,count,reach,ix,iy,solid){
  const base=index/count*TAU+.3,moving=Math.hypot(ix,iy)>.1;let best=null,score=Infinity;
  for(let j=0;j<16;j++){
    const angle=j/16*TAU,a=surface(s,n,angle,reach,solid);if(!a)continue;
    const d=distance(n,a),forward=moving?((a.x-n.x)*ix+(a.y-n.y)*iy)/(d||1):0;
    const crowd=s.limbs.some(l=>l.anchor&&distance(l.anchor,a)<26)?24:0;
    const value=d*.22+angleDifference(angle,base)*24-forward*(moving?48:0)+crowd;
    if(value<score){best=a;score=value;}
  }
  return best;
}
export function updateAnchors(s,ix,iy,solid,dt){
  const stage=s.mass<=36?0:s.mass<=68?1:2,count=6+stage*2,reach=200+stage*28,initial=!s.limbs?.length;
  s.limbs||=[];s.limbs.length=Math.min(s.limbs.length,count);
  while(s.limbs.length<count)s.limbs.push({root:0,anchor:null,target:null,tip:{x:s.x,y:s.y},age:0,planted:false,reach});
  for(let i=0;i<count;i++){
    const l=s.limbs[i];l.root=Math.floor(i*(s.nodes.length-1)/(count-1));l.reach=reach;
    const n=s.nodes[l.root];l.age+=dt;
    if(l.anchor){
      const d=distance(n,l.anchor),forward=(l.anchor.x-n.x)*ix+(l.anchor.y-n.y)*iy;
      if(!solid(s,l.anchor.x,l.anchor.y)||d>reach*1.02||!visibleContact(s,n,l.anchor,solid)||(forward< -38&&l.age>.25&&(s.ticks+i*7)%19===0)){
        l.anchor=null;l.planted=false;l.target=null;l.age=0;
      }
    }
    if(!l.anchor&&!l.target){l.target=findContact(s,n,i,count,reach,ix,iy,solid);if(initial&&i%2===0&&l.target){l.anchor=l.target;l.target=null;l.tip={x:l.anchor.x,y:l.anchor.y};l.planted=true;l.age=0;}}
    if(l.target){
      if(!solid(s,l.target.x,l.target.y)||distance(n,l.target)>reach*1.08||!visibleContact(s,n,l.target,solid)){l.target=null;continue;}
      const d=distance(l.tip,l.target),amount=Math.min(1,460*dt/(d||1));l.tip.x+=(l.target.x-l.tip.x)*amount;l.tip.y+=(l.target.y-l.tip.y)*amount;
      if(d<9){l.anchor=l.target;l.target=null;l.planted=true;l.tip={x:l.anchor.x,y:l.anchor.y};l.age=0;}
    }else if(l.anchor){l.tip.x=l.anchor.x;l.tip.y=l.anchor.y;}
    else{l.tip.x+=(n.x-l.tip.x)*.3;l.tip.y+=(n.y-l.tip.y)*.3;}
  }
  return s.limbs.filter(l=>l.planted&&l.anchor).length;
}
export function constrainAnchors(s,collide){
  for(const l of s.limbs){if(!l.anchor||!l.planted)continue;const n=s.nodes[l.root],dx=l.anchor.x-n.x,dy=l.anchor.y-n.y,d=Math.hypot(dx,dy);
    if(d>l.reach*.96){const pull=(d-l.reach*.96)*.24/(d||1),x=dx*pull,y=dy*pull;n.x+=x;n.y+=y;n.px+=x;n.py+=y;collide(s,n);}}
}
