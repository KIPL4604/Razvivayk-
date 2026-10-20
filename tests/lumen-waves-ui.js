async(page)=>{
  const assert=(ok,message)=>{if(!ok)throw Error(message);},out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
  const context=await page.context().browser().newContext({viewport:{width:375,height:812},deviceScaleFactor:1});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.goto('http://127.0.0.1:8081');
    const simulation=await p.evaluate(async()=>{
      const core=await import('/static/js/lumen/engine.mjs'),run=core.createRun({seed:1});
      const preference=['orbit','pulse','spark','focus','haste','storm','ice','flame','cleaver','thorn','magnet','vitality','stride','repair'];
      const snapshots={},tiers=new Set(),checkpoints=[50,58,178,358];let peak=0;
      for(let frame=0;frame<480*60&&!['lost','won'].includes(run.status);frame++){
        const player=run.player;let target=null;
        for(const gem of [...run.chests,...run.gems])if(!target||Math.hypot(gem.x-player.x,gem.y-player.y)<Math.hypot(target.x-player.x,target.y-player.y))target=gem;
        const d=target?Math.hypot(target.x-player.x,target.y-player.y)||1:1;
        let x=target?(target.x-player.x)/d:Math.cos(frame/260)*.4,y=target?(target.y-player.y)/d:Math.sin(frame/260)*.4;
        for(const enemy of run.enemies){const dx=player.x-enemy.x,dy=player.y-enemy.y,near=Math.hypot(dx,dy)||1;if(near<85){const force=(85-near)/45;x+=dx/near*force;y+=dy/near*force;}}
        for(const shot of run.projectiles.filter(s=>s.hostile)){const dx=player.x-shot.x,dy=player.y-shot.y,near=Math.hypot(dx,dy)||1;if(near<65){x+=dx/near*(65-near)/30;y+=dy/near*(65-near)/30;}}
        core.step(run,{x,y},1/60);
        while(run.status==='upgrade'){const recovery=run.player.hp<run.player.maxHp*.65&&['vitality','repair'].find(id=>run.choices.includes(id));if(!core.chooseUpgrade(run,recovery||preference.find(id=>run.choices.includes(id))))throw Error('No legal upgrade');}
        peak=Math.max(peak,run.enemies.length);for(const gem of run.gems)tiers.add(gem.tier);
        for(const time of checkpoints)if(!snapshots[time]&&run.time>=time)snapshots[time]=core.serialize(run);
      }
      return {snapshots,tiers:[...tiers].sort(),peak,result:{status:run.status,hp:run.player.hp,level:run.level,kills:run.kills,bosses:run.bossesDefeated,time:run.time,upgrades:run.upgrades}};
    });
    assert(simulation.result.status==='won'&&simulation.result.bosses===3,'Real normal run failed '+JSON.stringify(simulation.result));
    assert(simulation.tiers.join(',')==='1,2,3','Real drops did not reach all tiers');
    const results=[];
    for(const width of [375,1440])for(const time of [50,58,178,358]){
      await p.setViewportSize({width,height:width===375?812:900});
      await p.evaluate(async snapshot=>{
        showScreen('home');const core=await import('/static/js/lumen/engine.mjs');
        if(!core.restore(snapshot))throw Error('Autoplay snapshot invalid');
        saved.lumen={run:snapshot,lastTouchedAt:Date.now()};saveState();
      },simulation.snapshots[time]);
      await p.reload();await p.locator('[data-resume="lumen"]').click();await p.locator('[data-lumen-action="continue"]').click();
      await p.waitForTimeout(180);
      const label=await p.locator('#lumenWave').innerText();
      if(time===50)assert(label.includes('СЛАБЫЙ РОЙ'),'Harvest announcement missing');
      if(time===58)assert(label.includes('НОВАЯ ВОЛНА'),'Stronger wave announcement missing');
      const fpsProbe=await p.evaluate(()=>({smoothing:lumenCanvas.getContext('2d').imageSmoothingEnabled,overflow:document.documentElement.scrollWidth>innerWidth}));
      assert(!fpsProbe.smoothing&&!fpsProbe.overflow,'Wave render regression');
      await p.screenshot({path:out+`lumen-waves-${time}s-${width}.png`});results.push({width,time,label,level:simulation.snapshots[time].level,enemies:simulation.snapshots[time].enemies.length});
    }
    // A resumed old version1 save keeps the exact pending price and legacy gems.
    await p.evaluate(async()=>{
      showScreen('home');const core=await import('/static/js/lumen/engine.mjs'),old=core.createRun({seed:14});old.level=20;old.xpNext=148;old.gems=[{x:100,y:150,value:4}];saved.lumen={run:old,lastTouchedAt:Date.now()};saveState();
    });
    await p.reload();await p.locator('[data-resume="lumen"]').click();
    assert((await p.locator('#lumenXpLabel').innerText()).includes('148'),'Legacy level price changed on resume');
    assert(!errors.length,errors.join(';'));
    return {normalRun:simulation.result,tiers:simulation.tiers,peak:simulation.peak,scenes:results,errors};
  }finally{await context.close();}
}
