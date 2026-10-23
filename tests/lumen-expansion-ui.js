async(page)=>{
  const iteration='v3';
  const root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/';
  const context=await page.context().browser().newContext({viewport:{width:1440,height:900},hasTouch:true});
  const p=await context.newPage(),errors=[],badAssets=[],checks=[];
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const shot=name=>p.screenshot({path:root+`output/playwright/lumen-expansion-${name}-${iteration}.png`});
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/assets/lumen/')&&r.status()>=400)badAssets.push(r.url());});
  async function menu(section){await p.locator(`.lumen-menu-nav [data-lumen-value="${section}"]`).click();}
  async function seed(kind){
    await p.evaluate(async kind=>{
      showScreen('home');const {createRun,step,serialize,restore}=await import('/static/js/lumen/engine.mjs');
      const {xpForLevel}=await import('/static/js/lumen/progression.mjs');
      const r=createRun({seed:189,map:'quarry',character:'astronomer',runId:'expansion-'+kind});
      r.time=76;r.spawnedGuardians=3;r.spawnedElites=4;r.spawnTimer=3;r.level=20;r.xpNext=xpForLevel(20);
      r.upgrades={spark:2};r.foundWeapons=['spark'];
      if(kind==='rarities'){r.status='upgrade';r.choices=['needle','drone','sunlance'];}
      else if(kind==='full'){
        r.upgrades={spark:2,fan:2,meteor:2,eclipse:2,laurel:1,heart:1,carapace:1,ember:1,hourglass:1};
        r.foundWeapons=['spark','fan','eclipse'];r.relicState.shield=1;r.status='upgrade';r.choices=['fan','laurel','heart'];
      }else if(kind==='fusion'){
        r.upgrades={spark:8,ice:8,meteor:2,orbit:2};r.foundWeapons=['spark','ice','orbit'];r.xp=r.xpNext;step(r,{},1/60);
        if(!r.choices.includes('prism'))throw Error('Real fusion missing');
      }else if(kind==='legacy'){
        r.version=6;delete r.relicState;delete r.archivedWeapons;
        r.upgrades={meteor:3,spark:8,ice:8,pulse:7,flame:5,storm:4};r.foundWeapons=['spark','ice','pulse','flame','storm'];r.masteredWeapons=['spark','ice'];
      }else{
        const groups={projectiles:['needle','fan','frostnova','drone'],zones:['mine','meteor','gravity','bell'],legendary:['sunlance','eclipse','prism','orbit']};
        r.upgrades=Object.fromEntries(groups[kind].map(id=>[id,id==='prism'?1:3]));
        r.upgrades.laurel=2;r.upgrades.heart=1;r.upgrades.carapace=1;r.upgrades.ember=1;r.upgrades.hourglass=1;r.relicState.shield=2;
        r.foundWeapons=groups[kind].filter(id=>id!=='prism'&&id!=='meteor');
        r.enemies=Array.from({length:14},(_,i)=>({id:100+i,kind:['quartzling','moonmoth','shardback','crawler'][i%4],x:Math.cos(i/14*Math.PI*2)*(160+i*7),y:Math.sin(i/14*Math.PI*2)*(160+i*7),hp:3000,maxHp:3000,radius:12,speed:6,damage:7,value:12,phase:i*.2,hitFlash:0,guardianStage:0,fireTimer:3,slowTime:0,actionTimer:0,elite:false}));
        r.projectiles=[{id:200,x:-45,y:0,vx:90,vy:0,radius:3,damage:999,life:2,hostile:true,weapon:'hostile',pierce:0,hits:[],returning:false}];r.nextId=300;
      }
      if(!restore(serialize(r)))throw Error('Invalid fixture '+kind);
      saved.lumen={meta:{coins:2000,unlocked:['scout','keeper','astronomer'],clearedMaps:['garden']},run:serialize(r)};saveState();
    },kind);
    await p.reload();await p.locator('[data-resume="lumen"]').click();
    await p.locator(['rarities','full','fusion'].includes(kind)?'.lumen-upgrade-dialog':'[data-lumen-action="continue"]').waitFor();
    if(!['rarities','full','fusion','legacy'].includes(kind))await p.locator('[data-lumen-action="continue"]').click();
  }
  try{
    await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
    await p.goto('http://127.0.0.1:8081');await p.evaluate(()=>{saved.lumen={meta:{coins:2000,clearedMaps:['garden'],weaponBest:{sunlance:8}}};saveState();});await p.reload();
    await p.locator('[data-lumen-action="open"]').click();await menu('characters');
    assert(await p.locator('.lumen-roster button').count()===12,'12 fighters');
    await p.locator('[data-lumen-action="character"][data-lumen-value="heliarch"]').click();
    assert(await p.locator('[data-lumen-action="buy"]').isEnabled(),'Heliarch eligible');await p.locator('[data-lumen-action="buy"]').click();
    assert(await p.locator('#lumenWallet').innerText()==='900','Exact1100 price');
    await menu('play');await p.locator('[data-lumen-action="start"]').click();await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.run.character==='heliarch'&&saved.lumen.run.upgrades.sunlance===1),'Native legendary starts alone');
    await p.locator('[data-lumen-action="exit"]').click();await p.locator('#toast').waitFor({state:'hidden'});checks.push('12 heroes; earned purchase1100; native sunlance; pause/menu');
    for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await menu('weapons');await shot('book-'+width);
      assert(await p.locator('.lumen-library article').count()===20,'20 base weapons');
      assert(await p.locator('.lumen-rarity-legend span').count()===4,'Four named rarities');
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Book overflow '+width);
      await p.locator('.lumen-library [data-rarity="legendary"]').last().scrollIntoViewIfNeeded();await shot('legendary-book-'+width);
      await p.locator('[data-lumen-action="book"][data-lumen-value="artifacts"]').click();
      assert(await p.locator('.lumen-library article').count()===10,'10 artifacts');await shot('artifacts-'+width);
      await menu('characters');await p.locator('[data-lumen-action="character"][data-lumen-value="astronomer"]').click();await shot('hero-'+width);
      await menu('weapons');await p.locator('[data-lumen-action="book"][data-lumen-value="weapons"]').click();
      await seed('rarities');await shot('choices-'+width);
      assert(await p.locator('[data-lumen-action="upgrade"][data-rarity="legendary"]').count()===1,'Named legendary choice');
      assert(await p.locator('[data-lumen-value="sunlance"]').innerText().then(s=>s.includes('Легендарное')),'Rarity text');
      const box=await p.locator('.lumen-upgrade-dialog').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,'Choice dialog fits '+width);
      await p.locator('[data-lumen-value="sunlance"]').click();await p.keyboard.press('Escape');
      assert(await p.evaluate(()=>saved.lumen.run.upgrades.sunlance===1),'Legendary equip');
      await seed('full');await p.locator('[data-lumen-value="laurel"]').click();await p.keyboard.press('Escape');
      assert(await p.locator('.lumen-slot').count()===4&&await p.locator('.lumen-relic-slot').count()===5,'4/5 equipment');
      assert(await p.evaluate(()=>saved.lumen.run.relicState.shield===2),'Laurel upgrade adds charge');await shot('full-kit-'+width);
      await p.reload();await p.locator('[data-resume="lumen"]').click();
      assert(await p.evaluate(()=>saved.lumen.run.relicState.shield===2),'Reload preserves charges');
      const focus=p.locator('#lumenOverlay button,#lumenOverlay summary');await focus.last().focus();await p.keyboard.press('Tab');
      assert(await focus.first().evaluate(e=>e===document.activeElement),'Focus trap');
      await seed('fusion');await shot('fusion-'+width);await p.locator('[data-lumen-value="prism"]').click();await p.keyboard.press('Escape');
      assert(await p.evaluate(()=>saved.lumen.run.upgrades.prism===1&&!saved.lumen.run.upgrades.spark&&!saved.lumen.run.upgrades.ice),'Fusion real replacement');
      assert(await p.locator('.lumen-slot').count()===3,'Fusion frees slot');
      for(const group of ['projectiles','zones','legendary']){
        await seed(group);
        if(group==='legendary'){await p.waitForTimeout(60);await shot('legendary-flash-'+width);}
        await p.waitForTimeout(group==='zones'?350:650);await shot(group+'-'+width);await p.keyboard.press('Escape');
        assert(await p.evaluate(()=>saved.lumen.run.player.hp===saved.lumen.run.player.maxHp),'Shield blocks lethal projectile');
        assert(await p.evaluate(async()=>Boolean((await import('/static/js/lumen/engine.mjs')).restore(saved.lumen.run))),'Combat saves '+group);
      }
      checks.push(width+'px book/artifacts/hero/choices/4-5/reload/fusion/3combat groups');
      await p.locator('[data-lumen-action="exit"]').click();
    }
    await seed('legacy');assert((await p.locator('.lumen-migration-note').innerText()).includes('В архив'),'Visible legacy notice');await shot('legacy');
    assert(await p.locator('.lumen-slot').count()===4,'Legacy active cap');
    await p.locator('[data-lumen-action="continue"]').click();await p.keyboard.down('ArrowRight');await p.waitForTimeout(150);await p.keyboard.up('ArrowRight');await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.run.player.x>0),'Real keyboard movement');
    await p.setViewportSize({width:375,height:812});await seed('zones');
    const touch=await context.newCDPSession(p);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:570,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:170,y:570,id:1}]});await p.waitForTimeout(180);
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.run.player.x>0),'Native touch joystick movement');await touch.detach();checks.push('Native touch and keyboard input');
    await p.emulateMedia({reducedMotion:'reduce'});await seed('zones');await p.waitForTimeout(200);await shot('reduced-motion');await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>!document.getAnimations().some(a=>a.effect.getTiming().iterations===Infinity)),'No infinite reduced motion animations');
    assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));
    return {iteration,checks,errors,badAssets,screenshots:root+'output/playwright/'};
  }finally{await context.close();}
}
