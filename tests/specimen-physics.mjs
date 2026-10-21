import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,restore,serialize,step,blocked,ROOMS,currentRoom} from '../webapp/frontend/js/specimen/engine.mjs';
import {updateAnchors,validateAnchors,supportTraction} from '../webapp/frontend/js/specimen/locomotion.mjs';

const H=1/60;
const ticks=(s,n,input={})=>{for(let i=0;i<n;i++)step(s,H,input);};
const fixture=(room,mass,x,y)=>restore({...serialize(createRun()),room,mass,x,y});
const limbState=()=>({mass:32,ticks:0,x:0,y:0,nodes:Array.from({length:6},()=>({x:0,y:0,r:9})),limbs:[]});
function clearBody(s){
  for(const n of s.nodes){
    assert.ok(Number.isFinite(n.x+n.y+n.px+n.py),'finite body');
    for(let j=0;j<32;j++){
      const a=j/32*Math.PI*2;
      assert.ok(!blocked(s,n.x+Math.cos(a)*(n.r-.08),n.y+Math.sin(a)*(n.r-.08)),`body penetrated at ${n.x},${n.y}`);
    }
  }
}

test('an embedded limb root cannot plant or pull through solid geometry',()=>{
  const s=limbState();updateAnchors(s,1,0,(_,x)=>x>=-1&&x<=2,H);
  assert.ok(s.limbs.every(l=>!l.anchor&&!l.target));
  s.limbs[0].anchor={x:0,y:0,nx:-1,ny:0};s.limbs[0].planted=true;
  validateAnchors(s,()=>true);assert.ok(s.limbs.every(l=>!l.anchor),'embedded coincident anchor survived');
});

test('contacts land on the first surface rather than several pixels inside it',()=>{
  const s=limbState();for(let i=0;i<80;i++)updateAnchors(s,1,0,(_,x)=>x>=90,H);
  assert.ok(s.limbs.some(l=>l.anchor));
  for(const l of s.limbs.filter(l=>l.anchor))assert.ok(l.anchor.x>=90&&l.anchor.x<90.05,`contact buried at ${l.anchor.x}`);
});

test('without support, released input preserves and gradually damps momentum',()=>{
  // A temporary empty room isolates unsupported flight without mocking the integrator.
  const cells=ROOMS[0].cells,saved=cells.slice();cells.fill(0);
  try{
    const raw={...serialize(createRun()),x:384,y:216};raw.rooms[0].gateOpen=true;
    const s=restore(raw);for(const n of s.nodes)n.px=n.x-100*H;
    const x=s.x;step(s,H);assert.equal(s.limbs.filter(l=>l.anchor).length,0);
    assert.ok(s.x-x>90*H&&s.x-x<100*H,`momentum lost: ${(s.x-x)/H}`);
    ticks(s,20);assert.ok(s.nodes[0].x-s.nodes[0].px>20*H);
  }finally{cells.set(saved);}
});

test('a reversal retains body volume and settles without a folded pile of nodes',()=>{
  const s=fixture(0,100,380,275);currentRoom(s).enemies.forEach(e=>e.eaten=e.dead=true);
  ticks(s,70,{x:1});ticks(s,100,{x:-1});
  for(let i=1;i<s.nodes.length;i++){
    const n=s.nodes[i],p=s.nodes[n.parent];
    assert.ok(Math.hypot(n.x-p.x,n.y-p.y)>(n.r+p.r)*.35,'collapsed link');
    assert.ok(Math.hypot(n.x-p.x,n.y-p.y)<(n.r+p.r)*1.08,'detached link');
  }
  clearBody(s);
});

test('mass changes keep surviving roots and ease radii instead of jumping',()=>{
  const s=fixture(1,100,250,430),r=s.nodes[0].r;
  const roots=s.limbs.slice(0,6).map(l=>l.root);
  step(s,H,{interact:true});assert.equal(s.mass,32);assert.equal(s.nodes.length,6);
  assert.ok(Math.abs(s.nodes[0].r-r)<.3,'radius jumped on shrink');
  s.limbs.forEach((l,i)=>{if(roots[i]<6)assert.equal(l.root,roots[i],'surviving root reassigned');assert.ok(s.nodes[l.root]);});
  ticks(s,60);assert.ok(Math.abs(s.nodes[0].r-10.08)<.05);
  step(s,H,{interact:true});assert.equal(s.mass,100);
  clearBody(s);const copy=restore(serialize(s));assert.ok(copy);clearBody(copy);
  ticks(copy,60);clearBody(copy);assert.equal(copy.nodes.length,16);assert.equal(copy.mass,100);
});

test('intent accelerates the head, turns within a short response window and leaves a trailing body',()=>{
  const s=fixture(0,32,400,270),x=s.x;step(s,H,{x:1});
  assert.ok(s.x>x&&s.x-x<.5,'unbounded initial acceleration');
  ticks(s,40,{x:1});const turnX=s.x;step(s,H,{x:-1});assert.ok(s.x>turnX,'instant reversal');
  ticks(s,14,{x:-1});assert.ok(s.nodes[0].x-s.nodes[0].px<0,'unresponsive reversal');
  ticks(s,36,{x:-1});
  assert.ok(s.nodes.slice(1).some(n=>n.x>s.x+8),'no trailing shape on reversal');
});

