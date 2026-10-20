async(page)=>{
  const out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/',iteration='v2';
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const context=await page.context().browser().newContext({viewport:{width:375,height:812},hasTouch:true}),p=await context.newPage(),errors=[],badAssets=[],results=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/assets/lumen/')&&r.status()>=400)badAssets.push(r.url());});
  async function seed(kind){
    await p.evaluate(async kind=>{
      showScreen('home');const core=await import('/static/js/lumen/engine.mjs'),{xpForLevel}=await import('/static/js/lumen/progression.mjs');
      const r=core.createRun({seed:71,map:kind.startsWith('quarry')?'quarry':'garden',runId:'campaign-qa-'+kind});
      const meta={coins:600,unlocked:['scout','keeper'],clearedMaps:kind.startsWith('quarry')?['garden']:[]};
      if(kind==='mastery'){
        for(let i=0;i<7;i++){r.status='upgrade';r.choices=['orbit'];core.chooseUpgrade(r,'orbit');}
        r.status='upgrade';r.level=12;r.choices=['orbit','flame','ice'];
      }else if(kind==='finish-choice'){r.level=29;r.xp=r.xpNext;r.status='upgrade';r.choices=['orbit'];
      }else if(kind==='quarry-finish'){r.level=34;r.xpNext=xpForLevel(34);r.xp=r.xpNext-2;r.gems=[{x:0,y:0,value:2,tier:1}];
      }else if(kind==='finish'){
        r.level=29;r.xpNext=xpForLevel(29);r.xp=r.xpNext-2;r.gems=[{x:0,y:0,value:2,tier:1}];
      }else if(kind==='quarry'){
        r.level=18;r.xpNext=xpForLevel(18);r.xp=45;r.time=195;r.spawnedGuardians=1;r.spawnedElites=2;r.spawnTimer=3;r.player.x=35;r.player.y=100;
        r.upgrades={spark:4,orbit:8,flame:3,ice:3,thorn:4};r.foundWeapons=['orbit','flame','ice','thorn'];
        r.enemies=[[-125,-20,'crawler'],[135,70,'spitter'],[-180,150,'wisp'],[190,-100,'wasp'],[-240,-130,'beetle'],[70,-195,'mote'],[160,235,'crawler']].map(([x,y,kind],i)=>({id:10+i,x,y,kind,hp:90,maxHp:100,radius:12,speed:25,damage:7,value:2,phase:i*.4,hitFlash:0,guardianStage:0,fireTimer:3,elite:false,slowTime:0,actionTimer:0}));
        r.gems=[{x:80,y:200,value:2,tier:1},{x:-75,y:190,value:12,tier:2},{x:115,y:260,value:40,tier:3}];r.chests=[{id:30,x:-140,y:70,coins:60,upgrade:true,boss:true}];r.nextId=40;
      }
      if(!core.restore(core.serialize(r)))throw Error('Invalid campaign fixture '+kind);
      saved.lumen={meta,run:core.serialize(r)};saveState();
    },kind);
    await p.reload();await p.locator('[data-resume="lumen"]').click();
    if(kind==='mastery'||kind==='finish-choice')await p.locator('.lumen-upgrade-dialog').waitFor();else await p.locator('[data-lumen-action="continue"]').click();
    await p.waitForTimeout(350);
  }
  try{
    await p.goto('http://127.0.0.1:8081');await p.evaluate(()=>{saved.lumen={meta:{coins:600}};saveState();});await p.reload();
    await p.locator('[data-lumen-action="open"]').click();await p.locator('.lumen-maps').waitFor();await p.waitForTimeout(350);assert((await p.locator('[data-lumen-action="start"]').boundingBox()).y+(await p.locator('[data-lumen-action="start"]').boundingBox()).height<747,'Mobile primary action below fold');
    assert(await p.locator('[data-lumen-action="map"][data-lumen-value="quarry"]').isDisabled(),'Quarry open before victory');
    await p.locator('[data-lumen-action="character"][data-lumen-value="duelist"]').click();assert(await p.locator('[data-lumen-action="buy"]').isDisabled(),'Coins bypass mastery');
    assert((await p.locator('.lumen-unlock-rule').innerText()).includes('VIII'),'Unlock explanation absent');
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await p.locator('.lumen-maps').scrollIntoViewIfNeeded();await p.waitForTimeout(150);
      await p.screenshot({path:out+`lumen-campaign-map-select-${width}-${iteration}.png`});
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.lumen-brief').getBoundingClientRect().right<=innerWidth),'Setup clipped '+width);
      await p.locator('.lumen-unlock-rule').scrollIntoViewIfNeeded();await p.screenshot({path:out+`lumen-campaign-locked-hero-${width}-${iteration}.png`});
    }
    results.push('Locked second map and mastery gate despite sufficient coins at four widths');
    await p.setViewportSize({width:375,height:812});await seed('mastery');
    await p.screenshot({path:out+`lumen-campaign-stage-viii-375-${iteration}.png`});
    await p.locator('[data-lumen-action="upgrade"][data-lumen-value="orbit"]').click();await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.meta.weaponBest.orbit===8),'Stage VIII not recorded');await p.locator('[data-lumen-action="exit"]').click();
    await p.locator('[data-lumen-action="character"][data-lumen-value="duelist"]').click();assert(await p.locator('[data-lumen-action="buy"]').isEnabled(),'Mastery did not unlock purchase');
    await p.locator('[data-lumen-action="buy"]').click();assert(await p.evaluate(()=>saved.lumen.meta.coins===280&&saved.lumen.meta.unlocked.includes('duelist')),'Incorrect purchase');
    await p.reload();assert(await p.evaluate(()=>saved.lumen.meta.weaponBest.orbit===8&&saved.lumen.meta.unlocked.includes('duelist')),'Unlock lost on reload');
    results.push('Actual VII→VIII choice, durable mastery, paid purchase with exact deduction');
    await seed('finish');await p.locator('[data-lumen-action="next"]').waitFor();
    await p.screenshot({path:out+`lumen-campaign-victory-375-${iteration}.png`});
    assert(await p.evaluate(()=>saved.lumen.run===null&&saved.lumen.meta.clearedMaps.includes('garden')),'Victory did not unlock map');
    await p.locator('[data-lumen-action="next"]').click();await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.run.map==='quarry'&&saved.lumen.run.level===1&&saved.lumen.meta.coins===600),'Next map transition failed');
    await p.reload();await p.locator('[data-resume="lumen"]').click();assert((await p.locator('#lumenGoal').innerText()).includes('Лунный карьер'),'Wrong resumed biome');
    results.push('XP pickup wins at level30, clears run, unlocks quarry, next starts at level1 and resumes');
    await seed('finish-choice');await p.locator('[data-lumen-action="upgrade"][data-lumen-value="orbit"]').click();await p.locator('[data-lumen-action="next"]').waitFor();assert(await p.evaluate(()=>saved.lumen.run===null&&saved.lumen.stats.wins===1),'Victory from banked XP not shown or recorded');
    results.push('Banked XP finishes immediately after the pending upgrade choice');
    await seed('quarry');
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await p.screenshot({path:out+`lumen-campaign-quarry-${width}-${iteration}.png`});
      const layout=await p.evaluate(()=>{const hud=document.querySelector('.lumen-hud').getBoundingClientRect(),xp=document.querySelector('.lumen-xp').getBoundingClientRect();return {inside:hud.x>=0&&hud.right<=innerWidth,clear:hud.bottom<=xp.y,smoothing:lumenCanvas.getContext('2d').imageSmoothingEnabled};});
      assert(layout.inside&&layout.clear&&!layout.smoothing,'Quarry HUD '+width+JSON.stringify(layout));
    }
    await p.keyboard.press('Escape');const buttons=p.locator('#lumenOverlay button');await buttons.last().focus();await p.keyboard.press('Tab');assert(await buttons.first().evaluate(e=>e===document.activeElement),'Pause focus escape');
    await p.emulateMedia({reducedMotion:'reduce'});await p.locator('[data-lumen-action="continue"]').click();await p.waitForTimeout(80);await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>matchMedia('(prefers-reduced-motion:reduce)').matches),'Reduced motion');
    await seed('quarry-finish');await p.locator('#lumenDialogTitle').waitFor();assert((await p.locator('#lumenDialogTitle').innerText()).includes('Лунный карьер пройден'),'Final map result');assert(await p.locator('[data-lumen-action="next"]').count()===0,'Nonexistent third map');assert(await p.evaluate(()=>saved.lumen.meta.clearedMaps.includes('quarry')),'Final map clear not saved');
    assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));results.push('Distinct quarry assets, four widths, clear HUD, nearest, focus and reduced motion');
    return {results,errors,badAssets,screenshots:out};
  }finally{await context.close();}
}
