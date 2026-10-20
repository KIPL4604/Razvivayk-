async (page) => {
  // Isolated QA server only. Screenshots below are deterministic combat fixtures.
  const base='http://127.0.0.1:8081';
  const out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const context=await page.context().browser().newContext({viewport:{width:1440,height:900}});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(base);
    await p.evaluate(async()=>{
      showScreen('home');
      const core=await import('/static/js/lumen/engine.mjs');
      const {Renderer}=await import('/static/js/lumen/renderer.mjs');
      window.__healthEvents=[];
      const original=Renderer.prototype.heroHealth;
      Renderer.prototype.heroHealth=function(player,cue){
        window.__healthEvents.push({hp:player.hp,hit:this.health.hitSince,flash:cue.flash,hurt:cue.hurt});
        return original.call(this,player,cue);
      };
      const run=core.createRun({seed:71});run.player.y=85;run.spawnTimer=3;
      for(const key in run.weaponTimers)run.weaponTimers[key]=6;
      run.enemies=[{id:50,x:0,y:85,kind:'mote',hp:100,maxHp:100,radius:10,
        speed:0,damage:17,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:3}];run.nextId=51;
      if(!core.restore(core.serialize(run)))throw Error('Invalid health contact fixture');
      saved.lumen={run:core.serialize(run)};saveState();
    });
    // Keep the renderer instrumentation in this document; lazy-load via catalog.
    await p.evaluate(()=>LumenMode.resume());
    await p.locator('[data-lumen-action="continue"]').click();
    await p.waitForFunction(()=>document.querySelector('#lumenHealth')?.textContent==='93 / 110');
    await p.keyboard.press('Escape');
    const contact=await p.evaluate(()=>({events:__healthEvents,health:saved.lumen.run.player.hp,
      meter:document.querySelector('#lumenHealthMeter').getAttribute('aria-valuenow')}));
    assert(contact.health===93&&contact.meter==='93','Real contact did not update HP/meter');
    assert(contact.events.some(e=>e.hurt&&e.flash>.5),'Real damage did not produce body/bar feedback');
    assert(new Set(contact.events.filter(e=>e.hurt).map(e=>e.hit)).size===1,'Invulnerability restarted hit cue');
    const frozen=await p.locator('#lumenHealth').textContent();await p.waitForTimeout(100);
    assert(await p.locator('#lumenHealth').textContent()===frozen,'Pause did not freeze health');
    await p.locator('#lumenOverlay button,#lumenOverlay summary').first().focus();await p.keyboard.press('Shift+Tab');
    assert(await p.locator('#lumenOverlay button,#lumenOverlay summary').last().evaluate(e=>e===document.activeElement),'Pause focus trap');

    await p.evaluate(async()=>{
      const core=await import('/static/js/lumen/engine.mjs'),{Renderer}=await import('/static/js/lumen/renderer.mjs');
      const {loadArt}=await import('/static/js/lumen/assets.mjs');
      const canvas=document.querySelector('#lumenCanvas').cloneNode();
      document.querySelector('#lumenCanvas').replaceWith(canvas);
      document.querySelector('#lumenOverlay').hidden=true;
      document.querySelector('#lumenMoveHint').hidden=true;
      const renderer=new Renderer(canvas,await loadArt());
      window.__healthQA={core,renderer,serial:0};
    });
    async function draw({map='garden',character='scout',hp=35,age=.11,hit=true}={}){
      return p.evaluate(({map,character,hp,age,hit})=>{
        const {core,renderer}=window.__healthQA;
        const run=core.createRun({seed:71,map,character,runId:'health-'+(++__healthQA.serial)});
        run.time=178;run.player.x=280;run.player.y=350;run.spawnTimer=99;
        run.upgrades={spark:3,orbit:3,pulse:3,ember:3};
        run.enemies=Array.from({length:36},(_,i)=>({id:50+i,
          x:280+Math.cos(i*2.4)*(45+i*14),y:350+Math.sin(i*2.4)*(45+i*14),
          kind:['mote','beetle','wasp','crawler','spitter','wisp'][i%6],hp:100,maxHp:100,
          radius:12,speed:0,damage:7,value:2,phase:0,hitFlash:0,fireTimer:9}));
        run.gems=Array.from({length:16},(_,i)=>({x:280+Math.cos(i*2.4)*(100+i*9),
          y:350+Math.sin(i*2.4)*(100+i*9),value:[2,12,40][i%3],tier:i%3+1}));
        run.zones=[{kind:'flame',x:280,y:340,radius:70,life:1}];
        run.effects=[{kind:'pulse',x:280,y:350,radius:150,life:.4,maxLife:.55}];
        renderer.resize();renderer.draw(run);
        run.time+=1/60;run.player.hp=Math.min(hp,run.player.maxHp);run.player.invulnerable=hit?.8:0;
        // A full-health/healing fixture gets a fresh baseline, not a fictitious hit.
        if(!hit)renderer.health=new (renderer.health.constructor)();
        renderer.draw(run);run.time+=age;renderer.draw(run,false,hp===0?age:undefined);
        const cue=renderer.health.sample(run.time),saved=JSON.stringify(core.serialize(run));
        renderer.draw(run,false,hp===0?age:undefined);
        const pure=saved===JSON.stringify(core.serialize(run));
        document.querySelector('#lumenHealth').textContent=run.player.hp+' / '+run.player.maxHp;
        document.querySelector('#lumenHealthMeter').setAttribute('aria-valuenow',run.player.hp);
        document.querySelector('#lumenHealthMeter').setAttribute('aria-valuemax',run.player.maxHp);
        document.querySelector('#lumenHealthMeter i').style.width=100*cue.ratio+'%';
        document.querySelector('#lumenTimer').textContent='02:58';
        document.querySelector('#lumenGoal').textContent=map==='garden'?'Биосад':'Лунный карьер';
        document.querySelector('#lumenLevel').textContent='Уровень 1 / '+(map==='garden'?30:35);
        document.querySelector('#lumenWave').style.display='none';
        const [x,y]=renderer.at(run.player.x,run.player.y-90),d=renderer.dpr;
        const width=Math.round(Math.max(48,58*renderer.scale)*d),edge=Math.round(d);
        const left=x-Math.floor(width/2),inner=width-4*edge;
        const pixel=at=>[...renderer.ctx.getImageData(at,y-Math.round(8*d)+2*edge,1,1).data].slice(0,3).join(',');
        const fill=cue.ratio<=.3?'241,116,120':cue.ratio<=.55?'235,190,105':'133,223,180';
        const body=renderer.ctx.getImageData(x-Math.round(45*renderer.zoom),Math.round(renderer.canvas.height*.49-85*renderer.zoom),Math.round(90*renderer.zoom),Math.round(90*renderer.zoom)).data;
        let tintPixels=0;for(let i=0;i<body.length;i+=4)if(body[i]>body[i+1]*1.5&&body[i]>body[i+2]*1.2)tintPixels++;
        return {pure,cue,fill,pixel:pixel(left+2*edge),empty:pixel(left+2*edge+inner-1),tintPixels,
          width:width/d,barInside:left>0&&left+width<renderer.canvas.width&&y>130*d,
          smoothing:renderer.ctx.imageSmoothingEnabled,cache:renderer.hitSheets.size,
          overflow:document.documentElement.scrollWidth>innerWidth};
      },{map,character,hp,age,hit});
    }
    const checks=[];
    for(const [width,height] of [[1440,900],[375,812],[768,1024],[1920,1080]]){
      await p.setViewportSize({width,height});
      for(const map of ['garden','quarry']){
        const check=await draw({map});checks.push({viewportWidth:width,map,...check});
        assert(check.pure&&!check.smoothing&&!check.overflow&&check.barInside,'Layout/purity '+width+' '+map);
        assert(check.pixel===check.fill&&check.width>=48,'Overhead HP missing or too small '+width+' '+map);
        assert(check.empty==='163,94,77','Damage trail hidden by FX '+width+' '+map);
        await p.waitForTimeout(120);
        await p.screenshot({path:out+`lumen-health-hit-${map}-${width}-review2.png`});
      }
    }
    for(const character of ['scout','keeper','alchemist','ranger','duelist','stormcaller','artificer','sentinel']){
      const check=await draw({character,hp:20});
      assert(check.pixel==='241,116,120'&&check.tintPixels>10,'Low-health/hit silhouette '+character);
    }
    const full=await draw({hp:110,hit:false});assert(full.empty===full.fill&&full.cue.flash===0,'Full health hidden');
    const settled=await draw({hp:20,age:.7});assert(settled.empty==='35,48,57'&&!settled.cue.hurt,'Damage trail never settles');
    const dead=await draw({hp:0,age:.7});assert(dead.pixel==='35,48,57'&&dead.cue.ratio===0,'Zero health still filled');
    await p.emulateMedia({reducedMotion:'reduce'});await p.setViewportSize({width:375,height:812});
    const reduced=await draw({map:'quarry',hp:20});
    assert(reduced.tintPixels>10&&reduced.pixel==='241,116,120','Reduced motion lost essential feedback');
    await p.waitForTimeout(120);
    await p.screenshot({path:out+'lumen-health-reduced-375-review2.png'});
    const density=[];
    for(const dpr of [2,3]){
      const dense=await page.context().browser().newContext({viewport:{width:375,height:812},deviceScaleFactor:dpr});
      try{
        const q=await dense.newPage();await q.goto(base);
        const check=await q.evaluate(async()=>{
          const {createRun}=await import('/static/js/lumen/engine.mjs'),{Renderer}=await import('/static/js/lumen/renderer.mjs');
          const {loadArt}=await import('/static/js/lumen/assets.mjs');
          const canvas=document.createElement('canvas');canvas.style.cssText='width:375px;height:812px';document.body.append(canvas);
          const renderer=new Renderer(canvas,await loadArt());renderer.resize();
          const run=createRun({seed:9});renderer.draw(run);run.time+=1/60;run.player.hp=20;renderer.draw(run);
          const [x,y]=renderer.at(0,-90),d=renderer.dpr,left=x-Math.floor(48*d/2);
          const pixel=[...renderer.ctx.getImageData(left+2*d,y-6*d,1,1).data].slice(0,3).join(',');
          const result={dpr:d,width:canvas.width,pixel,smoothing:renderer.ctx.imageSmoothingEnabled};renderer.destroy();return result;
        });
        assert(check.width===375*dpr&&check.pixel==='241,116,120'&&!check.smoothing,'DPR bar '+dpr);
        density.push(check);
      }finally{await dense.close();}
    }
    assert(errors.length===0,'Browser errors '+errors.join(';'));
    return {contact:{health:contact.health,hits:1},checks,heroes:8,reduced,density,errors};
  }finally{await context.close();}
}