test('equal support counts produce different traction when anchors oppose the intent',()=>{
  const s=limbState();s.limbs=Array.from({length:6},()=>({root:0,planted:true,reach:200,anchor:{x:100,y:0,nx:-1,ny:0}}));
  const forward=supportTraction(s,1,0),reverse=supportTraction(s,-1,0);
  assert.ok(forward>reverse+.3);assert.ok(forward<=1&&reverse>=0);
  s.limbs=[];assert.equal(supportTraction(s,1,0),0);
});

test('reach and occlusion release contacts before they can contribute traction again',()=>{
  const s=limbState(),wall=(_,x)=>x>=90;
  for(let i=0;i<70;i++)updateAnchors(s,1,0,wall,H);
  const old=s.limbs.filter(l=>l.anchor).map(l=>({...l.anchor}));assert.ok(old.length);
  validateAnchors(s,(_,x)=>x>=40);assert.ok(s.limbs.every(l=>!l.anchor));
  for(const n of s.nodes)n.x=-150;
  for(let i=0;i<100;i++)updateAnchors(s,1,0,wall,H);
  assert.ok(s.limbs.every(l=>!l.anchor),'overextended contact');
  for(const n of s.nodes)n.x=0;
  for(let i=0;i<70;i++)updateAnchors(s,1,0,wall,H);
  assert.ok(s.limbs.some(l=>l.anchor),'failed to recover support');
  const anchors=s.limbs.map(l=>l.anchor&&{...l.anchor});
  for(let i=0;i<60;i++)updateAnchors(s,0,0,wall,H);
  assert.deepEqual(s.limbs.map(l=>l.anchor),anchors,'idle contact chatter');
});

test('released tips retract at a bounded speed instead of snapping back to their roots',()=>{
  const s=limbState(),wall=(_,x)=>x>=90;
  for(let i=0;i<70;i++)updateAnchors(s,1,0,wall,H);
  const previous=s.limbs.map(l=>({...l.tip}));updateAnchors(s,0,0,()=>false,H);
  assert.ok(s.limbs.every(l=>!l.anchor));
  s.limbs.forEach((l,i)=>assert.ok(Math.hypot(l.tip.x-previous[i].x,l.tip.y-previous[i].y)<=460*H+.01,'tip snapped on release'));
});

test('floor, wall, ceiling and corners keep full collision circles clear in every form',()=>{
  for(const mass of [32,54,100]){
    const s=fixture(0,mass,400,270);currentRoom(s).enemies.forEach(e=>e.eaten=e.dead=true);
    for(const [x,y]of [[-1,1],[1,1],[1,-1],[-1,-1],[-1,0],[0,-1],[1,0],[0,1]]){
      for(let k=0;k<180;k++){
        const before=s.nodes.map(n=>({x:n.x,y:n.y}));step(s,H,{x,y});clearBody(s);
        for(const [i,n]of s.nodes.entries())assert.ok(Math.hypot(n.x-before[i].x,n.y-before[i].y)<9,'constraint launched a node');
        for(const l of s.limbs.filter(l=>l.anchor)){
          const n=s.nodes[l.root],d=Math.hypot(n.x-l.anchor.x,n.y-l.anchor.y);
          assert.ok(d<=l.reach+.02&&blocked(s,l.anchor.x,l.anchor.y));
          for(let t=0;t<d-.08;t+=2)assert.ok(!blocked(s,n.x+(l.anchor.x-n.x)*t/d,n.y+(l.anchor.y-n.y)*t/d),'anchor through wall');
        }
      }
    }
  }
});

test('narrow channel and repeated size changes beside two surfaces survive save and restore',()=>{
  const s=fixture(1,100,70,368);currentRoom(s).objects[0].x=70;
  for(let cycle=0;cycle<3;cycle++){
    step(s,H,{interact:true});assert.equal(s.mass,32);clearBody(s);
    ticks(s,60);step(s,H,{interact:true});assert.equal(s.mass,100);
    for(let i=0;i<110;i++){step(s,H);clearBody(s);}
    const copy=restore(serialize(s));assert.ok(copy);clearBody(copy);
    assert.equal(copy.mass,100);assert.ok(copy.limbs.every(l=>copy.nodes[l.root]));
  }
  const small=fixture(1,32,320,396);ticks(small,110,{x:1});assert.ok(small.x>470);clearBody(small);
});

test('resting on floor, ceiling and a corner settles without body jitter or contact chatter',()=>{
  for(const [mass,x,y]of [[32,400,58.08],[54,400,659.68],[100,62.56,62.56]]){
    const s=fixture(0,mass,x,y);currentRoom(s).enemies.forEach(e=>e.dead=e.eaten=true);ticks(s,240);
    for(let i=0;i<120;i++){
      const before=s.nodes.map(n=>({x:n.x,y:n.y})),anchors=s.limbs.map(l=>l.anchor);step(s,H);
      s.nodes.forEach((n,j)=>assert.ok(Math.hypot(n.x-before[j].x,n.y-before[j].y)<.05,'resting jitter'));
      assert.deepEqual(s.limbs.map(l=>l.anchor),anchors,'resting contact churn');clearBody(s);
    }
  }
});
