import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMeta,bankCoins,recordProgress} from '../webapp/frontend/js/lumen/economy.mjs';
import {createRun,step,chooseUpgrade,restore,serialize} from '../webapp/frontend/js/lumen/engine.mjs';
import {WEAPON_IDS} from '../webapp/frontend/js/lumen/catalog.mjs';
import {bodyRadius,PLAYER_BODY} from '../webapp/frontend/js/lumen/physics.mjs';
import {CASTLE,castleProps} from '../webapp/frontend/js/lumen/castle.mjs';
function steer(run,frame,memory){
 if(frame%6&&memory.input)return memory.input;
 const p=run.player;
 if(run.arena&&['forming','fighting'].includes(run.arena.phase)){const dx=p.x,dy=p.y+2000,d=Math.hypot(dx,dy)||1,r=(330-d)*.04;return memory.input={x:-dy/d+dx/d*r,y:dx/d+dy/d*r};}
 let target=null,nearest=Infinity;
 for(const item of [...run.chests,...run.gems]){const d=Math.hypot(item.x-p.x,item.y-p.y);if(d<nearest){nearest=d;target=item;}}
 if(run.castle.phase==='guidance')target={x:0,y:-2000};
 const nearby=run.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<280);
 if(!target&&run.enemies.length){const e=run.enemies.reduce((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(b.x-p.x,b.y-p.y)?a:b);const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;target={x:e.x+dx/d*130,y:e.y+dy/d*130};}
 const gx=target?target.x-p.x:Math.cos(frame/260),gy=target?target.y-p.y:Math.sin(frame/260),gd=Math.hypot(gx,gy)||1;
 const shots=run.projectiles.filter(s=>s.hostile&&Math.hypot(s.x-p.x,s.y-p.y)<230),props=castleProps(p.y-180,p.y+180);
 let best=-Infinity,input={x:0,y:0};
 for(let i=0;i<24;i++){
  const a=i*Math.PI/12,x=Math.cos(a),y=Math.sin(a);
  let score=(x*gx+y*gy)/gd+.18*(x*(memory.input?.x||0)+y*(memory.input?.y||0));
  for(const h of [.2,.5]){
   const px=p.x+x*p.speed*h,py=p.y+y*p.speed*h;
   if(Math.abs(px)>650)score-=(Math.abs(px)-650)/8;
   if(run.level<45&&py<CASTLE.gateY+55)score-=(CASTLE.gateY+55-py)/8;
   for(const prop of props){const d=Math.hypot(px-prop.x,py-prop.y)-PLAYER_BODY-prop.radius;if(d<25)score-=(25-d)/8;}
   for(const e of nearby){
    const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
    const spacing=['spitter','moonmoth','paper-moth'].includes(e.kind)&&d<155?-.5:1;
    const motion=e.actionTimer>0?0:e.speed*h*spacing,ex=e.x+dx/d*motion,ey=e.y+dy/d*motion;
    const c=Math.hypot(px-ex,py-ey)-bodyRadius(e)-PLAYER_BODY;
    if(c<45)score-=Math.min(15,((45-c)/30)**2)*1.6;
   }
   for(const s of shots){const d=Math.hypot(px-s.x-s.vx*h,py-s.y-s.vy*h)-s.radius-13;if(d<30)score-=(30-d)/4;}
   for(const w of run.effects){
    if(w.kind==='warning'){const d=Math.hypot(px-w.x,py-w.y);if(d<w.radius+35)score-=(w.radius+35-d)/5;}
    if(w.kind==='charge'){const dx=w.toX-w.x,dy=w.toY-w.y,len=dx*dx+dy*dy||1,along=Math.max(0,Math.min(1,((px-w.x)*dx+(py-w.y)*dy)/len)),d=Math.hypot(px-w.x-dx*along,py-w.y-dy*along);if(d<55)score-=(55-d)/6;}
   }
  }
  if(score>best){best=score;input={x,y};}
 }
 return memory.input=input;
}

// QA only: the run is never edited. Steering reads threats, floor geometry,
// warnings and pickups; all equipment comes from the real offered choices.
test('a normal Keeper castle expedition reaches45, follows guidance, defeats the monarch and opens one800reward',{timeout:120000},t=>{
 const character='keeper',run=createRun({seed:17,map:'castle',character}),memory={},phases=new Set();
 const pref=[Object.keys(run.upgrades)[0],'pulse','flame','spark','storm','orbit','focus','haste','aegis','laurel','heart','chronogear','amplifier','collector','carapace','ember','compass','hourglass','magnet','vitality','stride','repair'];
 let goalAt=null,upgradeChoices=0,guidanceSeen=false;
 for(let frame=0;frame<1800*60&&!['won','lost'].includes(run.status);frame++){
  step(run,steer(run,frame,memory),1/60);
  while(run.status==='upgrade'){
   const recovery=run.player.hp<run.player.maxHp*.55&&['vitality','repair'].find(id=>run.choices.includes(id));
   const discovery=WEAPON_IDS.filter(id=>run.upgrades[id]).length<3&&pref.find(id=>WEAPON_IDS.includes(id)&&!run.upgrades[id]&&run.choices.includes(id));
   const defense=run.player.hp<run.player.maxHp*.8&&['aegis','stride'].find(id=>run.choices.includes(id));
   const choice=recovery||discovery||defense||pref.find(id=>run.choices.includes(id))||run.choices[0];
   assert(run.choices.includes(choice));assert(chooseUpgrade(run,choice));upgradeChoices++;
  }
  if(run.level===45&&goalAt===null)goalAt=run.time;
  if(run.castle.phase==='guidance'&&!run.arena)guidanceSeen=true;
  if(run.arena&&!phases.has(run.arena.phase)){
   phases.add(run.arena.phase);
   const resumed=restore(serialize(run));
   assert(resumed,'cannot resume natural phase '+run.arena.phase);
   assert.deepEqual(serialize(resumed),serialize(run));
  }
 }
 assert.equal(run.status,'won',JSON.stringify({time:run.time,level:run.level,hp:run.player.hp,phase:run.arena?.phase}));
 assert.equal(run.level,45);assert.equal(run.endReason,'boss');assert(run.player.hp>0);
 assert.equal(upgradeChoices,43);assert(guidanceSeen,'route skipped the independent guidance phase');
 assert.deepEqual([...phases],['forming','fighting','reward','celebrating','complete']);
 assert.equal(run.arena.kind,'castle');assert.equal(run.enemies.length,0);assert.equal(run.chests.length,0);
 const reward=run.lootLog.filter(item=>item.id===run.arena.rewardId);
 assert.equal(reward.length,1);assert.equal(reward[0].coins,800);
 assert.equal(run.lootLog.filter(item=>item.id===run.arena.rewardId).length,1);
 const resumed=restore(serialize(run));assert(resumed);assert.deepEqual(serialize(resumed),serialize(run));
 const meta=normalizeMeta({clearedMaps:['garden','quarry']});
 assert.equal(bankCoins(meta,run),run.coinsEarned);assert.equal(bankCoins(meta,resumed),0);
 recordProgress(meta,run);assert(meta.clearedMaps.includes('castle'));
 assert.deepEqual(run.training,{vigor:0,lens:0,drive:0,compass:0});
 t.diagnostic(JSON.stringify({character,seed:17,goalAt:goalAt.toFixed(2),wonAt:run.time.toFixed(2),
   hp:run.player.hp.toFixed(2),kills:run.kills,coins:run.coinsEarned,openedChests:run.openedChests,upgradeChoices}));
});
