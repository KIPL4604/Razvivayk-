async (page) => {
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const browser=page.context().browser(),errors=[];
  const out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
  const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:3});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.goto('http://127.0.0.1:8081');
    const motion=await p.evaluate(async()=>{
      const core=await import('/static/js/lumen/engine.mjs');
      const {Renderer}=await import('/static/js/lumen/renderer.mjs');
      const {loadArt}=await import('/static/js/lumen/assets.mjs');
      const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:375px;height:812px;z-index:10000';document.body.append(canvas);
      const renderer=new Renderer(canvas,await loadArt());renderer.resize();
      const run=core.createRun({seed:21}),positions=[];run.spawnTimer=3;
      for(let frame=0;frame<240;frame++){
        core.step(run,{x:1,y:0},1/120,renderer.captureTick);renderer.draw(run);
        positions.push(renderer.at(0,0)[0]/renderer.dpr);
      }
      // Exclude initial interpolation-buffer priming, just as a warmed-up game.
      const differences=positions.slice(9).map((x,i)=>Math.abs(x-positions[i+8]));
      const repeats=differences.filter(x=>x<.001).length,maxJump=Math.max(...differences);
      const expected=160*renderer.scale/120;
      // Fixed 60 Hz mechanics remain deterministic, while 120 Hz gets intermediate poses.
      const elapsed=run.time+run.remainder;
      run.time=180;run.spawnedGuardians=1;run.upgrades={spark:4,orbit:4,pulse:4,focus:3};
      run.gems=Array.from({length:100},(_,i)=>({x:run.player.x+Math.cos(i*2.4)*(80+i*4),y:Math.sin(i*2.4)*(80+i*4),value:[2,12,40][i%3],tier:i%3+1}));
      run.enemies=Array.from({length:190},(_,i)=>({id:i+1,x:run.player.x+Math.cos(i*2.4)*(150+i*2),y:Math.sin(i*2.4)*(150+i*2),kind:['mote','beetle','wasp'][i%3],hp:300,maxHp:300,radius:12,speed:0,damage:7,value:2,phase:i%6,hitFlash:0,guardianStage:0,fireTimer:2.8}));
      run.nextId=300;run.effects=[{kind:'pulse',x:run.player.x,y:0,radius:185,life:.35,maxLife:.55}];
      const costs=[],intervals=[];let previous=0,start=0;
      await new Promise(resolve=>{
        function frame(now){
          if(!start)start=now;if(previous)intervals.push(now-previous);previous=now;
          const begin=performance.now();renderer.draw(run);costs.push(performance.now()-begin);
          if(now-start<2500)requestAnimationFrame(frame);else resolve();
        }requestAnimationFrame(frame);
      });
      const percentile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];
      renderer.destroy();canvas.remove();
      return {repeats,maxJump,expected,elapsed,frames:costs.length,drawMedian:percentile(costs,.5),drawP95:percentile(costs,.95),intervalMedian:percentile(intervals,.5),intervalP95:percentile(intervals,.95),over25:intervals.filter(x=>x>25).length};
    });
    assert(motion.repeats===0&&motion.maxJump<1.001,'Camera still repeats/jumps at DPR3: '+JSON.stringify(motion));
    assert(Math.abs(motion.elapsed-2)<1e-6,'Rendering changed simulation time');
    // Timings are reported as evidence, never as a phone performance assertion.
    async function seed(upgrade){
      await p.evaluate(async upgrade=>{
        showScreen('home');const core=await import('/static/js/lumen/engine.mjs'),run=core.createRun({seed:55});
        run.time=78;run.spawnTimer=2;run.player.y=85;run.upgrades={spark:2,orbit:2,pulse:2};run.kills=110;
        run.enemies=Array.from({length:20},(_,i)=>({id:i+1,x:Math.cos(i*2.4)*(135+i*10),y:85+Math.sin(i*2.4)*(135+i*10),kind:['mote','beetle','wasp'][i%3],hp:100,maxHp:100,radius:12,speed:40,damage:7,value:2,phase:i%6,hitFlash:0,guardianStage:0,fireTimer:2.8}));run.nextId=50;
        run.gems=[{x:-80,y:125,value:2,tier:1},{x:-50,y:200,value:12,tier:2},{x:100,y:200,value:40,tier:3}];
        if(upgrade){run.status='upgrade';run.choices=['spark','orbit','pulse'];run.level=8;}
        if(!core.restore(core.serialize(run)))throw Error('Invalid colorful fixture');
        saved.lumen={run:core.serialize(run),lastTouchedAt:Date.now()};saveState();
      },upgrade);
      await p.reload();await p.locator('[data-resume="lumen"]').click();
      if(!upgrade)await p.locator('[data-lumen-action="continue"]').click();
      else await p.locator('.lumen-upgrades').waitFor({state:'visible'});
    }
    const layouts=[];
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await seed(false);await p.waitForTimeout(160);
      await p.screenshot({path:out+`lumen-motion-combat-${width}.png`});
      await seed(true);
      const layout=await p.evaluate(()=>{
        const box=document.querySelector('.lumen-dialog').getBoundingClientRect();
        return {ratio:box.height/innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
          buttons:[...document.querySelectorAll('.lumen-upgrades button')].map(e=>{const b=e.getBoundingClientRect();return [b.width,b.height];}),
          colors:[...document.querySelectorAll('.lumen-upgrades button')].map(e=>getComputedStyle(e)[innerWidth<=540?'borderLeftColor':'borderTopColor'])};
      });
      assert(!layout.overflow&&layout.ratio<.44,'Upgrade sheet covers too much: '+width+' '+JSON.stringify(layout));
      assert(layout.buttons.every(([w,h])=>w>=44&&h>=44),'Small upgrade action');
      assert(new Set(layout.colors).size===3,'Weapon choices have identical color');
      const buttons=p.locator('#lumenOverlay button');await buttons.last().focus();await p.keyboard.press('Tab');
      assert(await buttons.first().evaluate(e=>e===document.activeElement),'Upgrade focus trap');
      await p.screenshot({path:out+`lumen-motion-upgrade-${width}.png`});layouts.push({width,...layout});
    }
    assert(!errors.length,'Browser errors: '+errors.join(';'));
    return {motion,layouts,errors,screenshots:out};
  }finally{await context.close();}
}
