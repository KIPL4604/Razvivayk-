async (page) => {
  const iteration='v4';
  const root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/';
  const context=await page.context().browser().newContext({viewport:{width:1440,height:900},hasTouch:true});
  const p=await context.newPage(),errors=[],badAssets=[],results=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.url().includes('/assets/lumen/')&&r.status()>=400)badAssets.push(r.url());});
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  async function seed(kind,map='garden'){
    await p.evaluate(async({kind,map})=>{
      showScreen('home');const core=await import('/static/js/lumen/engine.mjs');
      const run=core.createRun({seed:73,map,runId:'contact-'+kind});run.player.y=85;run.time=30;
      run.spawnTimer=3;run.boltTimer=3;run.nextId=1000;
      const enemy=(id,x,y)=>({id,kind:'mote',x,y,hp:100,maxHp:100,radius:10,speed:0,
        damage:7,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:3,elite:false,slowTime:0,actionTimer:0});
      if(kind==='wall')run.enemies=[enemy(1,62,85)];
      if(kind==='ring'||kind==='gap'){
        run.enemies=Array.from({length:8},(_,i)=>enemy(i+1,Math.cos(i*Math.PI/4)*60,85+Math.sin(i*Math.PI/4)*60));
        if(kind==='gap')run.enemies.shift();
      }
      if(kind==='bite')run.enemies=Array.from({length:5},(_,i)=>enemy(i+1,Math.cos(i*Math.PI*2/5)*42,85+Math.sin(i*Math.PI*2/5)*42));
      run.gems=[{x:-130,y:220,value:2,tier:1},{x:0,y:220,value:12,tier:2},{x:130,y:220,value:40,tier:3}];
      if(!core.restore(core.serialize(run)))throw Error('Invalid contact fixture '+kind);
      saved.lumen={run:core.serialize(run)};saveState();
    },{kind,map});
    await p.evaluate(()=>LumenMode.resume());
    await p.locator('[data-lumen-action="continue"]').click();
  }
  async function move(seconds){await p.keyboard.down('d');await p.waitForTimeout(seconds*1000);await p.keyboard.up('d');await p.keyboard.press('Escape');return p.evaluate(()=>saved.lumen.run);}
  try{
    await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto('http://127.0.0.1:8081');
    await p.evaluate(async()=>{
      const {Renderer}=await import('/static/js/lumen/renderer.mjs'),original=Renderer.prototype.view;
      window.__biteViews=[];
      Renderer.prototype.view=function(state){
        original.call(this,state);
        if(state.contactTimer>.31)__biteViews.push({time:state.time,hp:state.player.hp,since:this.views.get(1)?.since});
      };
    });
    await seed('wall');const wall=await move(.65);
    assert(Math.abs(wall.player.x-20)<.01,'Player walked through stationary monster');
    assert(wall.player.hp<110&&wall.player.hp>0,'Blocked contact should hurt');
    assert(wall.enemies[0].x===62,'Walking pushed monster');
    const bites=await p.evaluate(()=>__biteViews.filter(e=>e.hp<110));assert(new Set(bites.map(e=>e.since)).size>=2,'Bite animation did not restart with damage');results.push({wall:{x:wall.player.x,hp:wall.player.hp}});
    await seed('ring');const ring=await move(.65);assert(ring.player.x<=18.01,'Escaped closed ring');
    await seed('gap');const gap=await move(.7);assert(gap.player.x>80,'Could not use open gap');results.push({ringX:ring.player.x,gapX:gap.player.x});
    for(const [width,height]of [[1440,900],[375,812],[768,1024],[1920,1080]]){
      await p.setViewportSize({width,height});
      for(const map of ['garden','quarry']){
        await seed('bite',map);
        await p.waitForFunction(()=>document.querySelector('#lumenWave').dataset.phase==='contact'&&Number(document.querySelector('#lumenHealth').textContent.split(' / ')[0])<110);
        await p.waitForTimeout(100);
        await p.screenshot({path:root+`output/playwright/lumen-contact-${map}-${width}-${iteration}.png`});
        const layout=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
          wave:document.querySelector('#lumenWave').getBoundingClientRect().toJSON(),hp:document.querySelector('#lumenHealth').textContent}));
        assert(!layout.overflow&&layout.wave.x>=0&&layout.wave.right<=width,'Warning overflow '+width);
        await p.keyboard.press('Escape');const paused=await p.locator('#lumenHealth').textContent();await p.waitForTimeout(80);
        assert(await p.locator('#lumenHealth').textContent()===paused,'Paused health changed');
        results.push({width,map,hp:layout.hp});
      }
    }
    const controls=p.locator('#lumenOverlay button,#lumenOverlay summary');await controls.first().focus();await p.keyboard.press('Shift+Tab');
    assert(await controls.last().evaluate(e=>e===document.activeElement),'Pause focus trap');
    await p.emulateMedia({reducedMotion:'reduce'});await p.setViewportSize({width:375,height:812});await seed('bite','quarry');
    await p.waitForFunction(()=>document.querySelector('#lumenWave').dataset.phase==='contact'&&Number(document.querySelector('#lumenHealth').textContent.split(' / ')[0])<110);
    await p.screenshot({path:root+`output/playwright/lumen-contact-reduced-375-${iteration}.png`});await p.keyboard.press('Escape');
    // Measure a deterministic, bounded 240-body fixture separately from screenshots.
    const physics=await p.evaluate(async()=>{
      const {separateCrowd}=await import('/static/js/lumen/physics.mjs');
      const crowd=Array.from({length:240},(_,i)=>({id:i+1,kind:i%4?'mote':'beetle',radius:i%4?10:16,hp:100,x:Math.cos(i*2.4)*(40+i*.8),y:Math.sin(i*2.4)*(40+i*.8)}));
      const start=performance.now();for(let i=0;i<120;i++)separateCrowd(crowd,{x:0,y:0});
      return {bodies:crowd.length,msPerStep:(performance.now()-start)/120,finite:crowd.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y))};
    });assert(physics.finite&&physics.bodies===240,'Invalid bounded crowd');
    assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));return {iteration,results,physics,errors,badAssets};
  }finally{await context.close();}
}
