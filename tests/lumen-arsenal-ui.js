async (page) => {
  // Isolated QA fixtures: never a player's wallet or completed run.
  const base='http://127.0.0.1:8081',out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const context=await page.context().browser().newContext({viewport:{width:1440,height:900},hasTouch:true});
  const p=await context.newPage(),errors=[],badAssets=[],results=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/assets/lumen/')&&r.status()>=400)badAssets.push(r.url());});
  async function seed(kind){
    await p.evaluate(async kind=>{
      showScreen('home');const core=await import('/static/js/lumen/engine.mjs');
      const r=core.createRun({seed:71,character:'duelist',runId:'arsenal-browser-'+kind});
      if(kind==='showcase'){
        r.time=194;r.kills=308;r.level=16;r.xp=31;r.xpNext=136;r.spawnedGuardians=1;r.spawnedElites=2;r.spawnTimer=3;
        r.upgrades={orbit:3,spark:3,flame:3,ice:3,storm:3,thorn:3};r.player.hp=104;r.player.x=35;r.player.y=100;
        const spots=[[-120,-20,'crawler'],[130,75,'spitter'],[-170,150,'wisp'],[185,-110,'wasp'],[-240,-130,'beetle'],[70,-195,'mote'],[260,170,'beetle'],[-240,245,'crawler'],[310,-170,'spitter'],[-330,35,'wisp'],[100,270,'mote']];
        r.enemies=spots.map(([x,y,kind],i)=>({id:50+i,x,y,kind,hp:100,maxHp:100,radius:12,speed:25,damage:7,value:2,phase:i*.4,hitFlash:0,guardianStage:0,fireTimer:3,elite:false,slowTime:0,actionTimer:0}));
        r.enemies.push({id:70,x:270,y:-20,kind:'guardian',hp:1500,maxHp:1800,radius:31,speed:25,damage:22,value:60,phase:0,hitFlash:0,guardianStage:1,fireTimer:3,elite:false,slowTime:0,actionTimer:0});
        r.chests=[{id:80,x:-145,y:70,coins:60,upgrade:true,boss:true}];
        r.gems=[{x:95,y:200,value:2,tier:1},{x:-65,y:190,value:12,tier:2},{x:115,y:265,value:40,tier:3}];r.nextId=100;
      }else if(kind==='loot'){
        r.chests=[{id:1,x:0,y:0,coins:60,upgrade:true,boss:true}];r.nextId=2;
      }else if(kind==='upgrade'){
        r.status='upgrade';r.level=3;r.upgrades={orbit:2};r.choices=['orbit','flame','ice'];
      }
      if(!core.restore(core.serialize(r)))throw Error('Invalid arsenal fixture '+kind);
      saved.lumen={meta:{coins:80,unlocked:['scout','keeper','duelist']},run:core.serialize(r)};saveState();
    },kind);
    await p.reload();await p.locator('[data-resume="lumen"]').click();
    if(kind!=='upgrade')await p.locator('[data-lumen-action="continue"]').click();
    else await p.locator('.lumen-upgrade-dialog').waitFor({state:'visible'});
    await p.waitForTimeout(350);
  }
  try{
    await p.goto(base);await p.locator('[data-lumen-action="open"]').click();await p.locator('.lumen-roster').waitFor();
    assert(await p.locator('.lumen-roster button').count()===6,'Roster size');
    await p.locator('[data-lumen-action="character"][data-lumen-value="duelist"]').click();
    assert(await p.locator('[data-lumen-action="buy"]').isDisabled(),'Unaffordable purchase enabled');
    assert(await p.locator('[data-lumen-action="start"]').isDisabled(),'Locked hero starts');
    await p.locator('[data-lumen-action="character"][data-lumen-value="scout"]').click();
    for(const [width,height] of [[1440,900],[375,812],[768,1024],[1920,1080]]){
      await p.setViewportSize({width,height});
      // Reopen at each width to exercise the mobile launch placement.
      await p.evaluate(()=>showScreen('home'));await p.locator('[data-lumen-action="open"]').click();await p.locator('.lumen-roster').waitFor();await p.waitForTimeout(350);
      await p.screenshot({path:out+`lumen-arsenal-setup-${width}-v2.png`,fullPage:true});
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.lumen-brief').getBoundingClientRect().right<=innerWidth),'Setup overflow '+width);
      if(width===375)assert((await p.locator('[data-lumen-action="start"]').boundingBox()).y<812,'Launch below fold');
      await p.locator('.lumen-armory summary').click();assert(await p.locator('.lumen-armory article').count()===8,'Armory count');
      await p.locator('.lumen-roster').scrollIntoViewIfNeeded();await p.screenshot({path:out+`lumen-arsenal-roster-${width}-v2.png`});
    }
    await p.evaluate(()=>{saved.lumen.meta={coins:400,unlocked:['scout','keeper']};saveState();});
    await p.reload();await p.locator('[data-lumen-action="open"]').click();await p.locator('[data-lumen-action="character"][data-lumen-value="duelist"]').click();
    await p.locator('[data-lumen-action="buy"]').click();assert(await p.locator('#lumenWallet').innerText()==='80','Purchase not deducted');
    await p.locator('[data-lumen-action="start"]').click();await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.meta.coins===80&&saved.lumen.run.character==='duelist'&&saved.lumen.run.upgrades.orbit===1&&!saved.lumen.run.upgrades.spark),'Native weapon or wallet');
    await p.reload();await p.locator('[data-resume="lumen"]').click();assert(await p.evaluate(()=>saved.lumen.meta.unlocked.includes('duelist')),'Unlock not durable');
    results.push('Six heroes, paid unlock with exact deduction and durable native kit; eight-icon armory; setup four widths');

    await seed('loot');await p.waitForTimeout(100);await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.meta.coins===140&&saved.lumen.run.coinsEarned===60&&saved.lumen.run.upgrades.orbit===2),'Chest reward not saved');
    await p.reload();await p.locator('[data-resume="lumen"]').click();await p.locator('[data-lumen-action="continue"]').click();await p.waitForTimeout(80);await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.meta.coins===140&&saved.lumen.run.openedChests===1),'Resume duplicated coins');
    results.push('Real chest pickup, weapon stage, wallet autosave and reload without duplicate credit');

    await seed('showcase');await p.waitForTimeout(180);
    for(const [width,height] of [[1440,900],[375,812],[768,1024],[1920,1080]]){
      await p.setViewportSize({width,height});await p.screenshot({path:out+`lumen-arsenal-field-${width}-v2.png`});
      const info=await p.evaluate(()=>{const b=document.querySelector('.lumen-bottom').getBoundingClientRect(),slots=[...document.querySelectorAll('.lumen-slot')].map(e=>e.getBoundingClientRect());return {overflow:document.documentElement.scrollWidth>innerWidth,slots:slots.length,inside:slots.every(r=>r.x>=0&&r.right<=innerWidth)&&b.right<=innerWidth,smoothing:lumenCanvas.getContext('2d').imageSmoothingEnabled};});
      assert(!info.overflow&&info.inside&&!info.smoothing&&info.slots===6,'Six weapon dock at '+width+JSON.stringify(info));
    }
    await p.setViewportSize({width:375,height:812});await seed('upgrade');
    await p.screenshot({path:out+'lumen-arsenal-upgrade-375-v2.png'});
    assert((await p.locator('.lumen-upgrade-dialog').boundingBox()).height<812*.58,'Choice obscures field');
    await p.locator('[data-lumen-action="upgrade"][data-lumen-value="orbit"]').click();await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.run.upgrades.orbit===3),'Second upgrade did not give stage III');
    const buttons=p.locator('#lumenOverlay button');await buttons.last().focus();await p.keyboard.press('Tab');assert(await buttons.first().evaluate(e=>e===document.activeElement),'Focus trap');
    results.push('Six weapon dock on all four widths; compact stage III choice and pause keyboard focus');

    const animation=await p.evaluate(async()=>{
      const {Renderer}=await import('/static/js/lumen/renderer.mjs'),{loadArt}=await import('/static/js/lumen/assets.mjs'),{createRun,serialize}=await import('/static/js/lumen/engine.mjs');
      const art=await loadArt(),canvas=document.createElement('canvas');canvas.style.cssText='width:320px;height:320px;position:fixed;left:-900px';document.body.append(canvas);
      const renderer=new Renderer(canvas,art);renderer.resize();const r=createRun(),before=JSON.stringify(serialize(r));renderer.draw(r);
      const clips={};for(const actor of Object.keys(art.manifest.actors))for(const [name,clip] of Object.entries(art.manifest.animations)){
        const frames=new Set();for(let f=0;f<6;f++){
          renderer.ctx.fillStyle='#17262e';renderer.ctx.fillRect(0,0,canvas.width,canvas.height);
          renderer.actor(actor,name,0,0,140,(f+.1)/clip.fps,0);frames.add(canvas.toDataURL());
        }clips[actor+'-'+name]=frames.size;
      }
      const pure=before===JSON.stringify(serialize(r));renderer.destroy();canvas.remove();return {pure,clips};
    });
    assert(animation.pure&&Object.keys(animation.clips).length===75&&Object.values(animation.clips).every(n=>n>1),'Actor clips/renderer purity '+JSON.stringify(animation));
    await p.emulateMedia({reducedMotion:'reduce'});await seed('showcase');await p.waitForTimeout(80);await p.keyboard.press('Escape');
    assert(await p.locator('#lumenDialogTitle').isVisible(),'Reduced motion pause');
    assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));
    results.push('75 nonstatic actor clips (15 actors × 5 states), renderer purity, reduced motion, no page/asset errors');
    return {results,errors,badAssets,screenshots:out};
  }finally{await context.close();}
}
