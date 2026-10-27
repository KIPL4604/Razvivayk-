async (page, options = {}) => {
  const iteration=options.iteration||'v4',out=options.output||'D:/Codex-artifacts/lumen-castle-20261028/';
  const context=await page.context().browser().newContext({viewport:{width:1440,height:900},hasTouch:true});
  const p=await context.newPage(),errors=[],badAssets=[],checks=[];
  const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  const shot=(name,width)=>p.screenshot({path:out+'castle-'+name+'-'+width+'-'+iteration+'.png'});
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.url().includes('/assets/lumen/')&&r.status()>=400)badAssets.push({url:r.url(),status:r.status()});});
  const menu=id=>p.locator('.lumen-menu-nav [data-lumen-value="'+id+'"]').click();
  async function seed(kind){
    await p.evaluate(async kind=>{
      showScreen('home');
      const core=await import('/static/js/lumen/engine.mjs'),{xpForLevel}=await import('/static/js/lumen/progression.mjs');
      const {CASTLE,updateCastleGoal}=await import('/static/js/lumen/castle.mjs');
      const r=core.createRun({seed:527,character:'scout',map:'castle',runId:'castle-browser-'+kind});
      r.time=420;r.spawnedGuardians=3;r.spawnedElites=4;r.spawnTimer=3;
      const ordinary=['corridor','actors','conductor','gatekeeper'].includes(kind);
      r.level=ordinary?44:45;r.xpNext=xpForLevel(r.level);r.player.x=345;r.player.y=420;
      r.upgrades={spark:8,orbit:8,pulse:8,flame:8,laurel:3,heart:3,aegis:3};
      r.foundWeapons=['orbit','pulse','flame'];r.masteredWeapons=['orbit','pulse','flame'];r.relicState.shield=3;
      updateCastleGoal(r);
      if(['actors','conductor','gatekeeper'].includes(kind)){
        r.upgrades={spark:1};r.foundWeapons=[];r.masteredWeapons=[];r.relicState.shield=0;r.player.y=500;
        const spots=kind==='actors'?[[190,420,'palace-guard'],[450,690,'wax-servant'],[120,880,'paper-moth']]:[[200,450,'guardian']];
        r.enemies=spots.map(([x,y,enemyKind],i)=>({id:10+i,x,y,kind:enemyKind,hp:8000,maxHp:8000,radius:enemyKind==='guardian'?40:15,speed:0,damage:7,value:12,phase:i*.3,hitFlash:0,guardianStage:enemyKind==='guardian'?1:0,fireTimer:3,elite:false,slowTime:0,actionTimer:0,...(enemyKind==='guardian'?{bossType:kind,attackStage:0}:{})}));
        r.nextId=100;
      }else if(kind==='corridor'||kind==='guidance'){
        const spots=[[170,320,'palace-guard'],[480,580,'wax-servant'],[120,600,'paper-moth']];
        r.enemies=spots.map(([x,y,kind],i)=>({id:10+i,x,y,kind,hp:2000,maxHp:2000,radius:15,speed:20,damage:7,value:12,phase:i*.3,hitFlash:0,guardianStage:0,fireTimer:3,elite:false,slowTime:0,actionTimer:0}));
        r.nextId=100;
        r.gems=[{x:300,y:510,value:2,tier:1},{x:390,y:550,value:12,tier:2}];
      }else{
        r.player.x=0;r.player.y=CASTLE.bossY+450;
        core.step(r,{},1/60);
        if(kind!=='forming')for(let n=0;n<151;n++)core.step(r,{},1/60);
        if(['reward','celebrating'].includes(kind)){
          r.enemies.find(e=>e.kind==='arena-boss').hp=1;
          for(let n=0;n<240&&r.arena.phase==='fighting';n++)core.step(r,{},1/60);
          if(r.arena.phase!=='reward')throw Error('Prepared monarch was not defeated');
          if(kind==='celebrating'){r.player.x=r.arena.x;r.player.y=r.arena.y;core.step(r,{},1/60);}
        }
      }
      const snapshot=core.serialize(r);if(!core.restore(snapshot))throw Error('Invalid castle fixture '+kind);
      saved.lumen={meta:{coins:400,clearedMaps:['garden','quarry']},run:snapshot};saveState();
    },kind);
    await p.reload();await p.locator('[data-resume="lumen"]').click();
    await p.locator('[data-lumen-action="continue"]').click();await p.waitForTimeout(180);
  }
  try{
    await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
    await p.goto('http://127.0.0.1:8081');
    await p.evaluate(()=>{saved.lumen={meta:{coins:400,clearedMaps:['garden']}};saveState();});await p.reload();
    await p.locator('[data-lumen-action="open"]').click();await menu('play');
    assert(await p.locator('[data-lumen-action="map"]').count()===3,'Exactly three selectable worlds');
    assert(await p.locator('[data-lumen-action="map"][data-lumen-value="crater"]').count()===0,'Legacy crater is resume-only');
    assert(await p.locator('[data-lumen-action="map"][data-lumen-value="castle"]').isDisabled(),'Castle locked until quarry');
    assert((await p.locator('[data-lumen-action="map"][data-lumen-value="castle"]').innerText()).includes('Лунный карьер'),'Unlock explains quarry');
    checks.push('Three worlds; legacy crater hidden; castle requires quarry');
    await p.evaluate(()=>{saved.lumen.meta.clearedMaps=['garden','quarry'];saveState();});await p.reload();await p.locator('[data-lumen-action="open"]').click();
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await menu('play');await p.locator('[data-lumen-action="map"][data-lumen-value="castle"]').click();
      await p.evaluate(()=>document.fonts.ready);await shot('menu',width);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Menu width '+width);
      assert((await p.locator('[data-lumen-action="map"][data-lumen-value="castle"]').innerText()).includes('45'),'Castle level45 menu copy');
      await seed('corridor');await shot('corridor',width);
      assert(await p.locator('#lumenGameMount').getAttribute('data-map')==='castle','Castle visual scope');
      assert(await p.evaluate(()=>document.querySelector('.lumen-xp').getBoundingClientRect().top>document.querySelector('.lumen-hud').getBoundingClientRect().bottom),'XP remains below the main HUD '+width);
      const before=await p.evaluate(()=>saved.lumen.run.player.x);
      await p.keyboard.down('a');await p.waitForTimeout(180);await p.keyboard.up('a');await p.keyboard.press('Escape');
      assert(await p.evaluate(before=>saved.lumen.run.player.x<before,before),'Keyboard works '+width);
      await seed('guidance');await shot('guidance',width);
      assert(await p.locator('#lumenGameMount').getAttribute('data-guidance')==='true','Guidance appears at45');
      assert((await p.locator('#lumenWave').innerText()).includes('СТРЕЛКОЙ'),'Guidance announced');
      await p.keyboard.press('Escape');await p.reload();await p.locator('[data-resume="lumen"]').click();await p.locator('[data-lumen-action="continue"]').click();
      assert(await p.locator('#lumenGameMount').getAttribute('data-guidance')==='true','Guidance survives reload');
      await seed('forming');await shot('forming',width);
      assert(await p.locator('#lumenBossName').innerText()==='Полый монарх','Monarch name');
      assert(await p.locator('#lumenBossMeter').getAttribute('aria-valuemax')==='52000','Actual final-boss HP');
      const boxes=await p.evaluate(()=>['.lumen-hud','.lumen-boss-hud','.lumen-wave'].map(selector=>{const b=document.querySelector(selector).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};}));
      assert(boxes.every(b=>b.x>=0&&b.x+b.w<=width+1),'HUD horizontal bounds '+width);
      assert(boxes[0].y+boxes[0].h<boxes[1].y&&boxes[1].y+boxes[1].h<boxes[2].y,'HUD vertical separation '+width);
      const framing=await p.evaluate(async()=>{
        const {Renderer}=await import('/static/js/lumen/renderer.mjs'),{loadArt}=await import('/static/js/lumen/assets.mjs');
        const {restore}=await import('/static/js/lumen/engine.mjs'),run=restore(saved.lumen.run),art=await loadArt();
        const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;opacity:0;pointer-events:none';document.body.append(canvas);
        const renderer=new Renderer(canvas,art);renderer.resize();
        const top=document.querySelector('#lumenWave').getBoundingClientRect().bottom+20,bottom=document.querySelector('.lumen-bottom').getBoundingClientRect().top-22;
        renderer.castleInsets={top,bottom};renderer.draw(run);
        const actor=art.manifest.actors['boss-monarch'],anchor=actor.anchor[1]/actor.frameSize;
        const boss=run.enemies.find(e=>e.kind==='arena-boss');
        const bossTop=renderer.at(boss.x,boss.y+7-620*anchor)[1]/renderer.dpr;
        const heroBottom=renderer.at(run.player.x,run.player.y+14)[1]/renderer.dpr;
        const result={top,bottom,bossTop,heroBottom,scale:renderer.scale};renderer.destroy();canvas.remove();return result;
      });
      assert(framing.bossTop>=framing.top-2&&framing.heroBottom<=framing.bottom+2,'Monarch crown/hero framing '+width+' '+JSON.stringify(framing));
      await seed('fighting');await p.waitForTimeout(2100);await shot('ring',width);await p.keyboard.press('Escape');
      assert(await p.evaluate(()=>saved.lumen.run.arena.kind==='castle'&&saved.lumen.run.arena.phase==='fighting'),'Castle boss is fighting');
      await seed('reward');await shot('reward',width);await p.keyboard.press('Escape');
      assert(await p.evaluate(()=>saved.lumen.run.arena.phase==='reward'&&saved.lumen.run.enemies.length===0&&saved.lumen.run.chests.length===1&&saved.lumen.run.chests[0].coins===800&&!saved.lumen.run.projectiles.some(p=>p.hostile)),'One reward chest, defeated monarch, cleared hostile projectiles');
      await seed('celebrating');await p.waitForTimeout(400);await shot('fountain',width);await p.keyboard.press('Escape');
      assert(await p.evaluate(()=>saved.lumen.run.coinsEarned===800&&saved.lumen.run.openedChests===1&&saved.lumen.meta.coins===1200),'Exactly800 coins through the real chest');
      await p.reload();await p.locator('[data-resume="lumen"]').click();await p.locator('[data-lumen-action="continue"]').click();
      await p.locator('#lumenDialogTitle').filter({hasText:'Замок угасшего света пройден'}).waitFor();await shot('result',width);
      assert((await p.locator('#lumenOverlay').innerText()).includes('Полый монарх повержен'),'Castle-specific result copy');
      assert(await p.evaluate(()=>saved.lumen.run===null&&saved.lumen.meta.coins===1200&&saved.lumen.meta.clearedMaps.includes('castle')),'Victory recorded after reload without duplicate reward');
      checks.push(width+'px menu/corridor/guidance/reload/monarch/HUD/keyboard/reward800/fountain/reload/result');
      await p.locator('[data-lumen-action="exit"]').click();
    }
    for(const [width,height] of [[375,812],[1440,900]]){
      await p.setViewportSize({width,height});
      for(const kind of ['actors','conductor','gatekeeper']){
        await seed(kind);await shot(kind,width);
        if(kind!=='actors')assert(await p.locator('#lumenBossName').innerText()===(kind==='conductor'?'Капельмейстер':'Латунный привратник'),'Mini-boss name '+kind);
        await p.keyboard.press('Escape');
        assert(await p.evaluate(kind=>kind==='actors'?saved.lumen.run.enemies.some(e=>e.kind==='palace-guard')&&saved.lumen.run.enemies.some(e=>e.kind==='wax-servant')&&saved.lumen.run.enemies.some(e=>e.kind==='paper-moth'):saved.lumen.run.enemies.some(e=>e.bossType===kind),kind),'Actors persist in a valid run '+kind);
      }
      checks.push(width+'px ordinary3actors/conductor/gatekeeper prepared snapshots');
    }
    await p.setViewportSize({width:375,height:812});await seed('corridor');
    const touch=await context.newCDPSession(p);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:510,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:208,y:530,id:1}]});await p.waitForTimeout(180);
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.keyboard.press('Escape');await touch.detach();
    assert(await p.evaluate(()=>saved.lumen.run.player.x>345&&saved.lumen.run.player.y>420),'Native joystick works');
    const controls=p.locator('#lumenOverlay button,#lumenOverlay summary');await controls.last().focus();await p.keyboard.press('Tab');
    assert(await controls.first().evaluate(e=>e===document.activeElement),'Pause focus trap');
    await p.emulateMedia({reducedMotion:'reduce'});await seed('guidance');await shot('reduced-motion',375);await p.keyboard.press('Escape');
    const purity=await p.evaluate(async()=>{
      const {Renderer}=await import('/static/js/lumen/renderer.mjs'),{loadArt}=await import('/static/js/lumen/assets.mjs');
      const {restore,serialize}=await import('/static/js/lumen/engine.mjs');
      const run=restore(saved.lumen.run),before=JSON.stringify(serialize(run));
      const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:375px;height:812px;z-index:10000';document.body.append(canvas);
      const renderer=new Renderer(canvas,await loadArt());renderer.resize();renderer.captureTick(run);
      for(let n=0;n<8;n++)renderer.draw(run);
      const result={unchanged:before===JSON.stringify(serialize(run)),heroCss:96*renderer.scale};
      renderer.destroy();canvas.remove();return result;
    });
    assert(purity.unchanged,'Renderer must not mutate serialized state');
    assert(purity.heroCss>=40,'Mobile exploration hero remains readable');
    assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));
    checks.push('Native touch, pause focus, reduced motion, pure rendering, mobile actor scale');
    return {iteration,checks,purity,errors,badAssets,output:out};
  }finally{await context.close();}
}
