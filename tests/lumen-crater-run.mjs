import assert from 'node:assert/strict';
import test from 'node:test';
import {createRun,step,chooseUpgrade,serialize,restore} from '../webapp/frontend/js/lumen/engine.mjs';
import {WEAPON_IDS} from '../webapp/frontend/js/lumen/catalog.mjs';
import {steer} from './helpers/lumen-pilot.mjs';

test('a normal crater expedition reaches 40, defeats the full boss and opens its treasure through legal play',t=>{
  const run=createRun({seed:17,character:'scout',map:'crater'}),memory={},phases=new Set();
  const preference=['pulse','spark','orbit','flame','focus','haste','storm','ice','cleaver','thorn','aegis','chronogear','amplifier','collector','laurel','heart','carapace','ember','compass','hourglass','magnet','vitality','stride','repair'];
  let bossStarted=false;
  for(let frame=0;frame<1200*60&&!['lost','won'].includes(run.status);frame++){
    step(run,steer(run,frame,memory),1/60);
    while(run.status==='upgrade'){
      const recovery=run.player.hp<run.player.maxHp*.65&&['vitality','repair'].find(id=>run.choices.includes(id));
      const discovery=WEAPON_IDS.filter(id=>run.upgrades[id]).length<3&&preference.find(id=>WEAPON_IDS.includes(id)&&!run.upgrades[id]&&run.choices.includes(id));
      const defense=run.player.hp<run.player.maxHp*.8&&['aegis','stride'].find(id=>run.choices.includes(id));
      assert(chooseUpgrade(run,recovery||discovery||defense||preference.find(id=>run.choices.includes(id))||run.choices[0]));
    }
    if(run.arena){
      phases.add(run.arena.phase);
      if(!bossStarted){
        bossStarted=true;assert.equal(run.level,40);assert.equal(run.status,'playing');
        assert.equal(run.enemies.find(e=>e.kind==='arena-boss').hp,36000);
        assert.equal(run.enemies.filter(e=>e.kind==='arena-tick').length,32);
        assert(restore(serialize(run)));
      }
    }
  }
  assert.equal(run.status,'won',JSON.stringify({time:run.time,level:run.level,hp:run.player.hp,arena:run.arena}));
  assert.equal(run.endReason,'boss');assert.equal(run.level,40);assert(run.player.hp>0&&run.kills>100);
  assert.deepEqual([...phases],['forming','fighting','reward','celebrating','complete']);
  const treasure=run.lootLog.find(l=>l.id===run.arena.rewardId);assert(treasure);assert.equal(treasure.coins,800);
  assert(restore(serialize(run)));t.diagnostic('Seed17; simulation seconds '+run.time.toFixed(2)+'; HP '+run.player.hp.toFixed(2));
});
