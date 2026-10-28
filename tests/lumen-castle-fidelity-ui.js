async (page, options = {}) => {
  const iteration=options.iteration||'fidelity-v2',out=options.output||'D:/Codex-artifacts/lumen-castle-fidelity-20261028/';
  const context=await page.context().browser().newContext({viewport:{width:1440,height:900}});
  const p=await context.newPage(),errors=[],badAssets=[],checks=[];
  const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  const shot=(name,width)=>p.screenshot({path:out+'castle-'+name+'-'+width+'-'+iteration+'.png'});
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.url().includes('/assets/lumen/')&&r.status()>=400)badAssets.push({url:r.url(),status:r.status()});});
  async function prepare(kind){
    const route=await p.evaluate(async kind=>{
      showScreen('home');
      const core=await import('/static/js/lumen/engine.mjs'),{updateCastleGoal}=await import('/static/js/lumen/castle.mjs'),{xpForLevel}=await import('/static/js/lumen/progression.mjs');
      const r=core.createRun({seed:527,character:'scout',map:'castle',runId:'castle-fidelity-'+kind});
      // Prepared cap/loadout, followed by real weapon damage and physical entry.
      // This is a repeatable visual fixture, not a claim about a normal full run.
      r.time=420;r.spawnedGuardians=3;r.spawnedElites=4;r.spawnTimer=3;
      r.level=kind==='corridor'?44:45;r.xpNext=xpForLevel(r.level);r.player.y=420;
      r.upgrades={spark:8,orbit:8,pulse:8,flame:8,focus:5,haste:4,laurel:3,heart:3,aegis:3};
      r.foundWeapons=['orbit','pulse','flame'];r.masteredWeapons=['orbit','pulse','flame'];r.relicState.shield=3;
      updateCastleGoal(r);
      let maxStep=0,steps=0;
      const door=r.enemies.find(e=>e.kind==='castle-door');
      if(kind!=='corridor'){
        r.player.y=r.castle.doorY+120;
        for(;steps<3600&&!r.arena;steps++){
          const y=r.player.y;core.step(r,{x:0,y:-1},1/60);maxStep=Math.max(maxStep,Math.abs(r.player.y-y));
        }
        if(!r.arena||!r.castle.doorBroken)throw Error('Real weapon breach/walk did not reach hall');
        if(maxStep>r.player.speed/60+.01)throw Error('Unexpected teleport on door route');
        if(kind==='fighting')for(let n=0;n<151;n++)core.step(r,{},1/60);
      }
      const run=core.serialize(r);if(!core.restore(run))throw Error('Invalid fidelity fixture');
      saved.lumen={meta:{coins:400,clearedMaps:['garden','quarry']},run};saveState();
      return {doorHp:door?.maxHp||0,steps,maxStep,doorBroken:r.castle.doorBroken,hallY:r.castle.hallY,playerY:r.player.y,phase:r.arena?.phase||null};
    },kind);
    await p.reload();await p.locator('[data-resume="lumen"]').click();
    await p.locator('[data-lumen-action="continue"]').click();await p.waitForTimeout(180);
    return route;
  }
  async function measure(){
    return p.evaluate(async()=>{
      const {Renderer}=await import('/static/js/lumen/renderer.mjs'),{loadArt}=await import('/static/js/lumen/assets.mjs'),{CASTLE_HALL_VISUAL}=await import('/static/js/lumen/castle-view.mjs');
      const {restore,serialize}=await import('/static/js/lumen/engine.mjs');
      const run=restore(saved.lumen.run),art=await loadArt(),before=JSON.stringify(serialize(run));
      const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;opacity:0;pointer-events:none';document.body.append(canvas);
      const renderer=new Renderer(canvas,art);renderer.resize();
      const planes=[],paint=renderer.ctx.drawImage.bind(renderer.ctx);
      renderer.ctx.drawImage=function(image,...args){
        const m=this.getTransform();
        if(image===art.images['castle-hall-decor']&&Math.abs(m.b)>.001&&Math.abs(m.c)>.001)
          planes.push({a:m.a,b:m.b,c:m.c,d:m.d});
        return paint(image,...args);
      };
      const hud=['.lumen-hud','.lumen-boss-hud','.lumen-wave'].map(selector=>{const b=document.querySelector(selector).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};});
      const top=hud[2].y+hud[2].h+20,bottom=document.querySelector('.lumen-bottom').getBoundingClientRect().top-22;
      renderer.castleInsets={top,bottom};renderer.draw(run);
      const boss=run.enemies.find(e=>e.bossType==='monarch'),meta=art.manifest.actors['boss-monarch'],hero=art.manifest.actors[run.character];
      const bossTop=renderer.at(boss.x,boss.y+7-CASTLE_HALL_VISUAL.monarchSize*meta.anchor[1]/meta.frameSize)[1]/renderer.dpr;
      const heroBottom=renderer.at(run.player.x,run.player.y+7+CASTLE_HALL_VISUAL.heroSize*(1-hero.anchor[1]/hero.frameSize))[1]/renderer.dpr;
      const floor=art.images['castle-hall-floor'],decor=art.images['castle-hall-decor'];
      const result={top,bottom,bossTop,heroBottom,hud,scale:renderer.scale,heroCss:CASTLE_HALL_VISUAL.heroSize*renderer.scale,
        ratio:CASTLE_HALL_VISUAL.monarchSize/CASTLE_HALL_VISUAL.heroSize,bossFrame:meta.frameSize,bossAnchor:meta.anchor,
        floor:[floor.width,floor.height],decor:[decor.width,decor.height],
        sidePlanes:{count:planes.length,mirrored:planes.some(m=>m.c>0)&&planes.some(m=>m.c<0),
          angled:planes.every(m=>Math.abs(m.a)<.001&&m.b>0&&m.d>0&&Object.values(m).every(Number.isFinite))},
        pure:before===JSON.stringify(serialize(run))};
      renderer.destroy();canvas.remove();return result;
    });
  }
  try{
    await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
    await p.goto('http://127.0.0.1:8081');
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});
      await prepare('corridor');await shot('corridor',width);
      if(options.walkWalls&&width===375){
        const from=await p.evaluate(()=>saved.lumen.run.player.y);
        await p.keyboard.down('w');await p.waitForTimeout(2400);await p.keyboard.up('w');
        await shot('walls-walk-north',width);await p.keyboard.press('Escape');
        const north=await p.evaluate(()=>saved.lumen.run.player.y);
        await p.locator('[data-lumen-action="continue"]').click();
        await p.keyboard.down('s');await p.waitForTimeout(2400);await p.keyboard.up('s');
        await shot('walls-walk-south',width);await p.keyboard.press('Escape');
        const south=await p.evaluate(()=>saved.lumen.run.player.y);
        assert(from-north>=320&&south-north>=320,'Keyboard traverses a complete wall bay in both directions');
        checks.push({wallWalk:{from,north,south}});
      }
      const route=await prepare('forming');await shot('forming',width);
      assert(route.doorHp===6000&&route.doorBroken&&route.phase==='forming','Actual door and hall activation');
      const framing=await measure();
      assert(framing.hud.every(b=>b.x>=0&&b.x+b.w<=width+1),'HUD horizontal bounds '+width);
      assert(framing.hud[0].y+framing.hud[0].h<framing.hud[1].y&&framing.hud[1].y+framing.hud[1].h<framing.hud[2].y,'HUD vertical separation '+width);
      assert(framing.bossTop>=framing.top-2&&framing.heroBottom<=framing.bottom+2,'Full monarch crown and hero '+width+' '+JSON.stringify(framing));
      assert(framing.ratio>=7&&framing.ratio<=8&&framing.bossFrame>=256,'Seven to eight hero heights with detailed monarch');
      assert(framing.floor[0]===1024&&framing.floor[1]===1024&&framing.decor[0]===1536&&framing.decor[1]===256,'Authored full hall assets');
      assert(framing.pure,'Drawing preserves the serialized run');
      assert(framing.sidePlanes.count>=4&&framing.sidePlanes.mirrored&&framing.sidePlanes.angled,'Side panels follow opposed angled wall planes');
      await prepare('fighting');await p.waitForTimeout(2100);await shot('ring',width);
      checks.push({width,height,route,framing});
    }
    // A labelled presentation sheet exposes the complete hall composition,
    // including architecture outside the gameplay camera's mobile crop.
    await p.setViewportSize({width:1440,height:1500});await prepare('forming');await p.keyboard.press('Escape');
    const sheet=await p.evaluate(async()=>{
      const {Renderer}=await import('/static/js/lumen/renderer.mjs'),{loadArt}=await import('/static/js/lumen/assets.mjs'),{restore}=await import('/static/js/lumen/engine.mjs');
      const run=restore(saved.lumen.run),art=await loadArt(),canvas=document.createElement('canvas');
      canvas.id='fidelity-sheet';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:10000';document.body.append(canvas);
      const renderer=new Renderer(canvas,art);renderer.resize();
      renderer.castleView.camera=()=>({x:0,y:run.arena.y-160,scale:.75,screenY:750});
      renderer.draw(run,true);
      const c=renderer.ctx;c.font=`${15*renderer.dpr}px monospace`;c.fillStyle='#f4d994';c.fillText('ПОДГОТОВЛЕННЫЙ ОБЗОР ЗАЛА · КАМЕРА КОМПОЗИЦИИ',24*renderer.dpr,34*renderer.dpr);
      window.__fidelitySheet={renderer,canvas};return {hallY:run.arena.y,scale:.75};
    });
    await shot('hall-sheet',1440);
    await p.evaluate(()=>{__fidelitySheet.renderer.destroy();__fidelitySheet.canvas.remove();delete window.__fidelitySheet;});
    await p.setViewportSize({width:375,height:812});await p.emulateMedia({reducedMotion:'reduce'});
    await prepare('forming');await shot('reduced-motion',375);
    assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));
    return {iteration,fixture:'Prepared cap/loadout; actual weapons breached full6000HP door and walked into the hall. Hall sheet uses a labelled composition camera.',checks,sheet,errors,badAssets,output:out};
  }finally{await context.close();}
}
