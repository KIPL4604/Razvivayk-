async (page) => {
  // Playwright MCP runner, isolated tests/serve_qa.py on 8081 only.
  // Showcase is an explicit QA fixture, not a real player's record.
  const base='http://127.0.0.1:8081';
  const out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const browser=page.context().browser(),results=[],errors=[],badAssets=[];
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:true});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.url().includes('/assets/lumen/')&&r.status()>=400)badAssets.push([r.url(),r.status()]);});
  async function seed(kind='showcase'){
    await p.evaluate(async kind=>{
      showScreen('home');
      const core=await import('/static/js/lumen/engine.mjs');
      const run=core.createRun({seed:71});run.player.y=85;
      if(kind==='showcase'){
        run.time=34;run.player.hp=96;run.xp=run.xpNext;core.step(run,{},1/60);
        core.chooseUpgrade(run,run.choices[0]);run.xp=6;run.kills=8;run.boltTimer=.12;run.spawnTimer=2;
        const positions=[[-120,-30],[105,20],[-145,145],[120,200],[-75,270],[180,105],[-240,50],[215,-80],[40,-150]];
        run.enemies=positions.map(([x,y],i)=>({id:50+i,x,y,kind:'mote',hp:25,maxHp:25,radius:10,speed:48,damage:7,value:2,phase:i%6,hitFlash:0,guardianStage:0,fireTimer:2.8}));
        run.nextId=100;run.gems=[{x:-55,y:135,value:2},{x:60,y:185,value:2},{x:-85,y:220,value:2}];
      }else if(kind==='upgrade'){run.xp=run.xpNext;core.step(run,{},1/60);}
      else if(kind==='death'){
        run.player.hp=1;run.enemies=[{id:50,x:0,y:85,kind:'mote',hp:100,maxHp:100,radius:10,speed:48,damage:7,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:2.8}];run.nextId=100;
      }
      if(!core.restore(core.serialize(run)))throw Error('Invalid pixel-art QA fixture');
      saved.lumen={run:core.serialize(run),lastTouchedAt:Date.now()};saveState();
    },kind);
    await p.reload();await p.locator('[data-resume="lumen"]').click();
    if(kind!=='upgrade')await p.locator('[data-lumen-action="continue"]').click();
    else await p.locator('.lumen-upgrades').waitFor({state:'visible'});
  }
  try{
    await p.goto(base);await seed();
    await p.waitForTimeout(180);
    for(const [width,height] of [[1440,900],[375,812],[768,1024],[1920,1080]]){
      await p.setViewportSize({width,height});
      await p.screenshot({path:out+`lumen-pixel-showcase-${width}-final.png`});
      const check=await p.evaluate(()=>{
        const canvas=document.querySelector('#lumenCanvas'),hud=document.querySelector('.lumen-hud').getBoundingClientRect();
        return {width:canvas.width,height:canvas.height,dpr:Math.min(3,Math.max(1,devicePixelRatio)),smoothing:canvas.getContext('2d').imageSmoothingEnabled,
          overflow:document.documentElement.scrollWidth>innerWidth,hudInside:hud.x>=0&&hud.right<=innerWidth,
          tools:[...document.querySelectorAll('.lumen-tools button')].filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height];}),
          pixelFont:[...document.fonts].some(f=>f.family==='LumenSquare'&&f.status==='loaded')&&getComputedStyle(document.querySelector('#lumenGameMount')).fontFamily.includes('LumenSquare'),icons:document.querySelectorAll('#lumenGameMount svg').length};
      });
      assert(check.width===Math.round(width*check.dpr)&&check.height===Math.round(height*check.dpr),'Native framebuffer at '+width);
      assert(!check.smoothing&&!check.overflow&&check.hudInside&&check.pixelFont&&check.icons===0,'Rendering/HUD invariant at '+width);
      assert(check.tools.every(([w,h])=>w>=44&&h>=44),'Touch target at '+width);
    }
    results.push('Four responsive widths, hard pixels, local Cyrillic font, 44px tools, PNG device glyphs');
    await p.setViewportSize({width:375,height:812});await p.keyboard.press('Escape');
    await p.screenshot({path:out+'lumen-pixel-pause-375-final.png'});
    const buttons=p.locator('#lumenOverlay button');await buttons.last().focus();await p.keyboard.press('Tab');
    assert(await buttons.first().evaluate(e=>e===document.activeElement),'Pause focus trap');
    const frozen=await p.locator('#lumenTimer').innerText();await p.waitForTimeout(150);assert(await p.locator('#lumenTimer').innerText()===frozen,'Pause clock');
    await p.setViewportSize({width:812,height:375});await p.screenshot({path:out+'lumen-pixel-pause-landscape-final.png'});
    await p.setViewportSize({width:375,height:812});await seed('upgrade');
    await p.screenshot({path:out+'lumen-pixel-upgrade-375-final.png'});
    for(const el of await p.locator('.lumen-upgrades button').all())assert((await el.boundingBox()).width<375,'Upgrade overflow');
    const id=await p.locator('[data-lumen-action="upgrade"]').first().getAttribute('data-lumen-value');
    await p.locator('[data-lumen-action="upgrade"]').first().click();await p.keyboard.press('Escape');
    assert(await p.evaluate(id=>saved.lumen.run.upgrades[id]===1,id),'Upgrade not applied');
    results.push('Pause/focus/landscape and real upgrade action persisted');

    const presentation=await p.evaluate(async()=>{
      const core=await import('/static/js/lumen/engine.mjs');
      const {Renderer}=await import('/static/js/lumen/renderer.mjs');
      const {loadArt}=await import('/static/js/lumen/assets.mjs');
      const canvas=document.createElement('canvas');canvas.style.cssText='width:800px;height:600px;position:fixed;left:-900px';document.body.append(canvas);
      const renderer=new Renderer(canvas,await loadArt());renderer.resize();
      const run=core.createRun({seed:9});run.enemies=[{id:100,x:55,y:0,kind:'mote',hp:1,maxHp:1,radius:10,speed:0,damage:7,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:2.8}];run.nextId=101;
      const before=JSON.stringify(core.serialize(run));renderer.draw(run);
      const unchanged=before===JSON.stringify(core.serialize(run));
      core.step(run,{},.2);renderer.draw(run);
      const killed=run.kills===1&&run.enemies.length===0&&renderer.ghosts.length===1;
      const after=JSON.stringify(core.serialize(run));renderer.draw(run);
      const sameAfterDeath=after===JSON.stringify(core.serialize(run));
      for(let i=0;i<4;i++)core.step(run,{},.2);renderer.draw(run);
      const ghostExpired=renderer.ghosts.length===0;
      const frames={};
      for(const actor of ['scout','mote','beetle','wasp'])for(const animation of ['idle','walk','attack','hurt','death']){
        const data=renderer.art.manifest.animations[animation],seen=new Set();
        for(let frame=0;frame<6;frame++){
          renderer.ctx.fillStyle='#17262e';renderer.ctx.fillRect(0,0,canvas.width,canvas.height);
          renderer.actor(actor,animation,0,0,96,(frame+.1)/data.fps,0);seen.add(canvas.toDataURL());
        }
        frames[actor+'-'+animation]=seen.size;
      }
      renderer.destroy();canvas.remove();return {unchanged,killed,sameAfterDeath,ghostExpired,frames};
    });
    assert(presentation.unchanged&&presentation.killed&&presentation.sameAfterDeath&&presentation.ghostExpired,'Renderer changed gameplay/death reward');
    assert(Object.values(presentation.frames).every(count=>count>1),'Animation did not play '+JSON.stringify(presentation.frames));
    results.push('All 20 animation clips draw distinct frames; renderer never mutates save; death gives reward immediately');

    await p.emulateMedia({reducedMotion:'reduce'});await seed('death');
    await p.waitForSelector('.lumen-result-mark');await p.waitForTimeout(650);
    await p.screenshot({path:out+'lumen-pixel-defeat-375-final.png'});
    assert(await p.evaluate(()=>saved.lumen.run===null),'Death save remains active');
    const dprContext=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:2});
    try{
      const q=await dprContext.newPage();await q.goto(base);await q.locator('[data-lumen-action="open"]').click();await q.locator('[data-lumen-action="start"]').click();
      assert(await q.evaluate(()=>lumenCanvas.width===750&&!lumenCanvas.getContext('2d').imageSmoothingEnabled),'DPR2 native framebuffer');
      await q.screenshot({path:out+'lumen-pixel-dpr2-375-final.png'});
    }finally{await dprContext.close();}
    const failed=await browser.newContext();
    try{
      const q=await failed.newPage();await q.route('**/assets/lumen/scout.png',route=>route.abort());await q.goto(base);await q.locator('[data-lumen-action="open"]').click();
      await q.locator('#lumenSetupMount [role="alert"]').waitFor();
      assert(await q.locator('[data-lumen-action="reload"]').isVisible(),'Missing sprite has no recovery action');
    }finally{await failed.close();}
    assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));
    results.push('Reduced motion, terminal death, DPR2, missing sprite recovery, no asset/page errors');
    return {results,presentation,pageErrors:errors,badAssets,screenshots:out};
  }finally{await context.close();}
}
