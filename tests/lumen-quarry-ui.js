async (page) => {
  const iteration='v1';
  const root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/';
  const out=root+'output/playwright/',base='http://127.0.0.1:8081';
  const context=await page.context().browser().newContext({viewport:{width:1440,height:900},hasTouch:true});
  const p=await context.newPage(),errors=[],badAssets=[],results=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/assets/lumen/')&&r.status()>=400)badAssets.push(r.url());});
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const shot=async(name,width)=>p.screenshot({path:out+`lumen-quarry-${name}-${width}-${iteration}.png`});
  async function seed(kind){
    await p.evaluate(async kind=>{
      showScreen('home');const core=await import('/static/js/lumen/engine.mjs');
      const r=core.createRun({seed:47,map:'quarry',character:kind==='combat'?'artificer':'scout',runId:'quarry-browser-'+kind});
      r.time=76;r.spawnedGuardians=3;r.spawnedElites=4;r.spawnTimer=3;r.level=22;r.xp=0;
      const {xpForLevel}=await import('/static/js/lumen/progression.mjs');r.xpNext=xpForLevel(r.level);
      if(kind==='fusion'){
        r.upgrades={spark:8,ice:8,orbit:3,flame:3,storm:3,pulse:3};r.foundWeapons=['ice','orbit','flame','storm','pulse'];
        r.xp=r.xpNext;core.step(r,{},1/60);if(!r.choices.includes('prism'))throw Error('Real level did not offer ready fusion');
        r.choices=['prism','collector','chronogear'];
      }else if(kind==='artifacts'){
        r.upgrades={spark:1,aegis:1};r.status='upgrade';r.choices=['collector','chronogear','amplifier'];
      }else{
        r.player.y=120;
        r.upgrades={chakram:3,spear:3,cyclone:2,briar:1,sunrise:1,collector:2,chronogear:2,amplifier:2,aegis:2};r.foundWeapons=['spear'];
        const spots=[[-120,50,'quartzling'],[160,90,'shardback'],[-175,-65,'moonmoth'],[240,-50,'moonmoth'],[65,240,'quartzling'],[-260,175,'shardback'],[300,190,'crawler'],[-260,-170,'beetle'],[135,-220,'spitter']];
        r.enemies=spots.map(([x,y,kind],i)=>({id:10+i,x,y,kind,hp:1500,maxHp:1500,radius:kind==='shardback'?21:12,speed:20,damage:7,value:12,phase:i*.3,hitFlash:0,guardianStage:0,fireTimer:kind==='quartzling'?.1:kind==='shardback'?.3:1,elite:false,slowTime:0,actionTimer:0}));
        r.gems=[{x:120,y:150,value:2,tier:1},{x:-90,y:170,value:12,tier:2},{x:185,y:190,value:40,tier:3}];r.nextId=100;
      }
      if(!core.restore(core.serialize(r)))throw Error('Invalid quarry QA fixture '+kind);
      saved.lumen={meta:{coins:600,unlocked:['scout','keeper','artificer','sentinel'],clearedMaps:['garden']},run:core.serialize(r)};saveState();
    },kind);
    await p.reload();await p.locator('[data-resume="lumen"]').click();
    if(kind==='combat')await p.locator('[data-lumen-action="continue"]').click();
    else await p.locator('.lumen-upgrade-dialog').waitFor();
    await p.waitForTimeout(250);
  }
  try{
    await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(base);await p.evaluate(()=>{saved.lumen={meta:{coins:600,clearedMaps:['garden']}};saveState();});await p.reload();
    await p.locator('[data-lumen-action="open"]').click();await p.locator('.lumen-menu-nav [data-lumen-value="characters"]').click();await p.locator('.lumen-roster').waitFor();
    assert(await p.locator('.lumen-roster button').count()===8,'Eight fighter roster');await p.locator('.lumen-menu-nav [data-lumen-value="play"]').click();await p.locator('[data-lumen-action="map"][data-lumen-value="quarry"]').click();
    for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await p.evaluate(()=>showScreen('home'));await p.locator('[data-lumen-action="open"]').click();
      await p.locator('.lumen-menu-nav [data-lumen-value="play"]').click();await p.locator('[data-lumen-action="map"][data-lumen-value="quarry"]').click();await p.evaluate(()=>{document.querySelector('#main').scrollTop=0;});await p.waitForTimeout(150);await shot('setup',width);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Setup horizontal overflow '+width);
    }
    await p.setViewportSize({width:1440,height:900});await p.locator('.lumen-menu-nav [data-lumen-value="weapons"]').click();await shot('book',1440);
    assert(await p.locator('.lumen-library article').count()===10,'Ten base weapons');await p.locator('[data-lumen-action="book"][data-lumen-value="hybrids"]').click();assert(await p.locator('.lumen-recipes-list article').count()===4,'Four recipes');await p.locator('[data-lumen-action="book"][data-lumen-value="artifacts"]').click();assert(await p.locator('.lumen-library article').count()===4,'Four artifacts');
    await p.evaluate(()=>{saved.lumen.meta={coins:600,weaponBest:{chakram:8},clearedMaps:['garden']};saveState();});await p.reload();
    await p.locator('[data-lumen-action="open"]').click();await p.locator('.lumen-menu-nav [data-lumen-value="characters"]').click();await p.locator('[data-lumen-action="character"][data-lumen-value="artificer"]').click();
    assert(await p.locator('[data-lumen-action="buy"]').isEnabled(),'Earned mechanic purchase');await p.locator('[data-lumen-action="buy"]').click();
    assert(await p.locator('#lumenWallet').innerText()==='60','Exact 540-coin purchase');await p.locator('.lumen-menu-nav [data-lumen-value="play"]').click();await p.locator('[data-lumen-action="start"]').click();await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.run.character==='artificer'&&saved.lumen.run.upgrades.chakram===1),'Native chakram');
    results.push('Eight fighters; exact purchase, native attack; setup four widths; recipe/artifact encyclopedia');

    for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await seed('fusion');await shot('fusion',width);
      const fit=await p.locator('.lumen-upgrade-dialog').boundingBox();assert(fit.x>=0&&fit.x+fit.width<=width+1&&fit.height<height*.6,'Fusion dialog fit '+width);
      assert((await p.locator('[data-lumen-value="prism"]').innerText()).includes('Соединить VIII + VIII → I'),'Explicit fusion action');
      await p.locator('[data-lumen-value="prism"]').click();await p.waitForTimeout(60);await p.keyboard.press('Escape');
      assert(await p.evaluate(()=>saved.lumen.run.upgrades.prism===1&&!saved.lumen.run.upgrades.spark&&!saved.lumen.run.upgrades.ice&&saved.lumen.run.masteredWeapons.includes('ice')),'Fusion kit/mastery save');
      assert(await p.locator('.lumen-slot').count()===5,'Fusion frees one slot');
      await p.reload();await p.locator('[data-resume="lumen"]').click();await p.locator('.lumen-slot.prism').waitFor();assert(await p.locator('.lumen-slot.prism').count()===1,'Fusion survives reload');
      const focusables=p.locator('#lumenOverlay button,#lumenOverlay summary');await focusables.last().focus();await p.keyboard.press('Tab');assert(await focusables.first().evaluate(e=>e===document.activeElement),'Pause keyboard trap');
    }
    results.push('Real ready recipe offered at level-up; fusion click replaces pair with I and frees slot; mastery and save survive reload; keyboard trap');

    await p.setViewportSize({width:375,height:812});await seed('artifacts');await shot('artifacts',375);
    await p.locator('[data-lumen-value="collector"]').click();await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.run.upgrades.collector===1&&saved.lumen.run.pickupRadius===148),'Collector actual radius');
    assert(await p.locator('.lumen-relic-slot').count()===2,'Separate artifact dock');await p.locator('.lumen-recipes summary').click();await shot('pause',375);
    await p.setViewportSize({width:1440,height:900});await seed('artifacts');await shot('artifacts',1440);
    results.push('Artifact choice, actual pickup radius and separate passive dock; pause recipe list and effects');

    for(const [width,height]of [[1440,900],[375,812],[768,1024],[1920,1080]]){
      await p.setViewportSize({width,height});await seed('combat');await p.waitForTimeout(500);await shot('combat',width);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&!lumenCanvas.getContext('2d').imageSmoothingEnabled),'Combat overflow/smoothing '+width);
      assert(await p.locator('.lumen-relic-slot').count()===4,'All four passives');
      const dock=await p.locator('.lumen-equipment').boundingBox();assert(dock.x>=0&&dock.x+dock.width<=width,'Equipment fit '+width);
      await p.keyboard.press('Escape');
      assert(await p.evaluate(async()=>{const {restore}=await import('/static/js/lumen/engine.mjs');return Boolean(restore(saved.lumen.run));}),'New combat entities resume '+width);
    }
    await p.emulateMedia({reducedMotion:'reduce'});await seed('combat');await p.waitForTimeout(250);await p.keyboard.press('Escape');await shot('reduced-motion',1920);
    results.push('Quarry enemies, telegraphs, hybrid attacks, artifact dock on four widths; valid combat snapshot; reduced motion');
    await p.emulateMedia({reducedMotion:'no-preference'});
    const animations=await p.evaluate(async()=>{
      const {Renderer}=await import('/static/js/lumen/renderer.mjs'),{loadArt}=await import('/static/js/lumen/assets.mjs'),{createRun}=await import('/static/js/lumen/engine.mjs');
      const art=await loadArt(),canvas=document.createElement('canvas');canvas.style.cssText='width:320px;height:320px;position:fixed;left:-900px';document.body.append(canvas);
      const renderer=new Renderer(canvas,art);renderer.resize();renderer.draw(createRun());const clips={};
      for(const name of ['artificer','sentinel','quartzling','shardback','moonmoth'])for(const [animation,clip]of Object.entries(art.manifest.animations)){
        const hashes=new Set();for(let f=0;f<6;f++){renderer.ctx.clearRect(0,0,canvas.width,canvas.height);renderer.actor(name,animation,0,0,140,(f+.1)/clip.fps);hashes.add(canvas.toDataURL());}clips[name+'-'+animation]=hashes.size;
      }renderer.destroy();canvas.remove();return clips;
    });
    assert(Object.keys(animations).length===25&&Object.values(animations).every(n=>n>1),'25 new animation clips');
    assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));
    return {results,animations,errors,badAssets,iteration,screenshots:out};
  }finally{await context.close();}
}
