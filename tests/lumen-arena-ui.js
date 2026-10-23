async(page)=>{
  const iteration='v4',root="C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/";
  const c=await page.context().browser().newContext({viewport:{width:1440,height:900},hasTouch:true}),p=await c.newPage(),errors=[],badAssets=[],checks=[];
  const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  const shot=name=>p.screenshot({path:root+'output/playwright/lumen-arena-'+name+'-'+iteration+'.png'});
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/assets/lumen/')&&r.status()>=400)badAssets.push(r.url());});
  const menu=id=>p.locator('.lumen-menu-nav [data-lumen-value="'+id+'"]').click();
  async function seed(kind){
    await p.evaluate(async kind=>{
      showScreen('home');
      const {createRun,step,serialize,restore}=await import('/static/js/lumen/engine.mjs');
      const {xpForLevel}=await import('/static/js/lumen/progression.mjs');
      const r=createRun({seed:701,character:'scout',map:'crater',runId:'arena-ui-'+kind});
      r.time=420;r.spawnedGuardians=3;r.spawnedElites=4;r.spawnTimer=3;r.level=40;r.xpNext=xpForLevel(40);
      r.upgrades={spark:8,orbit:8,pulse:8,flame:8,laurel:3,heart:3,aegis:3};r.foundWeapons=['orbit','pulse','flame'];r.masteredWeapons=['orbit','pulse','flame'];r.relicState.shield=3;
      step(r,{},1/60);
      if(kind!=='forming')for(let n=0;n<151;n++)step(r,{},1/60);
      if(['reward','celebrating'].includes(kind)){
        r.enemies.find(e=>e.kind==='arena-boss').hp=1;
        for(let n=0;n<120&&r.arena.phase==='fighting';n++)step(r,{},1/60);
        if(r.arena.phase!=='reward')throw Error('Boss not defeated');
      }
      if(kind==='celebrating'){r.player.x=r.arena.x;r.player.y=r.arena.y;step(r,{},1/60);}
      if(!restore(serialize(r)))throw Error('Bad arena fixture '+kind);
      saved.lumen={meta:{coins:400,clearedMaps:['garden','quarry']},run:serialize(r)};saveState();
    },kind);
    await p.reload();await p.locator('[data-resume="lumen"]').click();await p.locator('[data-lumen-action="continue"]').waitFor();
  }
  try{
    await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
    await p.goto('http://127.0.0.1:8081');
    await p.evaluate(()=>{saved.lumen={meta:{coins:400,clearedMaps:['garden']}};saveState();});await p.reload();
    await p.locator('[data-lumen-action="open"]').click();await menu('play');
    assert(await p.locator('[data-lumen-action="map"]').count()===3,'3 maps');
    assert(await p.locator('[data-lumen-value="crater"]').isDisabled(),'Crater requires quarry');
    assert((await p.locator('[data-lumen-value="crater"]').innerText()).includes('Лунный карьер'),'Correct unlock text');checks.push('Crater locked until quarry');
    await p.evaluate(()=>{saved.lumen.meta.clearedMaps=['garden','quarry'];saveState();});await p.reload();await p.locator('[data-lumen-action="open"]').click();
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await menu('play');await p.locator('[data-lumen-value="crater"]').click();await p.evaluate(()=>document.fonts.ready);await shot('menu-'+width);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Menu overflow '+width);
      const start=await p.locator('.lumen-shell [data-lumen-action="start"]').boundingBox(),navbar=await p.locator('.lumen-menu-nav').boundingBox();if(width===375)checks.push({mobileStartBottom:start.y+start.height,navbarTop:navbar.y});
      await seed('forming');await p.locator('[data-lumen-action="continue"]').click();await p.waitForTimeout(200);await shot('forming-'+width);
      assert(await p.locator('#lumenBossName').innerText()==='Матриарх разлома','Boss name');
      assert(await p.locator('#lumenBossMeter').getAttribute('aria-valuemax')==='36000','Boss HP');
      const bounds=await p.evaluate(()=>['.lumen-hud','.lumen-boss-hud','.lumen-wave'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {s,x:r.x,y:r.y,w:r.width,h:r.height};}));
      assert(bounds.every(b=>b.x>=0&&b.x+b.w<=width+1),'HUD fits '+width);
      assert(bounds[0].y+bounds[0].h<bounds[1].y&&bounds[1].y+bounds[1].h<bounds[2].y,'HUD overlaps '+width+' '+JSON.stringify(bounds));
      await p.waitForTimeout(2500);await shot('fighting-'+width);await p.keyboard.press('Escape');
      assert(await p.evaluate(()=>saved.lumen.run.level===40&&saved.lumen.run.status==='playing'&&saved.lumen.run.arena.phase==='fighting'&&saved.lumen.run.enemies.filter(e=>e.kind==='arena-tick').length===32),'Actual fighting at40');
      const hp=await p.evaluate(()=>saved.lumen.run.enemies.find(e=>e.kind==='arena-boss').hp);
      await p.reload();await p.locator('[data-resume="lumen"]').click();
      assert(await p.evaluate(()=>saved.lumen.run.enemies.find(e=>e.kind==='arena-boss').hp)===hp,'Reload keeps boss HP');
      await p.locator('[data-lumen-action="continue"]').click();await p.keyboard.down('a');await p.waitForTimeout(170);await p.keyboard.up('a');await p.keyboard.press('Escape');
      assert(await p.evaluate(()=>saved.lumen.run.player.x<0),'Keyboard works in arena');
      await seed('reward');await p.locator('[data-lumen-action="continue"]').click();await shot('reward-'+width);await p.keyboard.press('Escape');
      assert(await p.evaluate(()=>saved.lumen.run.arena.phase==='reward'&&saved.lumen.run.enemies.length===0&&saved.lumen.run.chests.length===1&&saved.lumen.run.chests[0].coins===800),'One mega chest, no ticks');
      await seed('celebrating');await p.locator('[data-lumen-action="continue"]').click();await p.waitForTimeout(500);await shot('fountain-'+width);await p.keyboard.press('Escape');
      assert(await p.evaluate(()=>saved.lumen.run.coinsEarned===800&&saved.lumen.run.openedChests===1&&saved.lumen.meta.coins===1200),'Reward800exact once');
      await p.reload();await p.locator('[data-resume="lumen"]').click();await p.locator('[data-lumen-action="continue"]').click();
      await p.locator('#lumenDialogTitle').filter({hasText:'Кратер роя пройден'}).waitFor();await shot('result-'+width);
      assert(await p.evaluate(()=>saved.lumen.meta.coins===1200&&saved.lumen.meta.clearedMaps.includes('crater')&&saved.lumen.run===null),'Won saved after3s; no duplicate reward');checks.push(width+'px HUD/phases/HP/reload800/result');
      await p.locator('[data-lumen-action="exit"]').click();
    }
    await p.setViewportSize({width:375,height:812});await seed('fighting');await p.locator('[data-lumen-action="continue"]').click();
    const touch=await c.newCDPSession(p);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:550,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:210,y:575,id:1}]});await p.waitForTimeout(180);
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.keyboard.press('Escape');await touch.detach();
    assert(await p.evaluate(()=>saved.lumen.run.player.x>0&&saved.lumen.run.player.y>0),'Touch joystick arena');
    const controls=p.locator('#lumenOverlay button,#lumenOverlay summary');await controls.last().focus();await p.keyboard.press('Tab');assert(await controls.first().evaluate(e=>e===document.activeElement),'Pause focus trap');
    await p.emulateMedia({reducedMotion:'reduce'});await seed('fighting');await p.locator('[data-lumen-action="continue"]').click();await p.waitForTimeout(180);await shot('reduced-motion');await p.keyboard.press('Escape');
    assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));checks.push('Native touch, focus trap, reduced motion');
    return {iteration,checks,errors,badAssets};
  }finally{await c.close();}
}
