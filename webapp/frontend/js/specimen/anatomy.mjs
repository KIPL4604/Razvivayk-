import {HUMAN} from './tuning.mjs';
// Head, chest, pelvis, two knees/feet and two independent hands.
export const RIG=Object.freeze([
  [0,-24,7],[0,-8,14],[0,7,11],[-7,15,5],[-9,21,5],[7,15,5],[9,21,5],[-15,-4,4],[15,-4,4]
]);
export const JOINTS=Object.freeze([[0,1,16],[1,2,15],[2,3,12],[3,4,12],[2,5,12],[5,6,12],[1,7,18],[1,8,18]]);
export function createPose(e,old=null){
  const pose=RIG.map(([dx,dy,r])=>({x:e.x+dx,y:e.y+dy,px:e.x+dx-(e.vx||0)/60,py:e.y+dy-(e.vy||0)/60,r}));
  if(old?.length===4){
    // Retain the old head/chest and momentum; new limbs settle through collisions.
    for(let i=0;i<2;i++)Object.assign(pose[i],old[i],{r:RIG[i][2]});
  }
  return pose;
}
export function constrainPose(s,pose,move){
  for(let pass=0;pass<HUMAN.constraintPasses;pass++)for(const [i,j,length]of JOINTS){
    const a=pose[i],b=pose[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
    const k=Math.max(-HUMAN.maxCorrection,Math.min(HUMAN.maxCorrection,(d-length)*HUMAN.constraintRate))/d;
    const wa=i===1?.3:.5;move(s,a,dx*k*wa,dy*k*wa);move(s,b,-dx*k*(1-wa),-dy*k*(1-wa));
  }
  for(const n of pose){
    move(s,n,0,0);const vx=n.x-n.px,vy=n.y-n.py,d=Math.hypot(vx,vy),max=HUMAN.maxFallSpeed/60;
    if(d>max){n.px=n.x-vx/d*max;n.py=n.y-vy/d*max;}
  }
}
