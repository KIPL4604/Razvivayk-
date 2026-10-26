// Limbs belong to the simulation: fixed contacts, reach constraints and traction.
import {LIMB as P} from './tuning.mjs';
const TAU=Math.PI*2;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDifference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function surface(s,n,angle,reach,solid){
  if(solid(s,n.x,n.y))return null;
  const dx=Math.cos(angle),dy=Math.sin(angle);
  for(let d=2;d<=reach+2;d+=2){
    let hi=Math.min(d,reach);if(!solid(s,n.x+dx*hi,n.y+dy*hi))continue;
    let lo=Math.max(0,hi-2);for(let j=0;j<9;j++){const mid=(lo+hi)/2;if(solid(s,n.x+dx*mid,n.y+dy*mid))hi=mid;else lo=mid;}
    const x=n.x+dx*hi,y=n.y+dy*hi;
    let nx=Number(solid(s,x-.5,y))-Number(solid(s,x+.5,y)),ny=Number(solid(s,x,y-.5))-Number(solid(s,x,y+.5)),length=Math.hypot(nx,ny);
    if(!length){nx=-dx;ny=-dy;length=1;}return{x,y,nx:nx/length,ny:ny/length};
  }
  return null;
}
function visibleContact(s,n,a,solid){if(solid(s,n.x,n.y))return false;const d=distance(n,a);for(let t=2;t<d-.08;t+=2)if(solid(s,n.x+(a.x-n.x)*t/d,n.y+(a.y-n.y)*t/d))return false;return true;}
function reachable(s,n,a,reach,solid){return distance(n,a)<=reach+.01&&solid(s,a.x,a.y)&&visibleContact(s,n,a,solid);}
function release(l){l.anchor=null;l.target=null;l.planted=false;l.age=0;l.cooldown=.09;l.tension=0;l.restLength=null;}
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
  const stage=s.mass<=36?0:s.mass<=68?1:2,count=6+stage*2,reach=P.reach+stage*P.stageReach;
  s.limbs||=[];s.limbs.length=Math.min(s.limbs.length,count);
  while(s.limbs.length<count)s.limbs.push({root:0,anchor:null,target:null,tip:{x:s.x,y:s.y},age:0,planted:false,reach});
  for(let i=0;i<count;i++){
    const l=s.limbs[i];
    if(!s.nodes[l.root]){l.root=s.nodes.length-1;release(l);}
    if(l.initialized!==true){l.root=Math.floor(i*(s.nodes.length-1)/(count-1));l.tip={x:s.nodes[l.root].x,y:s.nodes[l.root].y};l.initialized=true;}
    l.reach+=Math.max(-100*dt,Math.min(100*dt,reach-l.reach));
    const n=s.nodes[l.root];l.age+=dt;l.cooldown=Math.max(0,(l.cooldown||0)-dt);
    if(l.anchor){
      const d=distance(n,l.anchor),forward=(l.anchor.x-n.x)*ix+(l.anchor.y-n.y)*iy;
      if(!reachable(s,n,l.anchor,l.reach,solid)||(forward< -38&&l.age>.28+i*.025&&s.limbs.filter(v=>v.anchor).length>2&&d>l.reach*.5)){
        release(l);
      }
    }
    if(!l.anchor&&!l.target&&!l.cooldown)l.target=findContact(s,n,i,count,l.reach,ix,iy,solid);
    if(l.target){
      if(!reachable(s,n,l.target,l.reach,solid)){release(l);continue;}
      const d=distance(l.tip,l.target),amount=Math.min(1,P.extend*dt/(d||1));l.tip.x+=(l.target.x-l.tip.x)*amount;l.tip.y+=(l.target.y-l.tip.y)*amount;
      if(amount===1){l.anchor=l.target;l.target=null;l.planted=true;l.tip={x:l.anchor.x,y:l.anchor.y};l.age=0;}
    }else if(l.anchor){l.tip.x=l.anchor.x;l.tip.y=l.anchor.y;}
    else{const amount=Math.min(1,P.retract*dt/(distance(l.tip,n)||1));l.tip.x+=(n.x-l.tip.x)*amount;l.tip.y+=(n.y-l.tip.y)*amount;}
    if(l.anchor){const d=distance(n,l.anchor);l.restLength??=d;const forward=(l.anchor.x-n.x)*ix+(l.anchor.y-n.y)*iy;
      if(forward>P.forwardThreshold)l.restLength=Math.max(n.r*2,l.restLength-P.spool*dt);else l.restLength=Math.min(l.reach,l.restLength+P.spool*dt);
      l.tension=Math.max(0,Math.min(1,(d-l.restLength)/P.tensionDistance));
    }else l.tension=0;
  }
  return s.limbs.filter(l=>l.planted&&l.anchor).length;
}
// Recheck after every physical correction: only planted, visible contacts supply force.
export function validateAnchors(s,solid){
  for(const l of s.limbs){const n=s.nodes[l.root];if(!n||(l.anchor&&!reachable(s,n,l.anchor,l.reach,solid))||(l.target&&!reachable(s,n,l.target,l.reach,solid)))release(l);}
}
export function supportTraction(s,ix,iy){
  const len=Math.hypot(ix,iy);let strength=0;
  for(const l of s.limbs){if(!l.anchor||!l.planted)continue;const n=s.nodes[l.root],d=distance(n,l.anchor)||1;
    const forward=len?((l.anchor.x-n.x)*ix+(l.anchor.y-n.y)*iy)/(d*len):0;
    const tangent=len?1-Math.abs(l.anchor.nx*ix+l.anchor.ny*iy)/len:1;
    strength+=Math.max(.16+.84*Math.max(0,forward),.46*tangent)*Math.min(1,(l.reach-d)/18+.3);
  }
  return Math.min(1,Math.max(0,strength)/Math.max(2,s.limbs.length*.65));
}
export function constrainAnchors(s,move){
  for(const l of s.limbs){if(!l.anchor||!l.planted)continue;const n=s.nodes[l.root],dx=l.anchor.x-n.x,dy=l.anchor.y-n.y,d=Math.hypot(dx,dy);
    const excess=Math.max(0,d-(l.restLength??l.reach)),pull=Math.min(P.pullRate/60,excess*P.pullStiffness/60+Math.max(0,d-l.reach*.92)*.12)/(d||1);
    if(pull){const ox=n.x,oy=n.y;move(s,n,dx*pull,dy*pull);n.px+=n.x-ox;n.py+=n.y-oy;}}
}
